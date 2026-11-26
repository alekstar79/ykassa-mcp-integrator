import { ClientConfigSchema } from '@alekstar79/ykassa-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  type ApprovalRequiredResponse,
  type AskResponse,
  type MessengerApiClient,
} from '../src/apiClient.js';
import {
  ApprovalRegistry,
} from '../src/approvals.js';
import type { MessengerAuditEntry } from '../src/audit.js';
import { MessengerGateway } from '../src/gateway.js';
import { SessionStore } from '../src/session.js';
import { MessageThrottle } from '../src/throttle.js';
import type {
  Button,
  CallbackEvent,
  CallbackHandler,
  IncomingMessage,
  MessageHandler,
  MessageRef,
  MessengerAdapter,
  MessengerPlatform,
} from '../src/types.js';

const CONFIRMATION_RESULT =
  '{"id":"328cced3-000f-5000-b000-1c3c6e443b7b","status":"pending","amount":{"value":"100.00","currency":"RUB"},"confirmation_url":"https://yoomoney.ru/checkout/payments/v2/contract?orderId=328cced3-000f-5000-b000-1c3c6e443b7b","description":"Счёт за тест","created_at":"2026-11-16T08:13:07.101Z"}';

afterEach(() => vi.useRealTimers());

function messengerConfig(allowedUserIds = ['user-1']) {
  return ClientConfigSchema.parse({
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: true,
    limits: { max_messages: 3, max_attachment_kb: 10 },
    messengers: {
      telegram: {
        enabled: true,
        allowed_user_ids: allowedUserIds,
        locale: 'en',
      },
      max: { enabled: true, allowed_user_ids: allowedUserIds, locale: 'en' },
    },
  });
}

function completeResponse(
  toolCalls: AskResponse['tool_calls'] = [],
): AskResponse {
  return {
    reply: 'Payment request processed.',
    requires_approval: false,
    tool_calls: toolCalls,
  };
}

function approvalResponse(approvalId: string): ApprovalRequiredResponse {
  return {
    reply: 'Please review this payment.',
    requires_approval: true,
    approval_id: approvalId,
    proposed_action: {
      tool: 'create_payment',
      args: { amount: { value: '100.00', currency: 'RUB' } },
      requires_confirmation: true,
    },
    proposed_actions: [
      {
        tool: 'create_payment',
        args: { amount: { value: '100.00', currency: 'RUB' } },
        requires_confirmation: true,
      },
    ],
    tool_calls: [],
  };
}

class FakeAdapter implements MessengerAdapter {
  readonly sent: Array<{
    chatId: string;
    text: string;
    buttons?: Button[];
    ref: MessageRef;
  }> = [];
  readonly edits: Array<{
    ref: MessageRef;
    text: string;
    buttons?: Button[];
  }> = [];
  readonly answers: Array<{ callbackId: string; text?: string }> = [];
  typingChats: string[] = [];
  private nextMessageId = 0;
  private onMessage?: MessageHandler;
  private onCallback?: CallbackHandler;

  constructor(readonly platform: MessengerPlatform = 'telegram') {}

  async start(
    onMessage: MessageHandler,
    onCallback: CallbackHandler,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onCallback = onCallback;
  }

  async sendText(
    chatId: string,
    text: string,
    buttons?: Button[],
  ): Promise<MessageRef> {
    const ref: MessageRef = {
      platform: this.platform,
      chatId,
      messageId: `message-${++this.nextMessageId}`,
    };
    this.sent.push({
      chatId,
      text,
      ...(buttons === undefined ? {} : { buttons }),
      ref,
    });
    return ref;
  }

  async editText(
    ref: MessageRef,
    text: string,
    buttons?: Button[],
  ): Promise<void> {
    this.edits.push({
      ref,
      text,
      ...(buttons === undefined ? {} : { buttons }),
    });
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    this.answers.push({
      callbackId,
      ...(text === undefined ? {} : { text }),
    });
  }

  async setTyping(chatId: string): Promise<void> {
    this.typingChats.push(chatId);
  }

  async stop(): Promise<void> {}

  async receive(message: IncomingMessage): Promise<void> {
    if (this.onMessage === undefined) throw new Error('Adapter was not started.');
    await this.onMessage(message);
  }

