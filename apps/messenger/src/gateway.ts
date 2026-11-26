import {
  CLIENT_CONFIG_DEFAULTS,
  type ClientConfig,
} from '@alekstar79/ykassa-contracts';
import {
  ApiClientError,
  type AskResponse,
  type MessengerApiClient,
  type PublicClientSummary,
} from './apiClient.js';
import {
  ApprovalRegistry,
  type ApprovalContext,
} from './approvals.js';
import {
  MessengerAuditLogger,
  type MessengerAuditEntry,
} from './audit.js';
import {
  loadMessengerClientConfig,
} from './config.js';
import {
  chunkText,
  localized,
  renderApiError,
  renderApprovalCard,
  renderAskResponse,
} from './render.js';
import { SessionStore, type SessionMessage } from './session.js';
import { MessageThrottle } from './throttle.js';
import type {
  CallbackEvent,
  IncomingAttachment,
  IncomingMessage,
  MessageRef,
  MessengerAdapter,
  MessengerLocale,
  MessengerPlatform,
} from './types.js';

const ATTACHMENT_PROMPT_DELAY_MS = 3_000;

export interface GatewayOptions {
  client: string;
  api: MessengerApiClient;
  adapters: MessengerAdapter[];
  loadConfig?: () => Promise<ClientConfig>;
  audit?: Pick<MessengerAuditLogger, 'append'>;
  sessions?: SessionStore;
  approvals?: ApprovalRegistry;
  throttle?: MessageThrottle;
}

