import JSZip from 'jszip';
import { dump } from 'js-yaml';
import {
  ClientConfigSchema,
  type ClientLimits,
  type ClientUiConfig,
} from '@alekstar79/ykassa-contracts';
import type { Locale } from '../i18n';

export const CLIENT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export interface ClientZipForm {
  name: string;
  shop_id: string;
  mcp_token: string;
  allowed_scenarios: string[];
  approval_threshold: number | undefined;
  require_human_confirmation: boolean;
  brand: { display_name: string };
  ui: ClientUiConfig;
  limits: ClientLimits;
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

function buildReadme(clientName: string, locale: Locale, customUi: boolean): string {
  const instructions =
    locale === 'ru'
      ? [
          `# ${clientName}`,
          '',
          `1. Поместите папку \`${clientName}/\` в каталог \`clients/\` проекта.`,
          '2. Запустите API командой `npm run start:api` и интерфейс командой `npm run dev`.',
          `3. Откройте \`http://localhost:5173/?client=${clientName}\`.`,
        ]
      : [
          `# ${clientName}`,
          '',
          `1. Place the \`${clientName}/\` folder in the project's \`clients/\` directory.`,
          '2. Start the API with `npm run start:api` and the UI with `npm run dev`.',
          `3. Open \`http://localhost:5173/?client=${clientName}\`.`,
        ];

  if (customUi) {
    instructions.push(
      '',
      locale === 'ru'
        ? 'Ваш UI работает по контракту `/api/ask`, `/api/approve`, `/api/clients/:name/public`. См. `docs/api-contract.md`.'
        : 'Your UI uses the `/api/ask`, `/api/approve`, and `/api/clients/:name/public` contracts. See `docs/api-contract.md`.',
    );
  }

  return `${instructions.join('\n')}\n`;
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

  if (!CLIENT_NAME_PATTERN.test(clientName)) {
    throw new Error('Client name must be a lowercase slug.');
  }
  if (!shopId || isPlaceholderSecret(shopId)) {
    throw new Error('Shop ID is missing or is a placeholder.');
  }
  if (!mcpToken || isPlaceholderSecret(mcpToken)) {
    throw new Error('MCP token is missing or is a placeholder.');
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
    ui: form.ui,
    ...(form.ui.mode === 'reference-ui' && Object.keys(brand).length > 0
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
    parsed.data.ui.mode === 'custom-ui'
      ? { mode: 'custom-ui' as const }
      : {
          mode: 'reference-ui' as const,
          accent: parsed.data.ui.accent,
          radius: parsed.data.ui.radius,
          shadow: parsed.data.ui.shadow,
          font_pair: parsed.data.ui.font_pair,
          form_style: parsed.data.ui.form_style,
          h1_size: parsed.data.ui.h1_size,
        };
  const config = {
    allowed_scenarios: parsed.data.allowed_scenarios,
    approval_threshold: parsed.data.approval_threshold,
    require_human_confirmation: parsed.data.require_human_confirmation,
    limits: {
      max_messages: parsed.data.limits.max_messages,
      max_attachment_kb: parsed.data.limits.max_attachment_kb,
    },
    ui,
    ...(parsed.data.ui.mode === 'reference-ui' && Object.keys(brand).length > 0
      ? { brand }
      : {}),
  };
  const envComment =
    locale === 'ru'
      ? '# Секреты. Не коммитить. Файл должен лежать в clients/<name>/.env'
      : '# Secrets. Do not commit. Place this file at clients/<name>/.env';
  const envFile = [
    envComment,
    `YOOKASSA_SHOP_ID=${quoteEnvValue(shopId)}`,
    `YOOKASSA_MCP_TOKEN=${quoteEnvValue(mcpToken)}`,
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
    buildReadme(clientName, locale, parsed.data.ui.mode === 'custom-ui'),
  );

  return archive.generateAsync({ type: 'blob' });
}
