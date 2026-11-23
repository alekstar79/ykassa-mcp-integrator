import { createApiClient, type MessengerApiClient } from './apiClient.js';
import {
  getMessengerRuntimeConfig,
  listClients,
  loadMessengerClientConfig,
  loadMessengerTokens,
  type MessengerRuntimeConfig,
} from './config.js';
import { MessengerGateway, type GatewayOptions } from './gateway.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { MaxAdapter } from './adapters/max.js';
import type { MessengerAdapter, MessengerPlatform } from './types.js';

export interface MessengerRuntimeGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface MessengerRuntimeDependencies {
  listClients(clientsDir: string): Promise<string[]>;
  loadConfig(client: string, clientsDir: string): ReturnType<typeof loadMessengerClientConfig>;
  loadTokens(client: string, clientsDir: string): ReturnType<typeof loadMessengerTokens>;
  createAdapter(
    platform: MessengerPlatform,
    token: string,
    maxAttachmentKb: number,
  ): MessengerAdapter;
  createApiClient(baseUrl: string): MessengerApiClient;
  createGateway(options: GatewayOptions): MessengerRuntimeGateway;
  log(message: string): void;
}

export interface StartedMessengerClient {
  client: string;
  gateway: MessengerRuntimeGateway;
}

const PLATFORMS: MessengerPlatform[] = ['telegram', 'max'];

export async function startMessengerClients(
  runtime: MessengerRuntimeConfig = getMessengerRuntimeConfig(),
  overrides: Partial<MessengerRuntimeDependencies> = {},
): Promise<StartedMessengerClient[]> {
  const dependencies: MessengerRuntimeDependencies = {
    listClients,
    loadConfig: loadMessengerClientConfig,
    loadTokens: loadMessengerTokens,
    createAdapter: (platform, token, maxAttachmentKb) =>
      platform === 'telegram'
        ? new TelegramAdapter(token)
        : new MaxAdapter(token, { maxAttachmentKb }),
    createApiClient,
    createGateway: (options) => new MessengerGateway(options),
    log: (message) => console.info(message),
    ...overrides,
  };
  const started: StartedMessengerClient[] = [];

  for (const client of await dependencies.listClients(runtime.clientsDir)) {
    let config;
    try {
      config = await dependencies.loadConfig(client, runtime.clientsDir);
    } catch (error) {
      dependencies.log(
        `Skipping client '${client}': configuration could not be loaded (${safeErrorMessage(error)}).`,
      );
      continue;
    }

    const enabledPlatforms = PLATFORMS.filter(
      (platform) => config.messengers?.[platform].enabled === true,
    );
    if (enabledPlatforms.length === 0) {
      dependencies.log(`Skipping client '${client}': no messenger is enabled.`);
      continue;
    }

    let tokens;
    try {
      tokens = await dependencies.loadTokens(client, runtime.clientsDir);
    } catch (error) {
      dependencies.log(
        `Skipping client '${client}': messenger tokens are unavailable (${safeErrorMessage(error)}).`,
      );
      continue;
    }

    const adapters: MessengerAdapter[] = [];
    for (const platform of enabledPlatforms) {
      const token = tokens[platform];
      if (token === undefined) {
        dependencies.log(
          `Skipping client '${client}' on '${platform}': bot token is unavailable.`,
        );
        continue;
      }
      adapters.push(
        dependencies.createAdapter(
          platform,
          token,
          config.limits.max_attachment_kb,
        ),
      );
    }
    if (adapters.length === 0) continue;

    const api = dependencies.createApiClient(runtime.apiBaseUrl);
    const gateway = dependencies.createGateway({
      client,
      api,
      adapters,
      loadConfig: () =>
        dependencies.loadConfig(client, runtime.clientsDir),
    });
    try {
      await gateway.start();
      started.push({ client, gateway });
      for (const adapter of adapters) {
        dependencies.log(
          `${adapter.platform === 'max' ? 'MAX long polling' : 'Telegram polling'} started for client '${client}'.`,
        );
      }
    } catch (error) {
      await gateway.stop();
      dependencies.log(
        `Skipping client '${client}': messenger gateway could not be started (${safeErrorMessage(error)}).`,
      );
    }
  }
  return started;
}

export async function stopMessengerClients(
  clients: StartedMessengerClient[],
): Promise<void> {
  const results = await Promise.allSettled(
    clients.map(({ gateway }) => gateway.stop()),
  );
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      'One or more messenger gateways failed to stop.',
    );
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'unknown error';
}
