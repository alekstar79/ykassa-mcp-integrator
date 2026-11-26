import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLIENTS_DIR,
  loadClientConfig,
  loadClientEnvironment,
  loadClientSecrets,
  parseClientConfig,
  validateAttachment,
} from '../src/config.js';

const temporaryDirectories: string[] = [];

async function createClientFixture(): Promise<string> {
  const directory = await mkdtemp(path.join(CLIENTS_DIR, 'vitest-client-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('parseClientConfig', () => {
  it('accepts a valid YAML config and preserves the brand', () => {
    expect(
      parseClientConfig(
        [
          'allowed_scenarios:',
          '  - create_payment',
          'approval_threshold: 4000',
          'require_human_confirmation: true',
          'brand:',
          '  display_name: Test School',
        ].join('\n'),
        'test-school',
      ),
    ).toEqual({
      allowed_scenarios: ['create_payment'],
      approval_threshold: 4000,
      require_human_confirmation: true,
      brand: { display_name: 'Test School' },
      ui: {
        mode: 'reference-ui',
        accent: 'navy',
        radius: 2,
        shadow: 'soft',
        font_pair: 'manrope+jetbrains',
        form_style: 'flat',
        h1_size: 'm',
      },
      limits: {
        max_messages: 20,
        max_attachment_kb: 100,
      },
      defaults: {
        currency: 'RUB',
        vat_code: 1,
        capture: true,
        invoice_expiry_days: 30,
      },
    });
  });

  it('accepts configured UI and limits within supported ranges', () => {
    const config = parseClientConfig(
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 0',
        'require_human_confirmation: false',
        'ui:',
        '  mode: custom-ui',
        '  accent: terracotta',
        '  radius: 8',
        '  shadow: medium',
        '  font_pair: inter+jetbrains',
        '  form_style: card',
        '  h1_size: l',
        'limits:',
        '  max_messages: 100',
        '  max_attachment_kb: 1024',
      ].join('\n'),
      'test-client',
    );

    expect(config.ui).toEqual({
      mode: 'custom-ui',
      accent: 'terracotta',
      radius: 8,
      shadow: 'medium',
      font_pair: 'inter+jetbrains',
      form_style: 'card',
      h1_size: 'l',
    });
    expect(config.limits).toEqual({
      max_messages: 100,
      max_attachment_kb: 1024,
    });
  });

  it.each([
    ['accent', 'ui:\n  accent: violet', 'ui.accent'],
    ['radius', 'ui:\n  radius: 3', 'ui.radius'],
    ['message limit', 'limits:\n  max_messages: 0', 'limits.max_messages'],
    [
      'attachment limit',
      'limits:\n  max_attachment_kb: 1025',
      'limits.max_attachment_kb',
    ],
  ])('rejects invalid %s values', (_label, optionalConfig, fieldName) => {
    const yaml = [
      'allowed_scenarios: [create_payment]',
      'approval_threshold: 100',
      'require_human_confirmation: false',
      optionalConfig,
    ].join('\n');

    expect(() => parseClientConfig(yaml, 'test-client')).toThrow(fieldName);
  });

  it('rejects invalid YAML and non-mapping YAML values', () => {
    expect(() => parseClientConfig('allowed_scenarios: [', 'client')).toThrow(
      'is not valid YAML',
    );
    expect(() => parseClientConfig('- item', 'client')).toThrow(
      'must be a YAML mapping',
    );
  });

  it.each([
    [
      'allowed_scenarios',
      'allowed_scenarios: create_payment\napproval_threshold: 100\nrequire_human_confirmation: false',
      'invalid allowed_scenarios',
    ],
    [
      'approval_threshold',
      'allowed_scenarios: [create_payment]\napproval_threshold: -1\nrequire_human_confirmation: false',
      'invalid approval_threshold',
    ],
    [
      'require_human_confirmation',
      'allowed_scenarios: [create_payment]\napproval_threshold: 100\nrequire_human_confirmation: 1',
      'missing require_human_confirmation',
    ],
  ])('rejects an invalid %s value', (_field, yaml, message) => {
    expect(() => parseClientConfig(yaml, 'client')).toThrow(message);
  });
});

describe('client config and secrets files', () => {
  it('reports missing config and secrets files and rejects path traversal', async () => {
    const directory = await createClientFixture();
    const clientName = path.basename(directory);

    await expect(loadClientConfig(clientName)).rejects.toMatchObject({
      status: 404,
    });
    await expect(loadClientSecrets(clientName)).rejects.toMatchObject({
      status: 500,
    });
    await expect(loadClientConfig('../outside-clients')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('loads client YAML without requiring a secrets file', async () => {
    const directory = await createClientFixture();
    await writeFile(
      path.join(directory, 'config.yaml'),
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 2500',
        'require_human_confirmation: true',
      ].join('\n'),
    );

    const config = await loadClientConfig(path.basename(directory));
    expect(config.approval_threshold).toBe(2500);
    await expect(readFile(path.join(directory, '.env'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('reads only test-only secrets and rejects empty secret values', async () => {
    const directory = await createClientFixture();
    const clientName = path.basename(directory);
    await writeFile(
      path.join(directory, '.env'),
      'YOOKASSA_SHOP_ID=test-shop-only\nYOOKASSA_MCP_TOKEN=test-token-only\n',
    );
    await expect(loadClientSecrets(clientName)).resolves.toEqual({
      shopId: 'test-shop-only',
      mcpToken: 'test-token-only',
    });

    await writeFile(
      path.join(directory, '.env'),
      'YOOKASSA_SHOP_ID=\nYOOKASSA_MCP_TOKEN=\n',
    );
    await expect(loadClientSecrets(clientName)).rejects.toThrow(
      'YOOKASSA_SHOP_ID is missing or empty',
    );

    await writeFile(
      path.join(directory, '.env'),
      'YOOKASSA_SHOP_ID=test-shop-only\n',
    );
    await expect(loadClientSecrets(clientName)).rejects.toThrow(
      'YOOKASSA_MCP_TOKEN is missing or empty',
    );
  });

  it('loads client LLM settings from the same private environment file', async () => {
    const directory = await createClientFixture();
    const clientName = path.basename(directory);
    await writeFile(
      path.join(directory, '.env'),
      [
        'YOOKASSA_SHOP_ID=test-shop-only',
        'YOOKASSA_MCP_TOKEN=test-token-only',
        'LLM_PROVIDER=openai',
        'LLM_MODEL=test-model',
        'LLM_BASE_URL=https://llm.example/v1',
        'LLM_API_KEY=test-llm-key',
      ].join('\n'),
    );

    await expect(loadClientEnvironment(clientName)).resolves.toMatchObject({
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'test-model',
      LLM_BASE_URL: 'https://llm.example/v1',
      LLM_API_KEY: 'test-llm-key',
    });
  });

  it('applies the configured attachment size limit in UTF-8 bytes', async () => {
    expect(
      validateAttachment({ filename: 'data.txt', content: '€'.repeat(341) }, 1),
    ).toBeDefined();
    expect(() =>
      validateAttachment(
        { filename: 'data.txt', content: '€'.repeat(342) },
        1,
      ),
    ).toThrow('at most 1 KB');
  });
});
