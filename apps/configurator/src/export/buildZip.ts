import JSZip from 'jszip';
import { dump } from 'js-yaml';
import {
  ClientConfigSchema,
  DEFAULTS_BLOCK_FALLBACK,
  type ClientLimits,
  type ClientUiConfig,
} from '@alekstar79/ykassa-contracts';
import type { Locale } from '../i18n';
import { parseAllowedUserIds } from '../messengerConfig';
import type {
  ClientMode,
  ClientMessengerPlatform,
  LlmFormState,
  MessengerFormState,
} from '../types';

export const CLIENT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export interface ClientZipForm {
  name: string;
  shop_id: string;
  mcp_token: string;
  llm: LlmFormState;
  clientMode: ClientMode;
  allowed_scenarios: string[];
  approval_threshold: number | undefined;
  require_human_confirmation: boolean;
  brand: { display_name: string };
  ui: ClientUiConfig;
  limits: ClientLimits;
  messengers: Record<ClientMessengerPlatform, MessengerFormState>;
}

export function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    /^<[^>]*>$/.test(normalized) ||
    normalized.startsWith('your-') ||
    normalized === 'xxx' ||
    normalized.includes('replace-me') ||
    normalized.includes('placeholder')
  );
}

function buildReadme(
  clientName: string,
  locale: Locale,
  clientMode: ClientMode,
  enabledMessengers: ClientMessengerPlatform[],
): string {
  const placement =
    locale === 'ru'
      ? `1. Поместите папку \`${clientName}/\` в каталог \`clients/\` проекта.`
      : `1. Place the \`${clientName}/\` folder in the project's \`clients/\` directory.`;
  const instructionsByMode: Record<ClientMode, string[]> =
    locale === 'ru'
      ? {
          'reference-ui': [
            '2. Запустите API командой `npm run start:api` и интерфейс командой `npm run dev`.',
            '3. Откройте `http://localhost:5173/`; настроенный клиент загрузится автоматически или появится список для выбора.',
          ],
          'custom-ui': [
            '2. Запустите API командой `npm run start:api`.',
            '3. Разработайте собственный интерфейс и подключите его по контракту из `docs/api-contract.md`.',
          ],
          messengers: [
            '2. Запустите API командой `npm run start:api`.',
            '3. Запустите шлюз командой `npm run start:messenger`.',
            `   В \`config.yaml\` включены: ${enabledMessengers.join(', ')}. Разрешённые ID пользователей также указаны в конфиге.`,
            '   Если API и шлюз работают на разных узлах, задайте `API_BASE_URL` в окружении шлюза. Сейчас поддерживаются localhost и приватный IP.',
          ],
        }
      : {
          'reference-ui': [
            '2. Start the API with `npm run start:api` and the UI with `npm run dev`.',
            '3. Open `http://localhost:5173/`; the configured client loads automatically or a selection list is shown.',
          ],
          'custom-ui': [
            '2. Start the API with `npm run start:api`.',
            '3. Build your own UI and connect it using the contract in `docs/api-contract.md`.',
          ],
          messengers: [
            '2. Start the API with `npm run start:api`.',
            '3. Start the gateway with `npm run start:messenger`.',
            `   Enabled platforms: ${enabledMessengers.join(', ')}. Allowed user IDs are also in \`config.yaml\`.`,
            '   If the API and gateway run on different hosts, set `API_BASE_URL` in the gateway environment. Only localhost and private IPs are currently supported.',
          ],
        };
  const secretsWarning =
    locale === 'ru'
      ? 'Архив содержит секреты в `.env`. Храните его в безопасном месте и не коммитьте этот файл.'
      : 'The archive contains secrets in `.env`. Store it securely and do not commit this file.';
  const llmEnvironmentHint =
    locale === 'ru'
      ? 'Параметры LLM в `.env` клиента имеют приоритет; незаданные поля берутся из корневого `.env`.'
      : 'LLM settings in the client `.env` take precedence; unset fields use the root `.env`.';
  const header = [`# ${clientName}`, '', placement];

  return `${[
    ...header,
    ...instructionsByMode[clientMode],
    '',
    llmEnvironmentHint,
    '',
    secretsWarning,
  ].join('\n')}\n`;
}

function quoteEnvValue(value: string): string {
  return JSON.stringify(value.trim());
}

