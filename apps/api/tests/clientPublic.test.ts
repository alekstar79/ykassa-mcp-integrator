import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIENTS_DIR } from '../src/config.js';
import { errorHandler } from '../src/http.js';
import { clientPublicRouter } from '../src/routes/clientPublic.js';

const temporaryDirectories: string[] = [];

function createApp() {
  const app = express();
  app.use('/api/clients', clientPublicRouter);
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

  it.each(['online-school', 'delivery-service'])(
    'returns public UI and limit defaults for %s',
    async (clientName) => {
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
    },
  );

  it('returns normalized public settings without YAML secret fields', async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(CLIENTS_DIR, 'vitest-client-'),
    );
    const directory = path.join(
      CLIENTS_DIR,
      path.basename(temporaryDirectory).toLowerCase(),
    );
    await rename(temporaryDirectory, directory);
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, 'config.yaml'),
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: true',
        'shop_id: private-shop-value',
        'mcp_token: private-token-value',
        'brand:',
        '  display_name: Public Brand',
        '  mcp_token: nested-private-token',
      ].join('\n'),
    );

    const response = await request(createApp()).get(
      `/api/clients/${path.basename(directory)}/public`,
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
  });
});
