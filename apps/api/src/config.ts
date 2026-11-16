import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import * as yaml from 'js-yaml';
import {
  ClientConfigSchema,
  CLIENT_CONFIG_DEFAULTS,
  DEFAULTS_BLOCK_FALLBACK,
  type ClientConfig,
} from '@alekstar79/ykassa-contracts';
import { HttpError, isRecord } from './http.js';

export type {
  ClientAccent,
  ClientConfig,
  ClientDefaults,
  ClientFontPair,
  ClientFormStyle,
  ClientH1Size,
  ClientLimits,
  ClientRadius,
  ClientShadow,
  ClientUiMode,
  ClientUiConfig,
} from '@alekstar79/ykassa-contracts';

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
export const CLIENTS_DIR = path.join(PROJECT_ROOT, 'clients');
export const MCP_SERVER_URL = 'https://mcp.yookassa.ru';

const CLIENT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export interface ClientSecrets {
  shopId: string;
  mcpToken: string;
}

export interface ClientAttachment {
  filename: string;
  content: string;
}

export function validateClientName(value: unknown): string {
  if (value === undefined || value === null) {
    throw new HttpError(
      400,
      'client is required. Pass the tenant name, e.g. {"client":"online-school"}',
    );
  }
  if (typeof value !== 'string' || !CLIENT_NAME_PATTERN.test(value)) {
    throw new HttpError(400, 'client must be a valid client name.');
  }
  return value;
}

export function validateAttachment(
  value: unknown,
  maxAttachmentKb: number = CLIENT_CONFIG_DEFAULTS.limits.max_attachment_kb,
): ClientAttachment | undefined {
  if (value === undefined) return undefined;
  const maxAttachmentBytes = maxAttachmentKb * 1024;
  if (
    !isRecord(value) ||
    typeof value.filename !== 'string' ||
    value.filename.length > 255 ||
    typeof value.content !== 'string' ||
    Buffer.byteLength(value.content, 'utf8') > maxAttachmentBytes
  ) {
    throw new HttpError(
      400,
      `attachment must include a filename of at most 255 characters and text content of at most ${maxAttachmentKb} KB.`,
    );
  }
  return { filename: value.filename, content: value.content };
}

export function parseClientConfig(
  contents: string,
  clientName: string,
): ClientConfig {
  let rawConfig: unknown;
  try {
    rawConfig = yaml.load(contents);
  } catch {
    throw new HttpError(
      500,
      `Configuration for client '${clientName}' is not valid YAML.`,
    );
  }
  if (!isRecord(rawConfig)) {
    throw new HttpError(
      500,
      `Configuration for client '${clientName}' must be a YAML mapping.`,
    );
  }

  const configToParse = Object.hasOwn(rawConfig, 'defaults')
    ? rawConfig
    : { ...rawConfig, defaults: DEFAULTS_BLOCK_FALLBACK };
  const parsed = ClientConfigSchema.safeParse(configToParse);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const section = issue?.path[0];
    if (section === 'allowed_scenarios') {
      throw new HttpError(
        500,
        'Client configuration has an invalid allowed_scenarios list.',
      );
    }
    if (section === 'approval_threshold') {
      throw new HttpError(
        500,
        'Client configuration has an invalid approval_threshold.',
      );
    }
    if (section === 'require_human_confirmation') {
      throw new HttpError(
        500,
        'Client configuration is missing require_human_confirmation.',
      );
    }
    if (section === 'ui' && issue.path.length === 1) {
      throw new HttpError(500, 'Client configuration has an invalid ui block.');
    }
    if (section === 'limits' && issue.path.length === 1) {
      throw new HttpError(
        500,
        'Client configuration has an invalid limits block.',
      );
    }
    const field = issue?.path.join('.') || 'unknown field';
    throw new HttpError(
      500,
      `Client configuration has an invalid ${field}: ${issue?.message ?? 'unknown validation error'}`,
    );
  }

  return parsed.data;
}

export async function loadClientConfig(
  clientName: string,
  clientsDir: string = CLIENTS_DIR,
): Promise<ClientConfig> {
  const configPath = clientFilePath(
    clientsDir,
    clientName,
    'config.yaml',
    'Invalid client configuration path.',
  );

  let contents: string;
  try {
    contents = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      throw new HttpError(
        404,
        `Configuration for client '${clientName}' was not found.`,
      );
    }
    throw error;
  }
  return parseClientConfig(contents, clientName);
}

export async function loadClientSecrets(
  clientName: string,
  clientsDir: string = CLIENTS_DIR,
): Promise<ClientSecrets> {
  const secretsPath = clientFilePath(
    clientsDir,
    clientName,
    '.env',
    'Invalid client secrets path.',
  );
  let contents: string;
  try {
    contents = await readFile(secretsPath, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      throw new HttpError(
        500,
        `Secrets file for client '${clientName}' was not found.`,
      );
    }
    throw error;
  }

  const secrets = parseDotenv(contents);
  const shopId = (secrets.YOOKASSA_SHOP_ID || '').trim();
  const mcpToken = (secrets.YOOKASSA_MCP_TOKEN || '').trim();
  if (!shopId) {
    throw new HttpError(
      500,
      `YOOKASSA_SHOP_ID is missing or empty for client '${clientName}'.`,
    );
  }
  if (!mcpToken) {
    throw new HttpError(
      500,
      `YOOKASSA_MCP_TOKEN is missing or empty for client '${clientName}'.`,
    );
  }
  return { shopId, mcpToken };
}

function clientFilePath(
  clientsDir: string,
  clientName: string,
  fileName: string,
  errorMessage: string,
): string {
  const clientsRoot = path.resolve(clientsDir);
  const filePath = path.resolve(clientsRoot, clientName, fileName);
  const relativePath = path.relative(clientsRoot, filePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new HttpError(400, errorMessage);
  }
  return filePath;
}
