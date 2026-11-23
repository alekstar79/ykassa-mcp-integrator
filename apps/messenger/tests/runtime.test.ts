import { randomUUID } from 'node:crypto';
import { ClientConfigSchema } from '@alekstar79/ykassa-contracts';
import { describe, expect, it, vi } from 'vitest';
import type { MessengerApiClient } from '../src/apiClient.js';
import {
  startMessengerClients,
  type MessengerRuntimeGateway,
} from '../src/runtime.js';
import type {
  Button,
  CallbackHandler,
  MessageHandler,
  MessageRef,
  MessengerAdapter,
  MessengerPlatform,
} from '../src/types.js';

describe('messenger client wiring', () => {
  it('starts enabled transports independently with per-client gateways', async () => {
    const telegramToken = randomUUID();
    const maxToken = randomUUID();
    const configs = new Map([
      ['both-platforms', clientConfig(true, true)],
      ['telegram-only', clientConfig(true, false)],
      ['telegram-without-max-token', clientConfig(true, true)],
      ['disabled', clientConfig(false, false)],
    ]);
    const tokens = new Map([
      ['both-platforms', { telegram: telegramToken, max: maxToken }],
      ['telegram-only', { telegram: randomUUID() }],
      ['telegram-without-max-token', { telegram: randomUUID() }],
    ]);
    const adapters: Array<{
      platform: MessengerPlatform;
      token: string;
      adapter: FakeAdapter;
    }> = [];
    const gatewayOptions: Array<{
      client: string;
      api: MessengerApiClient;
      adapters: MessengerAdapter[];
    }> = [];
    const gateways: MessengerRuntimeGateway[] = [];
    const messages: string[] = [];
    const api: MessengerApiClient = {
      async ask() {
        return { reply: '', requires_approval: false, tool_calls: [] };
      },
      async approve(_approvalId, approved) {
        return {
          reply: '',
          approved,
          requires_approval: false,
          tool_calls: [],
        };
      },
      async getPublicClient() {
        return {
          brand: {},
          allowed_scenarios: [],
          approval_threshold: 0,
        };
      },
    };

    const started = await startMessengerClients(
      { apiBaseUrl: 'http://127.0.0.1:3000', clientsDir: '/clients' },
      {
        async listClients() {
          return [...configs.keys()];
        },
        async loadConfig(client) {
          const config = configs.get(client);
          if (config === undefined) throw new Error('Missing test config.');
          return config;
        },
        async loadTokens(client) {
          return tokens.get(client) ?? {};
        },
        createAdapter(platform, token) {
          const adapter = new FakeAdapter(platform);
          adapters.push({ platform, token, adapter });
          return adapter;
        },
        createApiClient() {
          return api;
        },
        createGateway(options) {
          gatewayOptions.push({
            client: options.client,
            api: options.api,
            adapters: options.adapters,
          });
          const gateway: MessengerRuntimeGateway = {
            start: vi.fn(async () => {}),
            stop: vi.fn(async () => {}),
          };
          gateways.push(gateway);
          return gateway;
        },
        log(message) {
          messages.push(message);
        },
      },
    );

    expect(started.map(({ client }) => client)).toEqual([
      'both-platforms',
      'telegram-only',
      'telegram-without-max-token',
    ]);
    expect(gatewayOptions.map(({ client }) => client)).toEqual([
      'both-platforms',
      'telegram-only',
      'telegram-without-max-token',
    ]);
    expect(gatewayOptions[0]?.adapters.map(({ platform }) => platform)).toEqual([
      'telegram',
      'max',
    ]);
    expect(gatewayOptions[1]?.adapters.map(({ platform }) => platform)).toEqual([
      'telegram',
    ]);
    expect(gatewayOptions[2]?.adapters.map(({ platform }) => platform)).toEqual([
      'telegram',
    ]);
    expect(adapters.map(({ token }) => token)).toContain(telegramToken);
    expect(adapters.map(({ token }) => token)).toContain(maxToken);
    expect(messages.join('\n')).toContain('MAX long polling started');
    expect(messages.join('\n')).toContain("'max': bot token is unavailable");
    expect(messages.join('\n')).toContain('no messenger is enabled');
    expect(messages.join('\n')).not.toContain(telegramToken);
    expect(messages.join('\n')).not.toContain(maxToken);
    expect(gateways).toHaveLength(3);
  });
});

function clientConfig(telegramEnabled: boolean, maxEnabled: boolean) {
  return ClientConfigSchema.parse({
    allowed_scenarios: ['create_payment'],
    approval_threshold: 4000,
    require_human_confirmation: false,
    messengers: {
      telegram: {
        enabled: telegramEnabled,
        allowed_user_ids: [],
        locale: 'ru',
      },
      max: {
        enabled: maxEnabled,
        allowed_user_ids: [],
        locale: 'ru',
      },
    },
  });
}

class FakeAdapter implements MessengerAdapter {
  constructor(readonly platform: MessengerPlatform) {}

  async start(
    _onMessage: MessageHandler,
    _onCallback: CallbackHandler,
  ): Promise<void> {}

  async sendText(
    chatId: string,
    _text: string,
    _buttons?: Button[],
  ): Promise<MessageRef> {
    return { platform: this.platform, chatId, messageId: randomUUID() };
  }

  async editText(
    _ref: MessageRef,
    _text: string,
    _buttons?: Button[],
  ): Promise<void> {}

  async answerCallback(
    _callbackId: string,
    _text?: string,
  ): Promise<void> {}

  async setTyping(_chatId: string): Promise<void> {}

  async stop(): Promise<void> {}
}
