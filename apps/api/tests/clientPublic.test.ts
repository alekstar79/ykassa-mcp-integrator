import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIENTS_DIR } from '../src/config.js';
import { errorHandler } from '../src/http.js';
import { createClientPublicRouter } from '../src/routes/clientPublic.js';

const temporaryDirectories: string[] = [];

async function createClientFixture(
  configContents?: string,
  clientsDir: string = CLIENTS_DIR,
): Promise<string> {
  await mkdir(clientsDir, { recursive: true });
  const temporaryDirectory = await mkdtemp(
    path.join(clientsDir, 'vitest-client-'),
  );
  const directory = path.join(
    clientsDir,
    path.basename(temporaryDirectory).toLowerCase(),
  );
  if (temporaryDirectory !== directory) {
    await rename(temporaryDirectory, directory);
  }
  temporaryDirectories.push(directory);
  await writeFile(
    path.join(directory, 'config.yaml'),
    configContents ??
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: true',
        'brand:',
        '  display_name: Test Brand',
      ].join('\n'),
  );
  await writeFile(
    path.join(directory, '.env'),
    'YOOKASSA_SHOP_ID=test-shop-only\nYOOKASSA_MCP_TOKEN=test-token-only\n',
  );
  return path.basename(directory);
}

function createApp(clientsDir: string = CLIENTS_DIR) {
  const app = express();
  app.use('/api/clients', createClientPublicRouter({ clientsDir }));
  app.use(errorHandler);
  return app;
}

describe('GET /api/clients/:name/public', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it('returns public UI and limit defaults for an existing client', async () => {
    const clientName = await createClientFixture();
    const response = await request(createApp()).get(
      `/api/clients/${clientName}/public`,
    );

    expect(response.status).toBe(200);
    expect(response.body.ui).toEqual({
      mode: 'reference-ui',
      accent: 'navy',
      radius: 2,
      shadow: 'soft',
      font_pair: 'manrope+jetbrains',
      form_style: 'flat',
      h1_size: 'm',
    });
    expect(response.body.limits).toEqual({
      max_messages: 20,
      max_attachment_kb: 100,
    });
    expect(response.body).not.toHaveProperty('shop_id');
    expect(response.body).not.toHaveProperty('mcp_token');
  });

  it('returns 404 for a nonexistent client', async () => {
    const response = await request(createApp()).get(
      '/api/clients/nonexistent-client-zz/public',
    );

    expect(response.status).toBe(404);
  });

  it('returns normalized public settings without YAML secret fields', async () => {
    const clientName = await createClientFixture(
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: true',
        'shop_id: private-shop-value',
        'mcp_token: private-token-value',
        'brand:',
        '  display_name: Public Brand',
        '  tone: professional',
        '  primary_color: "#1a365d"',
        '  greeting: Create a payment link',
        '  mcp_token: nested-private-token',
      ].join('\n'),
    );

    const response = await request(createApp()).get(
      `/api/clients/${clientName}/public`,
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.ui).toEqual({
      mode: 'reference-ui',
      accent: 'navy',
      radius: 2,
      shadow: 'soft',
      font_pair: 'manrope+jetbrains',
      form_style: 'flat',
      h1_size: 'm',
    });
    expect(response.body.limits).toEqual({
      max_messages: 20,
      max_attachment_kb: 100,
    });
    expect(JSON.stringify(response.body)).not.toContain('private-');
    expect(response.body.brand).toEqual({ display_name: 'Public Brand' });
    expect(response.body.brand).not.toHaveProperty('tone');
    expect(response.body.brand).not.toHaveProperty('primary_color');
    expect(response.body.brand).not.toHaveProperty('greeting');
  });
});

describe('GET /api/clients', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it('lists only clients with config and secrets files without exposing secrets', async () => {
    const clientsDir = await mkdtemp(
      path.join(tmpdir(), 'ykassa-client-discovery-'),
    );
    temporaryDirectories.push(clientsDir);
    const clientName = await createClientFixture(undefined, clientsDir);
    const incompleteDirectory = path.join(clientsDir, 'incomplete-client');
    await mkdir(incompleteDirectory);
    await writeFile(
      path.join(incompleteDirectory, 'config.yaml'),
      'allowed_scenarios: [create_payment]\napproval_threshold: 1000\nrequire_human_confirmation: true\n',
    );
    const exampleDirectory = path.join(clientsDir, 'example');
    await mkdir(exampleDirectory);
    await writeFile(
      path.join(exampleDirectory, 'config.yaml'),
      'allowed_scenarios: [create_payment]\napproval_threshold: 1000\nrequire_human_confirmation: true\n',
    );
    await writeFile(path.join(exampleDirectory, '.env'), 'template=true\n');

    const response = await request(createApp(clientsDir)).get('/api/clients');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      clients: [{ name: clientName, display_name: 'Test Brand' }],
    });
    expect(JSON.stringify(response.body)).not.toContain('test-token-only');
    expect(JSON.stringify(response.body)).not.toContain('test-shop-only');
  });

  it('returns an empty list when the clients directory does not exist', async () => {
    const missingClientsDir = path.join(
      tmpdir(),
      `ykassa-missing-clients-${Date.now()}`,
    );

    const response = await request(createApp(missingClientsDir)).get(
      '/api/clients',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ clients: [] });
  });
});
