import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getMessengerRuntimeConfig,
  listClients,
  loadMessengerClientConfig,
  loadMessengerTokens,
  MessengerConfigError,
  PROJECT_ROOT,
} from '../src/config.js';

const LEGACY_CONFIG = `allowed_scenarios:
  - create_payment
approval_threshold: 1000
require_human_confirmation: true
`;

describe('messenger config', () => {
  let temporaryRoot: string;
  let clientsDir: string;

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ykassa-messenger-'));
    clientsDir = path.join(temporaryRoot, 'clients');
    await mkdir(clientsDir);
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it('loads legacy config without messengers and applies existing defaults', async () => {
    await writeClientFile('online-school', 'config.yaml', LEGACY_CONFIG);

    const config = await loadMessengerClientConfig(
      'online-school',
      clientsDir,
    );

    expect(config.messengers).toBeUndefined();
    expect(config.defaults).toEqual({
      currency: 'RUB',
      vat_code: 1,
      capture: true,
      invoice_expiry_days: 30,
    });
  });

  it('accepts an enabled platform with an empty allowlist', async () => {
    const contents = `${LEGACY_CONFIG}messengers:
  telegram:
    enabled: true
    allowed_user_ids: []
`;
    await writeClientFile('online-school', 'config.yaml', contents);

    const config = await loadMessengerClientConfig(
      'online-school',
      clientsDir,
    );

    expect(config.messengers?.telegram).toEqual({
      enabled: true,
      allowed_user_ids: [],
      locale: 'ru',
    });
    expect(config.messengers?.max).toEqual({
      enabled: false,
      allowed_user_ids: [],
      locale: 'ru',
    });
  });

  it('loads enabled platform tokens and never returns disabled tokens', async () => {
    const contents = `${LEGACY_CONFIG}messengers:
  telegram:
    enabled: true
    allowed_user_ids: []
  max:
    enabled: false
`;
    await writeClientFile('online-school', 'config.yaml', contents);
    await writeClientFile(
      'online-school',
      '.env',
      'TELEGRAM_BOT_TOKEN=telegram-secret\nMAX_BOT_TOKEN=max-secret\n',
    );

    await expect(
      loadMessengerTokens('online-school', clientsDir),
    ).resolves.toEqual({ telegram: 'telegram-secret' });
  });

  it('returns available tokens so one enabled transport does not block another', async () => {
    const contents = `${LEGACY_CONFIG}messengers:
  telegram:
    enabled: true
  max:
    enabled: true
`;
    await writeClientFile('online-school', 'config.yaml', contents);
    await writeClientFile(
      'online-school',
      '.env',
      'TELEGRAM_BOT_TOKEN=telegram-secret\n',
    );

    await expect(
      loadMessengerTokens('online-school', clientsDir),
    ).resolves.toEqual({ telegram: 'telegram-secret' });
  });

  it('does not require a secrets file when every platform is disabled', async () => {
    await writeClientFile('online-school', 'config.yaml', LEGACY_CONFIG);

    await expect(
      loadMessengerTokens('online-school', clientsDir),
    ).resolves.toEqual({});
  });

  it('requires a secrets file when an enabled platform is configured', async () => {
    await writeClientFile(
      'online-school',
      'config.yaml',
      `${LEGACY_CONFIG}messengers:
  max:
    enabled: true
`,
    );

    await expect(
      loadMessengerTokens('online-school', clientsDir),
    ).rejects.toMatchObject({
      name: 'MessengerConfigError',
      status: 500,
      message: expect.stringContaining('Secrets file'),
    });
  });

  it('lists only valid client directories that contain config.yaml', async () => {
    await writeClientFile('online-school', 'config.yaml', LEGACY_CONFIG);
    await mkdir(path.join(clientsDir, 'no-config'));
    await mkdir(path.join(clientsDir, '_invalid-name'));

    await expect(listClients(clientsDir)).resolves.toEqual(['online-school']);
  });

  it('rejects invalid client names before filesystem access', async () => {
    await expect(
      loadMessengerClientConfig('../outside', clientsDir),
    ).rejects.toBeInstanceOf(MessengerConfigError);
  });

  it('resolves root defaults from the project root', () => {
    const runtime = getMessengerRuntimeConfig({});

    expect(runtime.apiBaseUrl).toBe('http://127.0.0.1:3000');
    expect(runtime.clientsDir).toBe(path.join(PROJECT_ROOT, 'clients'));
  });

  it('accepts private API origins and rejects public or path-based endpoints', () => {
    expect(
      getMessengerRuntimeConfig({
        API_BASE_URL: 'http://10.12.0.4:3000/',
      }).apiBaseUrl,
    ).toBe('http://10.12.0.4:3000');
    expect(() =>
      getMessengerRuntimeConfig({ API_BASE_URL: 'https://8.8.8.8' }),
    ).toThrow('localhost or private-network origin');
    expect(() =>
      getMessengerRuntimeConfig({ API_BASE_URL: 'http://localhost:3000/api' }),
    ).toThrow('localhost or private-network origin');
  });

  async function writeClientFile(
    client: string,
    filename: string,
    contents: string,
  ): Promise<void> {
    const directory = path.join(clientsDir, client);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), contents, 'utf8');
  }
});