  async callback(event: CallbackEvent): Promise<void> {
    if (this.onCallback === undefined) throw new Error('Adapter was not started.');
    await this.onCallback(event);
  }
}

function createHarness(options: {
  config?: ReturnType<typeof messengerConfig>;
  allowedUserIds?: string[];
  askResponse?: AskResponse;
  ask?: MessengerApiClient['ask'];
  approve?: MessengerApiClient['approve'];
} = {}) {
  let config = options.config ?? messengerConfig(options.allowedUserIds);
  let askResponse = options.askResponse ?? completeResponse();
  const askCalls: Array<{
    client: string;
    messages: Array<{ role: 'user'; content: string }>;
    attachment?: { filename: string; content: string };
    sessionId?: string;
  }> = [];
  const approveCalls: Array<{ approvalId: string; approved: boolean }> = [];
  const auditEntries: MessengerAuditEntry[] = [];
  const adapter = new FakeAdapter();
  const api: MessengerApiClient = {
    async ask(client, messages, attachment, sessionId) {
      askCalls.push({
        client,
        messages,
        ...(attachment === undefined ? {} : { attachment }),
        ...(sessionId === undefined ? {} : { sessionId }),
      });
      if (options.ask !== undefined) {
        return options.ask(client, messages, attachment, sessionId);
      }
      return askResponse;
    },
    async approve(approvalId, approved) {
      approveCalls.push({ approvalId, approved });
      if (options.approve !== undefined) {
        return options.approve(approvalId, approved);
      }
      return {
        reply: 'Payment approved.',
        approved,
        requires_approval: false,
        tool_calls: [],
      };
    },
    async getPublicClient() {
      return {
        brand: { display_name: 'Online School' },
        allowed_scenarios: ['create_payment'],
        approval_threshold: 1000,
      };
    },
  };
  const sessions = new SessionStore(3);
  const approvals = new ApprovalRegistry();
  const gateway = new MessengerGateway({
    client: 'online-school',
    api,
    adapters: [adapter],
    loadConfig: async () => config,
    audit: {
      async append(entry) {
        auditEntries.push(entry);
      },
    },
    sessions,
    approvals,
    throttle: new MessageThrottle(0),
  });

  return {
    gateway,
    adapter,
    sessions,
    approvals,
    api,
    askCalls,
    approveCalls,
    auditEntries,
    setAskResponse(response: AskResponse) {
      askResponse = response;
    },
    setConfig(nextConfig: ReturnType<typeof messengerConfig>) {
      config = nextConfig;
    },
  };
}

function incoming(
  overrides: Partial<IncomingMessage> = {},
): IncomingMessage {
  return {
    platform: 'telegram',
    chatId: 'chat-1',
    userId: 'user-1',
    isPrivate: true,
    text: 'Create a payment link',
    ...overrides,
  };
}