// Create one gateway per client to scope sessions and approval state by tenant.
export class MessengerGateway {
  private readonly adapters = new Map<MessengerPlatform, MessengerAdapter>();
  private readonly loadConfig: () => Promise<ClientConfig>;
  private readonly audit: Pick<MessengerAuditLogger, 'append'>;
  private readonly sessions: SessionStore;
  private readonly approvals: ApprovalRegistry;
  private readonly throttle: MessageThrottle;
  private readonly attachmentPromptTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly options: GatewayOptions) {
    for (const adapter of options.adapters) {
      if (this.adapters.has(adapter.platform)) {
        throw new Error(`Duplicate adapter for platform '${adapter.platform}'.`);
      }
      this.adapters.set(adapter.platform, adapter);
    }
    this.loadConfig =
      options.loadConfig ?? (() => loadMessengerClientConfig(options.client));
    this.audit = options.audit ?? new MessengerAuditLogger();
    this.sessions =
      options.sessions ??
      new SessionStore(CLIENT_CONFIG_DEFAULTS.limits.max_messages);
    this.approvals = options.approvals ?? new ApprovalRegistry();
    this.throttle = options.throttle ?? new MessageThrottle();
  }

  async start(): Promise<void> {
    const config = await this.loadConfig();
    const enabledAdapters = [...this.adapters.values()].filter(
      (adapter) => config.messengers?.[adapter.platform]?.enabled === true,
    );
    await Promise.all(
      enabledAdapters.map((adapter) =>
        adapter.start(
          (message) => this.handleMessage(message),
          (event) => this.handleCallback(event),
        ),
      ),
    );
  }

  async stop(): Promise<void> {
    for (const timer of this.attachmentPromptTimers.values()) {
      clearTimeout(timer);
    }
    this.attachmentPromptTimers.clear();
    await Promise.all(
      [...this.adapters.values()].map((adapter) => adapter.stop()),
    );
  }

  async handleMessage(message: IncomingMessage): Promise<void> {
    const adapter = this.adapters.get(message.platform);
    if (adapter === undefined) return;
    if (!message.isPrivate) {
      await this.auditMessage(message, 'message_denied');
      return;
    }

    const config = await this.readConfigForMessage(adapter, message);
    if (config === undefined) return;
    const platformConfig = config.messengers?.[message.platform];
    const locale = platformConfig?.locale ?? 'ru';
    if (
      platformConfig?.enabled !== true ||
      !platformConfig.allowed_user_ids.includes(message.userId)
    ) {
      await this.auditMessage(message, 'message_denied');
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized(locale, 'denied'),
      );
      return;
    }

    await this.auditMessage(message, 'message_received');
    const command = message.command ?? parseCommand(message.text);
    this.clearAttachmentPrompt(message.platform, message.chatId);
    if (command !== undefined) {
      await this.handleCommand(adapter, message, locale, command);
      return;
    }

    const requestText = message.text?.trim() ?? '';
    const holdAttachmentRequest = () => {
      this.sessions.clearMessages(message.platform, message.chatId);
      this.sessions.append(
        message.platform,
        message.chatId,
        { role: 'user', content: requestText },
        1,
      );
      this.sessions.clearExpired();
    };

    if (message.attachmentIssue !== undefined) {
      if (requestText && isAttachmentReferenceRequest(requestText)) {
        holdAttachmentRequest();
      }
      const attachmentMessage =
        message.attachmentIssue === 'too_large'
          ? 'maxAttachmentTooLarge'
          : message.attachmentIssue === 'download_failed'
            ? 'maxAttachmentDownloadFailed'
            : 'maxAttachmentUnsupported';
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized(locale, attachmentMessage),
      );
      return;
    }

    const attachment = validateIncomingAttachment(
      message.attachment,
      config.limits.max_attachment_kb,
    );
    if (message.attachment !== undefined && attachment === undefined) {
      if (requestText && isAttachmentReferenceRequest(requestText)) {
        holdAttachmentRequest();
      }
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized(locale, 'invalidAttachment'),
      );
      return;
    }

    if (!requestText && attachment === undefined) return;
    let messages: SessionMessage[];
    if (attachment === undefined && isAttachmentReferenceRequest(requestText)) {
      holdAttachmentRequest();
      this.scheduleAttachmentPrompt(
        adapter,
        message.chatId,
        message.userId,
        locale,
        requestText,
      );
      return;
    }

    if (attachment !== undefined) {
      const pendingRequest = this.sessions
        .get(message.platform, message.chatId)
        .at(-1)?.content;
      this.sessions.clearMessages(message.platform, message.chatId);
      messages = [{
        role: 'user',
        content:
          requestText ||
          pendingRequest ||
          localized(locale, 'attachmentPrompt'),
      }];
    } else {
      this.sessions.clearMessages(message.platform, message.chatId);
      messages = [{ role: 'user', content: requestText }];
    }
    this.sessions.clearExpired();
    await this.auditMessage(message, 'ask_requested');
    await this.setTyping(adapter, message.chatId, message.userId);
    const processingRef = await this.sendRendered(
      adapter,
      message.chatId,
      message.userId,
      chunkText(localized(locale, 'processing'), message.platform),
      [],
    );
    let response: AskResponse;
    try {
      response = await this.options.api.ask(
        this.options.client,
        messages,
        attachment,
        this.sessions.getSessionId(message.platform, message.chatId),
      );
    } catch (error) {
      await this.auditMessage(message, 'api_error');
      await this.editText(
        adapter,
        processingRef,
        message.userId,
        renderApiError(
          error instanceof ApiClientError ? error.status : undefined,
          locale,
          'ask',
        ),
      );
      return;
    }
    await this.handleAskResponse(
      adapter,
      message,
      locale,
      response,
      processingRef,
    );
  }

  async handleCallback(event: CallbackEvent): Promise<void> {
    const adapter = this.adapters.get(event.platform);
    if (adapter === undefined) return;
    let config: ClientConfig;
    try {
      config = await this.loadConfig();
    } catch {
      await this.answerCallback(
        adapter,
        event,
        localized('ru', 'api500'),
      );
      await this.auditCallback(event, 'config_error');
      return;
    }
    const platformConfig = config.messengers?.[event.platform];
    const locale = platformConfig?.locale ?? 'ru';
    if (!event.isPrivate) {
      await this.answerCallback(adapter, event, localized(locale, 'privateOnly'));
      await this.auditCallback(event, 'callback_denied');
      return;
    }
    this.approvals.clearExpired();
    if (
      platformConfig?.enabled !== true ||
      !platformConfig.allowed_user_ids.includes(event.userId)
    ) {
      await this.answerCallback(adapter, event, localized(locale, 'denied'));
      await this.auditCallback(event, 'callback_denied');
      return;
    }

    const callback = parseApprovalCallback(event.data);
    if (callback === undefined) {
      await this.answerCallback(
        adapter,
        event,
        localized(locale, 'invalidAction'),
      );
      await this.auditCallback(event, 'callback_denied');
      return;
    }
    const context: ApprovalContext = {
      client: this.options.client,
      platform: event.platform,
      chatId: event.chatId,
      userId: event.userId,
    };
    const inspected = this.approvals.inspect(callback.approvalId, context);
    if (inspected.status !== 'ok') {
      const answer =
        inspected.status === 'unauthorized'
          ? localized(locale, 'unauthorizedCallback')
          : inspected.status === 'expired'
            ? localized(locale, 'api410')
            : localized(locale, 'invalidAction');
      await this.answerCallback(adapter, event, answer);
      await this.auditCallback(event, 'callback_denied', callback.approvalId);
      if (inspected.status !== 'unauthorized') {
        await this.editText(
          adapter,
          {
            platform: event.platform,
            chatId: event.chatId,
            messageId: event.messageId,
          },
          event.userId,
          answer,
        );
      }
      return;
    }

    await this.answerCallback(
      adapter,
      event,
      localized(locale, 'callbackAck'),
    );
    const taken = this.approvals.take(callback.approvalId, context);
    if (taken.status !== 'ok') {
      await this.auditCallback(event, 'callback_denied', callback.approvalId);
      const text =
        taken.status === 'expired'
          ? localized(locale, 'api410')
          : localized(locale, 'invalidAction');
      await this.editText(
        adapter,
        {
          platform: event.platform,
          chatId: event.chatId,
          messageId: event.messageId,
        },
        event.userId,
        text,
      );
      return;
    }

    const auditEvent = callback.approved
      ? 'approval_accepted'
      : 'approval_rejected';
    await this.auditCallback(event, auditEvent, callback.approvalId);
    await this.setTyping(adapter, event.chatId, event.userId);
    const messageRef: MessageRef = {
      platform: event.platform,
      chatId: event.chatId,
      messageId: event.messageId,
    };
    await this.editText(
      adapter,
      messageRef,
      event.userId,
      localized(locale, 'processing'),
    );
    let response: Awaited<ReturnType<MessengerApiClient['approve']>>;
    try {
      response = await this.options.api.approve(
        callback.approvalId,
        callback.approved,
      );
    } catch (error) {
      await this.auditCallback(event, 'api_error', callback.approvalId);
      await this.editText(
        adapter,
        messageRef,
        event.userId,
        renderApiError(
          error instanceof ApiClientError ? error.status : undefined,
          locale,
          'approve',
        ),
      );
      return;
    }
    await this.handleApprovalResponse(
      adapter,
      event,
      locale,
      response,
      messageRef,
    );
  }

  private async readConfigForMessage(
    adapter: MessengerAdapter,
    message: IncomingMessage,
  ): Promise<ClientConfig | undefined> {
    try {
      return await this.loadConfig();
    } catch {
      await this.auditMessage(message, 'config_error');
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized('ru', 'api500'),
      );
      return undefined;
    }
  }

  private async handleCommand(
    adapter: MessengerAdapter,
    message: IncomingMessage,
    locale: MessengerLocale,
    command: NonNullable<IncomingMessage['command']>,
  ): Promise<void> {
    await this.auditMessage(message, 'command');
    if (command === '/reset') {
      this.sessions.reset(message.platform, message.chatId);
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized(locale, 'reset'),
      );
      return;
    }
    if (command === '/start' || command === '/help') {
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        localized(
          locale,
          command === '/start'
            ? 'start'
            : message.platform === 'max'
              ? 'maxHelp'
              : 'help',
        ),
      );
      return;
    }
    let status: PublicClientSummary;
    try {
      status = await this.options.api.getPublicClient(this.options.client);
    } catch (error) {
      await this.auditMessage(message, 'api_error');
      await this.sendText(
        adapter,
        message.chatId,
        message.userId,
        renderApiError(
          error instanceof ApiClientError ? error.status : undefined,
          locale,
          'other',
        ),
      );
      return;
    }
    await this.sendText(
      adapter,
      message.chatId,
      message.userId,
      formatClientStatus(status, this.options.client, locale),
    );
  }

  private async handleAskResponse(
    adapter: MessengerAdapter,
    message: IncomingMessage,
    locale: MessengerLocale,
    response: AskResponse,
    ref: MessageRef,
  ): Promise<void> {
    if (response.requires_approval) {
      const rendered = renderApprovalCard(
        response,
        message.platform,
        locale,
      );
      const approvalRef = await this.editRendered(
        adapter,
        ref,
        message.userId,
        rendered.chunks,
        rendered.buttons,
      );
      this.approvals.register({
        approvalId: response.approval_id,
        client: this.options.client,
        platform: message.platform,
        chatId: message.chatId,
        messageId: approvalRef.messageId,
        userId: message.userId,
      });
      await this.auditMessage(
        message,
        'approval_requested',
        response.approval_id,
      );
      return;
    }
    const rendered = renderAskResponse(response, message.platform, locale);
    await this.editRendered(
      adapter,
      ref,
      message.userId,
      rendered.chunks,
      rendered.buttons,
    );
  }

  private async handleApprovalResponse(
    adapter: MessengerAdapter,
    event: CallbackEvent,
    locale: MessengerLocale,
    response: Awaited<ReturnType<MessengerApiClient['approve']>>,
    originalRef: MessageRef,
  ): Promise<void> {
    if (response.requires_approval) {
      const rendered = renderApprovalCard(
        response,
        event.platform,
        locale,
      );
      const approvalRef = await this.editRendered(
        adapter,
        originalRef,
        event.userId,
        rendered.chunks,
        rendered.buttons,
      );
      this.approvals.register({
        approvalId: response.approval_id,
        client: this.options.client,
        platform: event.platform,
        chatId: event.chatId,
        messageId: approvalRef.messageId,
        userId: event.userId,
      });
      await this.auditCallback(
        event,
        'approval_requested',
        response.approval_id,
      );
      return;
    }
    const rendered = renderAskResponse(response, event.platform, locale);
    await this.editRendered(
      adapter,
      originalRef,
      event.userId,
      rendered.chunks,
      rendered.buttons,
    );
  }

  private async sendRendered(
    adapter: MessengerAdapter,
    chatId: string,
    userId: string,
    chunks: string[],
    buttons: ReturnType<typeof renderAskResponse>['buttons'],
  ): Promise<MessageRef> {
    let lastRef: MessageRef | undefined;
    for (const [index, chunk] of chunks.entries()) {
      const chunkButtons = index === chunks.length - 1 ? buttons : undefined;
      lastRef = await this.throttle.enqueue(
        adapter.platform,
        chatId,
        userId,
        () => adapter.sendText(chatId, chunk, chunkButtons),
      );
    }
    if (lastRef === undefined) throw new Error('Rendered message has no chunks.');
    return lastRef;
  }

  private async answerCallback(
    adapter: MessengerAdapter,
    event: CallbackEvent,
    text?: string,
  ): Promise<void> {
    await this.throttle.enqueue(
      adapter.platform,
      event.chatId,
      event.userId,
      () => adapter.answerCallback(event.callbackId, text),
    );
  }

  private async setTyping(
    adapter: MessengerAdapter,
    chatId: string,
    userId: string,
  ): Promise<void> {
    await this.throttle.enqueue(
      adapter.platform,
      chatId,
      userId,
      () => adapter.setTyping(chatId),
    );
  }

  private async editRendered(
    adapter: MessengerAdapter,
    originalRef: MessageRef,
    userId: string,
    chunks: string[],
    buttons: ReturnType<typeof renderAskResponse>['buttons'],
  ): Promise<MessageRef> {
    const [first, ...remaining] = chunks;
    if (first === undefined) throw new Error('Rendered message has no chunks.');
    await this.throttle.enqueue(
      adapter.platform,
      originalRef.chatId,
      userId,
      () =>
        adapter.editText(
          originalRef,
          first,
          remaining.length === 0 ? buttons : [],
        ),
    );
    if (remaining.length === 0) return originalRef;
    return this.sendRendered(
      adapter,
      originalRef.chatId,
      userId,
      remaining,
      buttons,
    );
  }

  private async sendText(
    adapter: MessengerAdapter,
    chatId: string,
    userId: string,
    text: string,
  ): Promise<void> {
    await this.sendRendered(
      adapter,
      chatId,
      userId,
      chunkText(text, adapter.platform),
      [],
    );
  }

  private scheduleAttachmentPrompt(
    adapter: MessengerAdapter,
    chatId: string,
    userId: string,
    locale: MessengerLocale,
    requestText: string,
  ): void {
    const key = attachmentPromptKey(adapter.platform, chatId);
    const timer = setTimeout(() => {
      this.attachmentPromptTimers.delete(key);
      const pendingRequest = this.sessions
        .get(adapter.platform, chatId)
        .at(-1)?.content;
      if (pendingRequest !== requestText) return;
      void this.sendText(
        adapter,
        chatId,
        userId,
        localized(locale, 'attachmentRequired'),
      ).catch((error: unknown) => {
        console.error(
          `Attachment prompt delivery failed (${error instanceof Error ? error.message : 'unknown error'}).`,
        );
      });
    }, ATTACHMENT_PROMPT_DELAY_MS);
    this.attachmentPromptTimers.set(key, timer);
  }

  private clearAttachmentPrompt(
    platform: MessengerPlatform,
    chatId: string,
  ): void {
    const key = attachmentPromptKey(platform, chatId);
    const timer = this.attachmentPromptTimers.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.attachmentPromptTimers.delete(key);
  }

  private async editText(
    adapter: MessengerAdapter,
    ref: MessageRef,
    userId: string,
    text: string,
  ): Promise<void> {
    await this.editRendered(
      adapter,
      ref,
      userId,
      chunkText(text, adapter.platform),
      [],
    );
  }

  private async auditMessage(
    message: IncomingMessage,
    event: MessengerAuditEntry['event'],
    approvalId?: string,
  ): Promise<void> {
    await this.audit.append({
      platform: message.platform,
      client: this.options.client,
      userId: message.userId,
      event,
      ...(approvalId === undefined ? {} : { approvalId }),
    });
  }

  private async auditCallback(
    event: CallbackEvent,
    auditEvent: MessengerAuditEntry['event'],
    approvalId?: string,
  ): Promise<void> {
    await this.audit.append({
      platform: event.platform,
      client: this.options.client,
      userId: event.userId,
      event: auditEvent,
      ...(approvalId === undefined ? {} : { approvalId }),
    });
  }
}

