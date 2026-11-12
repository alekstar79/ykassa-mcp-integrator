import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/lib.js';

const temporaryDirectories: string[] = [];

describe('createApp', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it('serves client settings from the configured clients directory', async () => {
    const clientsDir = await mkdtemp(
      path.join(os.tmpdir(), 'ykassa-api-clients-'),
    );
    temporaryDirectories.push(clientsDir);
    const clientDir = path.join(clientsDir, 'test-school');
    await mkdir(clientDir);
    await writeFile(
      path.join(clientDir, 'config.yaml'),
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: false',
        'brand:',
        '  display_name: Test School',
      ].join('\n'),
    );

    const response = await request(createApp({ clientsDir })).get(
      '/api/clients/test-school/public',
    );

    expect(response.status).toBe(200);
    expect(response.body.brand).toEqual({ display_name: 'Test School' });
    expect(response.body.allowed_scenarios).toEqual(['create_payment']);
  });
});