describe('MessengerGateway', () => {
  it('denies users outside the allowlist without calling the API', async () => {
    const harness = createHarness();
    await harness.gateway.start();

    await harness.adapter.receive(incoming({ userId: 'user-2' }));

    expect(harness.askCalls).toEqual([]);
    expect(harness.adapter.sent.at(-1)?.text).toBe('Access denied.');
    expect(harness.auditEntries.at(-1)?.event).toBe('message_denied');
  });

  it('does not process messages in group chats', async () => {
    const harness = createHarness();
    await harness.gateway.start();

    await harness.adapter.receive(incoming({ isPrivate: false }));

    expect(harness.askCalls).toEqual([]);
    expect(harness.adapter.sent).toEqual([]);
  });

  it('sends an allowed ask and renders its confirmation link as a button', async () => {
    const harness = createHarness({
      askResponse: completeResponse([
        { name: 'create_payment', result: CONFIRMATION_RESULT },
      ]),
    });
    await harness.gateway.start();

    await harness.adapter.receive(incoming());

    expect(harness.askCalls[0]).toMatchObject({
      client: 'online-school',
      messages: [{ role: 'user', content: 'Create a payment link' }],
    });
    expect(harness.adapter.typingChats).toEqual(['chat-1']);
    expect(harness.adapter.edits.at(-1)?.buttons).toEqual([
      {
        kind: 'url',
        label: 'Pay',
        url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=328cced3-000f-5000-b000-1c3c6e443b7b',
      },
    ]);
  });

  it('creates an approval card and edits it after the initiating user approves', async () => {
    const harness = createHarness({
      askResponse: approvalResponse('approval-1'),
    });
    await harness.gateway.start();
    await harness.adapter.receive(incoming());

    const approvalMessage = harness.adapter.edits.at(-1);
    expect(approvalMessage?.buttons?.[0]).toEqual({
      kind: 'callback',
      label: 'Approve',
      data: 'apr:approval-1:y',
    });
    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: approvalMessage?.ref.messageId ?? '',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });

    expect(harness.approveCalls).toEqual([
      { approvalId: 'approval-1', approved: true },
    ]);
    expect(harness.adapter.edits.at(-1)).toMatchObject({
      ref: approvalMessage?.ref,
      text: 'Payment approved.',
    });
    expect(harness.adapter.edits.at(-1)?.buttons).toEqual([]);
  });

  it('replaces an approval card when approve returns another 202', async () => {
    let approveCount = 0;
    const harness = createHarness({
      askResponse: approvalResponse('approval-1'),
      approve: async (approvalId, approved) => {
        approveCount += 1;
        if (approveCount === 1) return approvalResponse('approval-2');
        return {
          reply: 'Payment approved.',
          approved,
          requires_approval: false,
          tool_calls: [],
        };
      },
    });
    await harness.gateway.start();
    await harness.adapter.receive(incoming());
    const initialRef = harness.adapter.edits.at(-1)?.ref;

    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: initialRef?.messageId ?? '',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });

    expect(harness.adapter.edits.at(-1)?.buttons).toContainEqual({
      kind: 'callback',
      label: 'Approve',
      data: 'apr:approval-2:y',
    });
    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: initialRef?.messageId ?? '',
      callbackId: 'callback-2',
      data: 'apr:approval-2:y',
      isPrivate: true,
    });
    expect(harness.approveCalls).toHaveLength(2);
    expect(harness.adapter.edits.at(-1)?.buttons).toEqual([]);
  });

  it('rechecks the allowlist and approval initiator before calling approve', async () => {
    const harness = createHarness({
      allowedUserIds: ['user-1', 'user-2'],
      askResponse: approvalResponse('approval-1'),
    });
    await harness.gateway.start();
    await harness.adapter.receive(incoming());
    const message = harness.adapter.edits.at(-1);

    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-2',
      messageId: message?.ref.messageId ?? '',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });

    expect(harness.approveCalls).toEqual([]);
    expect(harness.adapter.answers.at(-1)?.text).toContain(
      'Only the request initiator',
    );
    expect(harness.approvals.size).toBe(1);
  });

  it('rechecks the current sender allowlist when an approval callback arrives', async () => {
    const harness = createHarness({
      askResponse: approvalResponse('approval-1'),
    });
    await harness.gateway.start();
    await harness.adapter.receive(incoming());
    const message = harness.adapter.edits.at(-1);
    harness.setConfig(messengerConfig(['user-2']));

    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: message?.ref.messageId ?? '',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });

    expect(harness.approveCalls).toEqual([]);
    expect(harness.adapter.answers.at(-1)?.text).toBe('Access denied.');
    expect(harness.approvals.size).toBe(1);
  });

  it('maps approval API errors to localized text and disables the old buttons', async () => {
    const harness = createHarness({
      askResponse: approvalResponse('approval-1'),
      approve: async () => {
        throw new ApiClientError(410, 'expired');
      },
    });
    await harness.gateway.start();
    await harness.adapter.receive(incoming());
    const message = harness.adapter.sent.at(-1);

    await harness.adapter.callback({
      platform: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: message?.ref.messageId ?? '',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });

    expect(harness.adapter.edits.at(-1)).toMatchObject({
      text: 'The approval has expired.',
    });
    expect(harness.adapter.edits.at(-1)?.buttons).toEqual([]);
  });

  it('implements /reset without carrying earlier messages into the next ask', async () => {
    const harness = createHarness();
    await harness.gateway.start();
    await harness.adapter.receive(incoming({ text: 'first request' }));
    await harness.adapter.receive(incoming({ text: '/reset' }));
    await harness.adapter.receive(incoming({ text: 'second request' }));

    expect(harness.askCalls.map((call) => call.messages)).toEqual([
      [{ role: 'user', content: 'first request' }],
      [{ role: 'user', content: 'second request' }],
    ]);
    expect(harness.adapter.sent.some((item) => item.text === 'The pending request was cleared.'))
      .toBe(true);
  });

  it('does not replay an earlier payment request in a later status ask', async () => {
    const harness = createHarness();
    await harness.gateway.start();
    await harness.adapter.receive(
      incoming({ text: 'Create a payment link for 100 RUB.' }),
    );
    await harness.adapter.receive(
      incoming({ text: 'Show the status of payment pay-123.' }),
    );

    expect(harness.askCalls.map((call) => call.messages)).toEqual([
      [{ role: 'user', content: 'Create a payment link for 100 RUB.' }],
      [{ role: 'user', content: 'Show the status of payment pay-123.' }],
    ]);
    expect(harness.askCalls[1]?.sessionId).toBe(
      harness.askCalls[0]?.sessionId,
    );
  });

  it('pairs a MAX file request with the following separate attachment', async () => {
    vi.useFakeTimers();
    const maxAdapter = new FakeAdapter('max');
    const config = messengerConfig();
    const harness = createHarness({ config });
    const maxGateway = new MessengerGateway({
      client: 'online-school',
      api: harness.api,
      adapters: [maxAdapter],
      loadConfig: async () => config,
      audit: { append: async () => undefined },
      sessions: new SessionStore(3),
      approvals: new ApprovalRegistry(),
      throttle: new MessageThrottle(0),
    });
    await maxGateway.start();

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: 'Создай ссылки на оплату для всех учеников из файла.',
      }),
    );
    expect(harness.askCalls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(
      maxAdapter.sent.some((item) => item.text.includes('Waiting for the file')),
    ).toBe(false);

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: undefined,
        attachment: {
          filename: 'students.csv',
          content: new TextEncoder().encode('name,amount'),
          bytes: 11,
        },
      }),
    );

    expect(harness.askCalls).toHaveLength(1);
    expect(harness.askCalls[0]).toMatchObject({
      messages: [
        {
          role: 'user',
          content: 'Создай ссылки на оплату для всех учеников из файла.',
        },
      ],
      attachment: { filename: 'students.csv', content: 'name,amount' },
    });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(
      maxAdapter.sent.some((item) => item.text.includes('Waiting for the file')),
    ).toBe(false);
  });

  it('asks for an attachment after a text-only file request remains unmatched', async () => {
    vi.useFakeTimers();
    const maxAdapter = new FakeAdapter('max');
    const config = messengerConfig();
    const harness = createHarness({ config });
    const maxGateway = new MessengerGateway({
      client: 'online-school',
      api: harness.api,
      adapters: [maxAdapter],
      loadConfig: async () => config,
      audit: { append: async () => undefined },
      sessions: new SessionStore(3),
      approvals: new ApprovalRegistry(),
      throttle: new MessageThrottle(0),
    });
    await maxGateway.start();

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: 'Создай ссылки на оплату для всех учеников из файла.',
      }),
    );
    expect(
      maxAdapter.sent.some((item) => item.text.includes('Waiting for the file')),
    ).toBe(false);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(maxAdapter.sent.at(-1)?.text).toContain('Waiting for the file');
    expect(harness.askCalls).toHaveLength(0);
  });

  it('processes a MAX request with its attached file without asking for the file', async () => {
    const maxAdapter = new FakeAdapter('max');
    const config = messengerConfig();
    const harness = createHarness({
      config,
      askResponse: approvalResponse('approval-inline'),
    });
    const maxGateway = new MessengerGateway({
      client: 'online-school',
      api: harness.api,
      adapters: [maxAdapter],
      loadConfig: async () => config,
      audit: { append: async () => undefined },
      sessions: new SessionStore(3),
      approvals: new ApprovalRegistry(),
      throttle: new MessageThrottle(0),
    });
    await maxGateway.start();

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: 'Создай ссылки на оплату для всех учеников из файла.',
        attachment: {
          filename: 'students.csv',
          content: new TextEncoder().encode('name,amount'),
          bytes: 11,
        },
      }),
    );

    expect(harness.askCalls).toHaveLength(1);
    expect(harness.askCalls[0]).toMatchObject({
      messages: [
        {
          role: 'user',
          content: 'Создай ссылки на оплату для всех учеников из файла.',
        },
      ],
      attachment: { filename: 'students.csv', content: 'name,amount' },
    });
    expect(
      maxAdapter.sent.some((item) => item.text.includes('Waiting for the file')),
    ).toBe(false);
    expect(maxAdapter.edits.at(-1)?.buttons).toContainEqual({
      kind: 'callback',
      label: 'Approve',
      data: 'apr:approval-inline:y',
    });
  });

  it('does not carry a pending file request into an unrelated MAX ask', async () => {
    const maxAdapter = new FakeAdapter('max');
    const config = messengerConfig();
    const harness = createHarness({ config });
    const maxGateway = new MessengerGateway({
      client: 'online-school',
      api: harness.api,
      adapters: [maxAdapter],
      loadConfig: async () => config,
      audit: { append: async () => undefined },
      sessions: new SessionStore(3),
      approvals: new ApprovalRegistry(),
      throttle: new MessageThrottle(0),
    });
    await maxGateway.start();

    await maxAdapter.receive(
      incoming({ platform: 'max', text: 'Create links using the file.' }),
    );
    await maxAdapter.receive(
      incoming({ platform: 'max', text: 'Show payment status for pay-123.' }),
    );
    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: undefined,
        attachment: {
          filename: 'students.csv',
          content: new TextEncoder().encode('name,amount'),
          bytes: 11,
        },
      }),
    );

    expect(harness.askCalls.map((call) => call.messages)).toEqual([
      [{ role: 'user', content: 'Show payment status for pay-123.' }],
      [{ role: 'user', content: 'Please process the attached file.' }],
    ]);
  });

  it('implements /start, /help, and /status without calling /api/ask', async () => {
    const harness = createHarness();
    await harness.gateway.start();
    await harness.adapter.receive(incoming({ text: '/start' }));
    await harness.adapter.receive(incoming({ text: '/help' }));
    await harness.adapter.receive(incoming({ text: '/status' }));

    expect(harness.askCalls).toEqual([]);
    expect(harness.adapter.sent.map((item) => item.text)).toEqual([
      'Hello! Send a request to create a payment link. Commands: /help.',
      'Send a text request or CSV/TXT file. If you send the text and file separately, mention the file or list in your request.\nCommands:\n/start: show the welcome message.\n/help: show this help.\n/reset: clear the pending request; pending approvals are not cancelled.\n/status: show the client and allowed scenarios.\nUse the buttons on an approval card to approve or reject. A chat message does not replace a button press.',
      'Client: Online School\nScenarios: create_payment',
    ]);
  });

  it('accepts validated CSV/TXT attachments from Telegram and MAX', async () => {
    const maxAdapter = new FakeAdapter('max');
    const config = messengerConfig();
    const harness = createHarness({ config });
    const maxGateway = new MessengerGateway({
      client: 'online-school',
      api: harness.api,
      adapters: [maxAdapter],
      loadConfig: async () => config,
      audit: { append: async () => undefined },
      sessions: new SessionStore(3),
      approvals: new ApprovalRegistry(),
      throttle: new MessageThrottle(0),
    });
    await maxGateway.start();

    await maxAdapter.receive(
      incoming({ platform: 'max', text: '/help' }),
    );
    expect(maxAdapter.sent.at(-1)?.text).toContain(
      'Send a text request or CSV/TXT file.',
    );

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        attachmentIssue: 'unsupported',
      }),
    );
    expect(harness.askCalls).toHaveLength(0);
    expect(maxAdapter.sent.at(-1)?.text).toContain('other attachment types');

    await maxAdapter.receive(
      incoming({
        platform: 'max',
        text: undefined,
        attachment: {
          filename: 'batch.csv',
          content: new TextEncoder().encode('name,amount'),
          bytes: 11,
        },
      }),
    );
    expect(harness.askCalls.at(-1)?.attachment).toEqual({
      filename: 'batch.csv',
      content: 'name,amount',
    });

    await harness.gateway.start();
    await harness.adapter.receive(
      incoming({
        text: undefined,
        attachment: {
          filename: 'batch.csv',
          content: new TextEncoder().encode('name,amount'),
          bytes: 11,
        },
      }),
    );
    expect(harness.askCalls.at(-1)?.attachment).toEqual({
      filename: 'batch.csv',
      content: 'name,amount',
    });
  });
});