function attachmentPromptKey(
  platform: MessengerPlatform,
  chatId: string,
): string {
  return JSON.stringify([platform, chatId]);
}

function parseCommand(
  text: string | undefined,
): IncomingMessage['command'] | undefined {
  if (text === undefined) return undefined;
  const command = text.trim().split(/\s+/, 1)[0]?.replace(/@[\w]+$/, '');
  if (
    command === '/start' ||
    command === '/help' ||
    command === '/reset' ||
    command === '/status'
  ) {
    return command;
  }
  return undefined;
}

function isAttachmentReferenceRequest(text: string): boolean {
  const fileReference =
    /(?:^|[^\p{L}\p{N}_])(?:csv|txt|file|files|attachment|attachments|spreadsheet|document|documents|файл\p{L}*|вложени\p{L}*|таблиц\p{L}*|документ\p{L}*)(?=$|[^\p{L}\p{N}_])/iu;
  const listReference =
    /(?:\b(?:from|using|based on)\s+(?:the\s+)?list\b|(?:^|[^\p{L}\p{N}_])(?:из|по)\s+(?:этого\s+|этой\s+|этому\s+)?списк(?:а|е|у|ом)(?=$|[^\p{L}\p{N}_]))/iu;
  return fileReference.test(text) || listReference.test(text);
}

