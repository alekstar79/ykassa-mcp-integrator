import JSZip from 'jszip';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_CONFIG_DEFAULTS,
  ClientConfigSchema,
} from '@alekstar79/ykassa-contracts';
import { buildClientZip } from '../src/export/buildZip.js';
import type { ClientZipForm } from '../src/export/buildZip.js';

function validForm(overrides: Partial<ClientZipForm> = {}): ClientZipForm {
  const defaults: ClientZipForm = {
    name: 'online-school',
    shop_id: '123456789',
    mcp_token: 'test-token-123456',
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: { display_name: 'Online English School' },
    ui: { ...CLIENT_CONFIG_DEFAULTS.ui },
    limits: { ...CLIENT_CONFIG_DEFAULTS.limits },
  };

  return {
    ...defaults,
    ...overrides,
    brand: { ...defaults.brand, ...overrides.brand },
    ui: { ...defaults.ui, ...overrides.ui },
    limits: { ...defaults.limits, ...overrides.limits },
  };
}

async function extractZip(
  form = validForm(),
  locale: 'ru' | 'en' = 'ru',
) {
  const archive = await JSZip.loadAsync(await buildClientZip(form, locale));
  const yamlFile = archive.file(`${form.name}/config.yaml`);
  const envFile = archive.file(`${form.name}/.env`);
  const readmeFile = archive.file(`${form.name}/README.md`);
  if (!yamlFile || !envFile || !readmeFile) {
    throw new Error('The client archive is missing an expected file.');
  }

  const configYaml = await yamlFile.async('string');
  return {
    archive,
    configYaml,
    config: load(configYaml),
    env: await envFile.async('string'),
    readme: await readmeFile.async('string'),
  };
}

describe('buildClientZip', () => {
  it('creates the expected files and a valid config without brand.greeting', async () => {
    const { archive, configYaml, config } = await extractZip();
    const files = Object.keys(archive.files).filter(
      (path) => !archive.files[path]?.dir,
    );

    expect(files).toEqual([
      'online-school/config.yaml',
      'online-school/.env',
      'online-school/README.md',
    ]);
    expect(ClientConfigSchema.safeParse(config).success).toBe(true);
    expect(config).toMatchObject({
      allowed_scenarios: ['create_payment'],
      approval_threshold: 1000,
      brand: { display_name: 'Online English School' },
      ui: { mode: 'reference-ui', accent: 'navy' },
    });
    expect(config).not.toHaveProperty('brand.greeting');
    expect(configYaml).not.toContain('greeting:');
  });

  it('keeps shop credentials in .env and out of config.yaml', async () => {
    const { configYaml, env } = await extractZip();

    expect(env).toContain('YOOKASSA_SHOP_ID="123456789"');
    expect(env).toContain('YOOKASSA_MCP_TOKEN="test-token-123456"');
    expect(configYaml).not.toContain('123456789');
    expect(configYaml).not.toContain('test-token-123456');
  });

  it('writes only the custom UI mode and omits the reference brand', async () => {
    const { config } = await extractZip(
      validForm({
        ui: { ...CLIENT_CONFIG_DEFAULTS.ui, mode: 'custom-ui' },
      }),
    );

    expect(config).toMatchObject({ ui: { mode: 'custom-ui' } });
    expect(config).not.toHaveProperty('brand');
    expect(config).not.toHaveProperty('ui.accent');
  });

  it('rejects invalid names, secrets, and client configuration', async () => {
    await expect(
      buildClientZip(validForm({ name: 'Bad Name' })),
    ).rejects.toThrow('Client name must be a lowercase slug.');
    await expect(
      buildClientZip(validForm({ shop_id: '' })),
    ).rejects.toThrow('Shop ID is missing or is a placeholder.');
    await expect(
      buildClientZip(validForm({ shop_id: 'your-shop-id' })),
    ).rejects.toThrow('Shop ID is missing or is a placeholder.');
    await expect(
      buildClientZip(validForm({ mcp_token: '' })),
    ).rejects.toThrow('MCP token is missing or is a placeholder.');
    await expect(
      buildClientZip(validForm({ mcp_token: 'placeholder-token' })),
    ).rejects.toThrow('MCP token is missing or is a placeholder.');
    await expect(
      buildClientZip(validForm({ allowed_scenarios: [] })),
    ).rejects.toThrow('Client configuration is invalid:');
  });

  it('writes Russian onboarding instructions by default', async () => {
    const { readme } = await extractZip();

    expect(readme).toContain('# online-school');
    expect(readme).toContain('Поместите папку');
    expect(readme).toContain('http://localhost:5173/?client=online-school');
  });

  it('writes English onboarding instructions when the locale is English', async () => {
    const { readme } = await extractZip(validForm(), 'en');

    expect(readme).toContain('# online-school');
    expect(readme).toContain('Place the `online-school/` folder');
    expect(readme).toContain('http://localhost:5173/?client=online-school');
  });
});