export async function buildClientZip(
  form: ClientZipForm,
  locale: Locale = 'ru',
): Promise<Blob> {
  const clientName = form.name.trim();
  const shopId = form.shop_id.trim();
  const mcpToken = form.mcp_token.trim();
  const messengers = {
    telegram: {
      enabled: form.messengers.telegram.enabled,
      allowed_user_ids: parseAllowedUserIds(
        form.messengers.telegram.allowed_user_ids_text,
      ),
      locale: form.messengers.telegram.locale,
    },
    max: {
      enabled: form.messengers.max.enabled,
      allowed_user_ids: parseAllowedUserIds(
        form.messengers.max.allowed_user_ids_text,
      ),
      locale: form.messengers.max.locale,
    },
  };

  if (!CLIENT_NAME_PATTERN.test(clientName)) {
    throw new Error('Client name must be a lowercase slug.');
  }
  if (!shopId || isPlaceholderSecret(shopId)) {
    throw new Error('Shop ID is missing or is a placeholder.');
  }
  if (!mcpToken || isPlaceholderSecret(mcpToken)) {
    throw new Error('MCP token is missing or is a placeholder.');
  }

  const enabledMessengers =
    form.clientMode === 'messengers'
      ? (['telegram', 'max'] as const).filter(
          (platform) => form.messengers[platform].enabled,
        )
      : [];
  if (form.clientMode === 'messengers' && enabledMessengers.length === 0) {
    throw new Error('Enable at least one messenger platform.');
  }

  for (const platform of enabledMessengers) {
    const messenger = form.messengers[platform];
    const botToken = messenger.bot_token.trim();
    if (!botToken || isPlaceholderSecret(botToken)) {
      throw new Error(`${platform} bot token is missing or is a placeholder.`);
    }
    if (messengers[platform].allowed_user_ids.length === 0) {
      throw new Error(`${platform} requires at least one allowed user ID.`);
    }
  }

  const brand = {
    ...(form.brand.display_name?.trim()
      ? { display_name: form.brand.display_name.trim() }
      : {}),
  };
  const parsed = ClientConfigSchema.safeParse({
    allowed_scenarios: form.allowed_scenarios,
    approval_threshold: form.approval_threshold,
    require_human_confirmation: form.require_human_confirmation,
    limits: form.limits,
    defaults: DEFAULTS_BLOCK_FALLBACK,
    ui:
      form.clientMode === 'reference-ui'
        ? form.ui
        : { mode: 'custom-ui' },
    ...(form.clientMode === 'messengers' ? { messengers } : {}),
    ...(form.clientMode === 'reference-ui' && Object.keys(brand).length > 0
      ? { brand }
      : {}),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Client configuration is invalid: ${details}`);
  }

  const ui =
    form.clientMode === 'reference-ui'
      ? {
          mode: 'reference-ui' as const,
          accent: parsed.data.ui.accent,
          radius: parsed.data.ui.radius,
          shadow: parsed.data.ui.shadow,
          font_pair: parsed.data.ui.font_pair,
          form_style: parsed.data.ui.form_style,
          h1_size: parsed.data.ui.h1_size,
        }
      : { mode: 'custom-ui' as const };
  const config = {
    allowed_scenarios: parsed.data.allowed_scenarios,
    approval_threshold: parsed.data.approval_threshold,
    require_human_confirmation: parsed.data.require_human_confirmation,
    limits: {
      max_messages: parsed.data.limits.max_messages,
      max_attachment_kb: parsed.data.limits.max_attachment_kb,
    },
    defaults: { ...DEFAULTS_BLOCK_FALLBACK },
    ...(form.clientMode === 'messengers' ? { messengers } : {}),
    ui,
    ...(form.clientMode === 'reference-ui' && Object.keys(brand).length > 0
      ? { brand }
      : {}),
  };
  const envComment =
    locale === 'ru'
      ? '# Секреты и настройки клиента. Не коммитить. Файл должен лежать в clients/<name>/.env'
      : '# Client secrets and settings. Do not commit. Place at clients/<name>/.env';
  const llmEntries = [
    ['LLM_PROVIDER', form.llm.provider],
    ['LLM_MODEL', form.llm.model],
    ['LLM_BASE_URL', form.llm.base_url],
    ['LLM_API_KEY', form.llm.api_key],
  ] as const;
  const envFile = [
    envComment,
    `YOOKASSA_SHOP_ID=${quoteEnvValue(shopId)}`,
    `YOOKASSA_MCP_TOKEN=${quoteEnvValue(mcpToken)}`,
    '# Optional LLM settings; each client value overrides the root .env.',
    ...llmEntries
      .filter(([, value]) => value.trim().length > 0)
      .map(([name, value]) => `${name}=${quoteEnvValue(value)}`),
    ...(form.clientMode === 'messengers' && messengers.telegram.enabled
      ? [
          `TELEGRAM_BOT_TOKEN=${quoteEnvValue(form.messengers.telegram.bot_token)}`,
        ]
      : []),
    ...(form.clientMode === 'messengers' && messengers.max.enabled
      ? [`MAX_BOT_TOKEN=${quoteEnvValue(form.messengers.max.bot_token)}`]
      : []),
    '',
  ].join('\n');

  const archive = new JSZip();
  const clientFolder = archive.folder(clientName);
  if (!clientFolder) {
    throw new Error('Could not create the client folder in the archive.');
  }

  clientFolder.file('config.yaml', dump(config));
  clientFolder.file('.env', envFile);
  clientFolder.file(
    'README.md',
    buildReadme(
      clientName,
      locale,
      form.clientMode,
      enabledMessengers,
    ),
  );

  return archive.generateAsync({ type: 'blob' });
}