function parseApprovalCallback(
  data: string,
): { approvalId: string; approved: boolean } | undefined {
  const match = /^apr:([^:]+):(y|n)$/.exec(data);
  if (match === null) return undefined;
  const approvalId = match[1];
  const decision = match[2];
  if (approvalId === undefined || decision === undefined) return undefined;
  return { approvalId, approved: decision === 'y' };
}

function validateIncomingAttachment(
  attachment: IncomingAttachment | undefined,
  maxAttachmentKb: number,
): { filename: string; content: string } | undefined {
  if (attachment === undefined) return undefined;
  if (
    attachment.filename.length === 0 ||
    attachment.filename.length > 255 ||
    !/\.(csv|txt)$/i.test(attachment.filename) ||
    attachment.bytes !== attachment.content.byteLength ||
    attachment.bytes > maxAttachmentKb * 1024
  ) {
    return undefined;
  }
  try {
    return {
      filename: attachment.filename,
      content: new TextDecoder('utf-8', { fatal: true }).decode(
        attachment.content,
      ),
    };
  } catch {
    return undefined;
  }
}

function formatClientStatus(
  client: PublicClientSummary,
  clientName: string,
  locale: MessengerLocale,
): string {
  const displayName = client.brand.display_name || clientName;
  const scenarios = client.allowed_scenarios.join(', ') || '-';
  return localized(locale, 'status', {
    client: displayName,
    scenarios,
  });
}
