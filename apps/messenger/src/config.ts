import { readFile, readdir, access } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';
import { load as loadYaml } from 'js-yaml';
import {
  ClientConfigSchema,
  DEFAULTS_BLOCK_FALLBACK,
  type ClientConfig,
} from '@alekstar79/ykassa-contracts';
import type { MessengerPlatform } from './types.js';

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const CLIENT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export interface MessengerRuntimeConfig {
  apiBaseUrl: string;
  clientsDir: string;
}

export type MessengerTokens = Partial<Record<MessengerPlatform, string>>;

export class MessengerConfigError extends Error {
  constructor(
    readonly status: 400 | 404 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'MessengerConfigError';
  }
}

export function getMessengerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MessengerRuntimeConfig {
  const apiBaseUrl = (env.API_BASE_URL ?? 'http://127.0.0.1:3000').trim();
  let apiUrl: URL;
  try {
    apiUrl = new URL(apiBaseUrl);
  } catch {
    throw new MessengerConfigError(500, 'API_BASE_URL must be a valid URL.');
  }
  if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
    throw new MessengerConfigError(
      500,
      'API_BASE_URL must use http or https.',
    );
  }
  if (
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.pathname !== '/' ||
    !isPrivateHost(apiUrl.hostname)
  ) {
    throw new MessengerConfigError(
      500,
      'API_BASE_URL must be a localhost or private-network origin without credentials or a path.',
    );
  }

  const clientsDirValue = (env.CLIENTS_DIR ?? './clients').trim();
  if (!clientsDirValue) {
    throw new MessengerConfigError(500, 'CLIENTS_DIR must not be empty.');
  }

  return {
    apiBaseUrl: apiUrl.toString().replace(/\/+$/, ''),
    clientsDir: path.resolve(PROJECT_ROOT, clientsDirValue),
  };
}

export function validateClientName(value: unknown): string {
  if (typeof value !== 'string' || !CLIENT_NAME_PATTERN.test(value)) {
    throw new MessengerConfigError(400, 'Client name is invalid.');
  }
  return value;
}

export async function loadMessengerClientConfig(
  name: string,
  clientsDir: string = getMessengerRuntimeConfig().clientsDir,
): Promise<ClientConfig> {
  const clientName = validateClientName(name);
  let contents: string;
  try {
    contents = await readFile(
      path.join(clientsDir, clientName, 'config.yaml'),
      'utf8',
    );
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw new MessengerConfigError(
        404,
        `Configuration for client '${clientName}' was not found.`,
      );
    }
    throw error;
  }

  let rawConfig: unknown;
  try {
    rawConfig = loadYaml(contents);
  } catch {
    throw new MessengerConfigError(
      500,
      `Configuration for client '${clientName}' is not valid YAML.`,
    );
  }
  if (!isRecord(rawConfig)) {
    throw new MessengerConfigError(
      500,
      `Configuration for client '${clientName}' must be a YAML mapping.`,
    );
  }

  const configToParse = Object.hasOwn(rawConfig, 'defaults')
    ? rawConfig
    : { ...rawConfig, defaults: DEFAULTS_BLOCK_FALLBACK };
  const parsed = ClientConfigSchema.safeParse(configToParse);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join('.') || 'unknown field';
    throw new MessengerConfigError(
      500,
      `Configuration for client '${clientName}' has an invalid ${field}.`,
    );
  }
  return parsed.data;
}

export async function loadMessengerTokens(
  name: string,
  clientsDir: string = getMessengerRuntimeConfig().clientsDir,
): Promise<MessengerTokens> {
  const clientName = validateClientName(name);
  const config = await loadMessengerClientConfig(clientName, clientsDir);
  const enabledPlatforms: MessengerPlatform[] = [];
  if (config.messengers?.telegram.enabled) enabledPlatforms.push('telegram');
  if (config.messengers?.max.enabled) enabledPlatforms.push('max');
  if (enabledPlatforms.length === 0) return {};

  let contents: string;
  try {
    contents = await readFile(
      path.join(clientsDir, clientName, '.env'),
      'utf8',
    );
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw new MessengerConfigError(
        500,
        `Secrets file for client '${clientName}' was not found.`,
      );
    }
    throw error;
  }

  const parsed = parseDotenv(contents);
  const tokens: MessengerTokens = {};
  for (const platform of enabledPlatforms) {
    const variable =
      platform === 'telegram' ? 'TELEGRAM_BOT_TOKEN' : 'MAX_BOT_TOKEN';
    const token = parsed[variable]?.trim();
    if (token) tokens[platform] = token;
  }
  return tokens;
}

export async function listClients(
  clientsDir: string = getMessengerRuntimeConfig().clientsDir,
): Promise<string[]> {
  const entries = await readdir(clientsDir, { withFileTypes: true });
  const clients: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !CLIENT_NAME_PATTERN.test(entry.name)) continue;
    try {
      await access(path.join(clientsDir, entry.name, 'config.yaml'));
      clients.push(entry.name);
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) throw error;
    }
  }
  return clients.sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasErrorCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  const family = isIP(host);
  if (family === 4) {
    const [first, second] = host.split('.').map(Number);
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (family === 6) {
    return (
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:')
    );
  }
  return false;
}
