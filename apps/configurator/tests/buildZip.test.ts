import JSZip from 'jszip';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_CONFIG_DEFAULTS,
  DEFAULTS_BLOCK_FALLBACK,
  ClientConfigSchema,
} from '@alekstar79/ykassa-contracts';
import { buildClientZip } from '../src/export/buildZip.js';
import type { ClientZipForm } from '../src/export/buildZip.js';

function validForm(overrides: Partial<ClientZipForm> = {}): ClientZipForm {
  const defaults: ClientZipForm = {
    name: 'online-school',
    shop_id: '123456789',
    mcp_token: 'test-token-123456',
    llm: {
      provider: '',
      model: '',
      base_url: '',
      api_key: '',
    },
    clientMode: 'reference-ui',
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: { display_name: 'Online English School' },
    ui: { ...CLIENT_CONFIG_DEFAULTS.ui },
    limits: { ...CLIENT_CONFIG_DEFAULTS.limits },
    messengers: {
      telegram: {
        enabled: false,
        allowed_user_ids_text: '',
        locale: 'ru',
        bot_token: '',
      },
      max: {
        enabled: false,
        allowed_user_ids_text: '',
        locale: 'ru',
        bot_token: '',
      },
    },
  };

  return {
    ...defaults,
    ...overrides,
    brand: { ...defaults.brand, ...overrides.brand },
    ui: { ...defaults.ui, ...overrides.ui },
    limits: { ...defaults.limits, ...overrides.limits },
    messengers: {
      telegram: {
        ...defaults.messengers.telegram,
        ...overrides.messengers?.telegram,
      },
      max: {
        ...defaults.messengers.max,
        ...overrides.messengers?.max,
      },
    },
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
  it('creates the expected files and keeps only supported brand settings', async () => {
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
    expect(config.brand).toEqual({ display_name: 'Online English School' });
    expect(config).not.toHaveProperty('messengers');
  });

  it('keeps shop credentials in .env and out of config.yaml', async () => {
    const { configYaml, env } = await extractZip();

    expect(env).toContain('YOOKASSA_SHOP_ID="123456789"');
    expect(env).toContain('YOOKASSA_MCP_TOKEN="test-token-123456"');
    expect(configYaml).not.toContain('123456789');
    expect(configYaml).not.toContain('test-token-123456');
  });

  it('exports optional client LLM settings only to .env', async () => {
    const { configYaml, env } = await extractZip(
      validForm({
        llm: {
          provider: 'openai',
          model: 'test-model',
          base_url: 'https://llm.example/v1',
          api_key: 'test-llm-key',
        },
      }),
    );

    expect(env).toContain('LLM_PROVIDER="openai"');
    expect(env).toContain('LLM_MODEL="test-model"');
    expect(env).toContain('LLM_BASE_URL="https://llm.example/v1"');
    expect(env).toContain('LLM_API_KEY="test-llm-key"');
    expect(configYaml).not.toContain('LLM_');
    expect(configYaml).not.toContain('test-llm-key');
  });

  it('omits empty optional LLM settings', async () => {
    const { env } = await extractZip();

    expect(env).not.toContain('LLM_PROVIDER');
    expect(env).not.toContain('LLM_MODEL');
    expect(env).not.toContain('LLM_BASE_URL');
    expect(env).not.toContain('LLM_API_KEY');
  });

  it('exports enabled messenger settings and tokens to the correct files', async () => {
    const form = validForm({
      clientMode: 'messengers',
      messengers: {
        telegram: {
          enabled: true,
          allowed_user_ids_text: ' 101\n202\n101 ',
          locale: 'en',
          bot_token: 'telegram-secret-token',
        },
        max: {
          enabled: true,
          allowed_user_ids_text: '303',
          locale: 'ru',
          bot_token: 'max-secret-token',
        },
      },
    });
    const { configYaml, config, env, readme } = await extractZip(form);

    expect(config).toMatchObject({
      messengers: {
        telegram: {
          enabled: true,
          allowed_user_ids: ['101', '202'],
          locale: 'en',
        },
        max: {
          enabled: true,
          allowed_user_ids: ['303'],
          locale: 'ru',
        },
      },
    });
    expect(config).toMatchObject({ ui: { mode: 'custom-ui' } });
    expect(config).not.toHaveProperty('ui.accent');
    expect(config).not.toHaveProperty('brand');
    expect(env).toContain('TELEGRAM_BOT_TOKEN="telegram-secret-token"');
    expect(env).toContain('MAX_BOT_TOKEN="max-secret-token"');
    expect(configYaml).not.toContain('telegram-secret-token');
    expect(configYaml).not.toContain('max-secret-token');
    expect(readme).toContain(
      'npm run start:messenger',
    );
    expect(readme).toContain('не коммитьте');
  });

  it('does not export disabled messenger tokens', async () => {
    const { env } = await extractZip(
      validForm({
        messengers: {
          telegram: {
            enabled: false,
            allowed_user_ids_text: '',
            locale: 'ru',
            bot_token: 'unused-telegram-token',
          },
          max: {
            enabled: false,
            allowed_user_ids_text: '',
            locale: 'ru',
            bot_token: 'unused-max-token',
          },
        },
      }),
    );

    expect(env).not.toContain('TELEGRAM_BOT_TOKEN');
    expect(env).not.toContain('MAX_BOT_TOKEN');
    expect(env).not.toContain('unused-telegram-token');
    expect(env).not.toContain('unused-max-token');
  });

  it('does not export messenger settings for the Reference UI profile', async () => {
    const { config, env, readme } = await extractZip(
      validForm({
        messengers: {
          telegram: {
            enabled: true,
            allowed_user_ids_text: '101',
            locale: 'ru',
            bot_token: 'telegram-secret-token',
          },
          max: {
            enabled: false,
            allowed_user_ids_text: '',
            locale: 'ru',
            bot_token: '',
          },
        },
      }),
    );

    expect(config).not.toHaveProperty('messengers');
    expect(env).not.toContain('TELEGRAM_BOT_TOKEN');
    expect(env).not.toContain('telegram-secret-token');
    expect(readme).not.toContain('@alekstar79/ykassa-messenger');
  });

  it('writes the default values block to config.yaml', async () => {
    const { configYaml, config } = await extractZip();

    expect(configYaml).toContain('defaults:');
    expect(config).toMatchObject({
      defaults: DEFAULTS_BLOCK_FALLBACK,
    });
  });

  it('writes only the custom UI mode and omits the reference brand', async () => {
    const { config, readme } = await extractZip(
      validForm({
        clientMode: 'custom-ui',
        ui: { ...CLIENT_CONFIG_DEFAULTS.ui, mode: 'custom-ui' },
      }),
    );

    expect(config).toMatchObject({ ui: { mode: 'custom-ui' } });
    expect(config).not.toHaveProperty('ui.accent');
    expect(config).not.toHaveProperty('brand');
    expect(config).not.toHaveProperty('messengers');
    expect(readme).toContain('Запустите API командой `npm run start:api`');
    expect(readme).not.toContain('npm run dev');
    expect(readme).toContain('Разработайте собственный интерфейс');
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
      buildClientZip(
        validForm({
          clientMode: 'messengers',
          messengers: {
            telegram: {
              enabled: true,
              allowed_user_ids_text: '101',
              locale: 'ru',
              bot_token: '',
            },
            max: {
              enabled: false,
              allowed_user_ids_text: '',
              locale: 'ru',
              bot_token: '',
            },
          },
        }),
      ),
    ).rejects.toThrow('telegram bot token is missing or is a placeholder.');
    await expect(
      buildClientZip(
        validForm({
          clientMode: 'messengers',
          messengers: {
            telegram: {
              enabled: true,
              allowed_user_ids_text: '',
              locale: 'ru',
              bot_token: 'telegram-secret-token',
            },
            max: {
              enabled: false,
              allowed_user_ids_text: '',
              locale: 'ru',
              bot_token: '',
            },
          },
        }),
      ),
    ).rejects.toThrow('telegram requires at least one allowed user ID.');
    await expect(
      buildClientZip(validForm({ allowed_scenarios: [] })),
    ).rejects.toThrow('Client configuration is invalid:');
  });

  it('rejects a messenger client without an enabled platform', async () => {
    await expect(
      buildClientZip(validForm({ clientMode: 'messengers' })),
    ).rejects.toThrow('Enable at least one messenger platform.');
  });

  it('writes messenger-only startup instructions', async () => {
    const { readme } = await extractZip(
      validForm({
        clientMode: 'messengers',
        messengers: {
          telegram: {
            enabled: true,
            allowed_user_ids_text: '101',
            locale: 'ru',
            bot_token: 'telegram-secret-token',
          },
          max: {
            enabled: false,
            allowed_user_ids_text: '',
            locale: 'ru',
            bot_token: '',
          },
        },
      }),
    );

    expect(readme).toContain('npm run start:api');
    expect(readme).toContain(
      'npm run start:messenger',
    );
    expect(readme).toContain('API_BASE_URL');
    expect(readme).not.toContain('npm run dev');
    expect(readme).not.toContain('localhost:5173');
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
