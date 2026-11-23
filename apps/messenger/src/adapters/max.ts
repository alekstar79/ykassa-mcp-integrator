import { isIP } from 'node:net';
import path from 'node:path';
import { ThrottleRetryAfterError } from '../throttle.js';
import type {
  Button,
  CallbackEvent,
  CallbackHandler,
  IncomingAttachment,
  IncomingMessage,
  MessageHandler,
  MessageRef,
} from '../types.js';

const MAX_API_ORIGIN = 'https://platform-api2.max.ru';
const MAX_POLL_TIMEOUT_SECONDS = 30;
const MAX_POLL_RETRY_MS = 1000;
const MAX_POLL_RETRY_LIMIT_MS = 30_000;
const DEFAULT_MAX_ATTACHMENT_KB = 1024;
const MAX_FILE_DOWNLOAD_TIMEOUT_MS = 30_000;

export interface MaxAdapterOptions {
  fetcher?: typeof fetch;
  pollTimeoutSeconds?: number;
  maxAttachmentKb?: number;
}

interface MaxFileDownload {
  url: string;
  filename: string;
  size: number;
}

type MappedMaxMessage = IncomingMessage & {
  fileDownload?: MaxFileDownload;
};

interface MaxKeyboardButton {
  type: 'callback' | 'link';
  text: string;
  payload?: string;
  url?: string;
}

interface MaxKeyboardAttachment {
  type: 'inline_keyboard';
  payload: { buttons: MaxKeyboardButton[][] };
}

export class MaxAdapter {
  readonly platform = 'max' as const;
  private readonly fetcher: typeof fetch;
  private readonly pollTimeoutSeconds: number;
  private readonly maxAttachmentKb: number;
  private started = false;
  private running = false;
  private pollingTask: Promise<void> | undefined;
  private pollAbortController: AbortController | undefined;
  private onMessage: MessageHandler | undefined;
  private onCallback: CallbackHandler | undefined;
  private marker: string | undefined;

  constructor(
    private readonly token: string,
    options: MaxAdapterOptions = {},
  ) {
    if (!token.trim()) throw new Error('MAX bot token must not be empty.');
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.pollTimeoutSeconds =
      options.pollTimeoutSeconds ?? MAX_POLL_TIMEOUT_SECONDS;
    this.maxAttachmentKb =
      options.maxAttachmentKb ?? DEFAULT_MAX_ATTACHMENT_KB;
    if (
      !Number.isInteger(this.pollTimeoutSeconds) ||
      this.pollTimeoutSeconds < 0 ||
      this.pollTimeoutSeconds > 90
    ) {
      throw new RangeError('MAX poll timeout must be between 0 and 90 seconds.');
    }
    if (
      !Number.isInteger(this.maxAttachmentKb) ||
      this.maxAttachmentKb < 1 ||
      this.maxAttachmentKb > DEFAULT_MAX_ATTACHMENT_KB
    ) {
      throw new RangeError(
        `MAX attachment limit must be between 1 and ${DEFAULT_MAX_ATTACHMENT_KB} KB.`,
      );
    }
  }

  async start(
    onMessage: MessageHandler,
    onCallback: CallbackHandler,
  ): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.running = true;
    this.onMessage = onMessage;
    this.onCallback = onCallback;
    this.pollingTask = this.pollUpdates();
  }

  async sendText(
    chatId: string,
    text: string,
    buttons?: Button[],
  ): Promise<MessageRef> {
    const url = new URL('/messages', MAX_API_ORIGIN);
    url.searchParams.set('chat_id', chatId);
    const keyboard = keyboardAttachment(buttons);
    const response = await this.requestJson(url, {
      method: 'POST',
      body: JSON.stringify({
        text,
        format: 'markdown',
        ...(keyboard === undefined ? {} : { attachments: [keyboard] }),
      }),
    });
    const messageId = responseMessageId(response);
    return { platform: this.platform, chatId, messageId };
  }

  async editText(
    ref: MessageRef,
    text: string,
    buttons?: Button[],
  ): Promise<void> {
    assertMaxRef(ref);
    const url = new URL('/messages', MAX_API_ORIGIN);
    url.searchParams.set('message_id', ref.messageId);
    const keyboard = keyboardAttachment(buttons);
    const response = await this.requestJson(url, {
      method: 'PUT',
      body: JSON.stringify({
        text,
        format: 'markdown',
        attachments: keyboard === undefined ? [] : [keyboard],
      }),
    });
    assertSuccessfulResult(response);
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    const url = new URL('/answers', MAX_API_ORIGIN);
    url.searchParams.set('callback_id', callbackId);
    const response = await this.requestJson(url, {
      method: 'POST',
      body: JSON.stringify({
        message: text === undefined ? {} : { text },
      }),
    });
    assertSuccessfulResult(response);
  }

  async setTyping(_chatId: string): Promise<void> {
    // MAX typing actions are not part of this transport MVP.
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.running = false;
    this.pollAbortController?.abort();
    await this.pollingTask;
    this.pollingTask = undefined;
    this.pollAbortController = undefined;
    this.onMessage = undefined;
    this.onCallback = undefined;
    this.started = false;
  }

  private async pollUpdates(): Promise<void> {
    let retryDelayMs = MAX_POLL_RETRY_MS;
    while (this.running) {
      const controller = new AbortController();
      this.pollAbortController = controller;
      try {
        const url = new URL('/updates', MAX_API_ORIGIN);
        url.searchParams.set('limit', '100');
        url.searchParams.set('timeout', String(this.pollTimeoutSeconds));
        url.searchParams.set(
          'types',
          'message_created,message_callback',
        );
        if (this.marker !== undefined) {
          url.searchParams.set('marker', this.marker);
        }
        const batch = await this.requestJson(url, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!isRecord(batch) || !Array.isArray(batch.updates)) {
          throw new Error('MAX returned an invalid updates response.');
        }
        for (const update of batch.updates) {
          if (!this.running) break;
          await this.dispatchUpdate(update);
        }
        const marker = maxId(batch.marker);
        if (marker !== undefined) this.marker = marker;
        retryDelayMs = MAX_POLL_RETRY_MS;
      } catch (error) {
        if (!this.running) break;
        console.error(
          `MAX long polling failed (${safeErrorMessage(error)}).`,
        );
        await delay(retryDelayMs, controller.signal);
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_POLL_RETRY_LIMIT_MS);
      } finally {
        if (this.pollAbortController === controller) {
          this.pollAbortController = undefined;
        }
      }
    }
  }

  private async dispatchUpdate(update: unknown): Promise<void> {
    try {
      const message = mapMaxMessage(update, this.maxAttachmentKb);
      if (message !== undefined) {
        const { fileDownload, ...incomingMessage } = message;
        if (fileDownload === undefined) {
          await this.onMessage?.(incomingMessage);
          return;
        }
        let attachment: IncomingAttachment;
        try {
          attachment = await this.downloadFile(fileDownload);
        } catch (error) {
          console.error(
            `MAX file download failed (${safeErrorName(error)}).`,
          );
          await this.onMessage?.({
            ...incomingMessage,
            attachmentIssue:
              error instanceof MaxFileTooLargeError
                ? 'too_large'
                : 'download_failed',
          });
          return;
        }
        await this.onMessage?.({ ...incomingMessage, attachment });
        return;
      }
      const callback = mapMaxCallback(update);
      if (callback !== undefined) await this.onCallback?.(callback);
    } catch (error) {
      console.error(
        `MAX update handler failed (${safeErrorMessage(error)}).`,
      );
    }
  }

  private async requestJson(
    url: URL,
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        headers: {
          Authorization: this.token,
          ...(init.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        redirect: 'error',
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new Error('MAX API request failed.');
    }
    if (!response.ok) {
      if (response.status === 429) {
        throw new ThrottleRetryAfterError(
          retryAfterMilliseconds(response.headers.get('Retry-After')),
        );
      }
      throw new Error(`MAX API request failed with status ${response.status}.`);
    }
    if (response.status === 204) return undefined;
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error('MAX API returned invalid JSON.');
    }
    return result;
  }

  private async downloadFile(
    file: MaxFileDownload,
  ): Promise<IncomingAttachment> {
    let response: Response;
    try {
      response = await this.fetcher(file.url, {
        redirect: 'error',
        signal: AbortSignal.timeout(MAX_FILE_DOWNLOAD_TIMEOUT_MS),
      });
    } catch {
      throw new Error('MAX file download request failed.');
    }
    if (!response.ok || response.body === null) {
      throw new Error('MAX file download failed.');
    }
    const content = await readLimitedBody(
      response.body,
      this.maxAttachmentKb * 1024,
    );
    return { filename: file.filename, content, bytes: content.byteLength };
  }
}

export function mapMaxMessage(
  update: unknown,
  maxAttachmentKb = DEFAULT_MAX_ATTACHMENT_KB,
): MappedMaxMessage | undefined {
  if (!isRecord(update) || update.update_type !== 'message_created') {
    return undefined;
  }
  const message = asRecord(update.message);
  if (message === undefined) return undefined;
  const body = asRecord(message.body) ?? message;
  const sender = asRecord(message.sender) ?? asRecord(update.user);
  const recipient = asRecord(message.recipient);
  const chatId = maxId(update.chat_id) ?? maxId(recipient?.chat_id);
  const userId =
    maxId(sender?.user_id) ?? maxId(asRecord(update.user)?.user_id);
  if (chatId === undefined || userId === undefined) return undefined;

  const text = typeof body.text === 'string' ? body.text : undefined;
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
    : [];
  let fileDownload: MaxFileDownload | undefined;
  let attachmentIssue: IncomingMessage['attachmentIssue'];
  if (attachments.length > 0) {
    const file = attachments.length === 1 ? asRecord(attachments[0]) : undefined;
    const payload = asRecord(file?.payload);
    const filename =
      typeof file?.filename === 'string'
        ? safeFilename(file.filename)
        : undefined;
    const size = file?.size;
    const url = typeof payload?.url === 'string' ? payload.url : undefined;
    if (
      file?.type !== 'file' ||
      filename === undefined ||
      !/\.(csv|txt)$/i.test(filename) ||
      typeof size !== 'number' ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      url === undefined ||
      !isSafeMaxFileUrl(url)
    ) {
      attachmentIssue = 'unsupported';
    } else if (size > maxAttachmentBytes(maxAttachmentKb)) {
      attachmentIssue = 'too_large';
    } else {
      fileDownload = { url, filename, size };
    }
  }
  const command = parseCommand(text);
  return {
    platform: 'max',
    chatId,
    userId,
    isPrivate: recipient?.chat_type === 'dialog',
    ...(text === undefined ? {} : { text }),
    ...(attachmentIssue === undefined ? {} : { attachmentIssue }),
    ...(fileDownload === undefined ? {} : { fileDownload }),
    ...(command === undefined ? {} : { command }),
  };
}

export function mapMaxCallback(update: unknown): CallbackEvent | undefined {
  if (!isRecord(update) || update.update_type !== 'message_callback') {
    return undefined;
  }
  const callback = asRecord(update.callback);
  if (callback === undefined) return undefined;
  const message =
    asRecord(callback.message) ??
    asRecord(update.message);
  const body = asRecord(message?.body) ?? message;
  const recipient = asRecord(message?.recipient);
  const user =
    asRecord(callback.user) ??
    asRecord(update.user);
  const chatId = maxId(update.chat_id) ?? maxId(recipient?.chat_id);
  const userId =
    maxId(user?.user_id) ?? maxId(callback.user_id);
  const messageId =
    maxId(body?.mid) ??
    maxId(message?.message_id) ??
    maxId(callback.message_id);
  if (
    chatId === undefined ||
    userId === undefined ||
    messageId === undefined ||
    typeof callback.callback_id !== 'string' ||
    typeof callback.payload !== 'string'
  ) {
    return undefined;
  }
  return {
    platform: 'max',
    chatId,
    userId,
    messageId,
    callbackId: callback.callback_id,
    data: callback.payload,
    isPrivate: recipient?.chat_type === 'dialog',
  };
}

function keyboardAttachment(
  buttons: Button[] | undefined,
): MaxKeyboardAttachment | undefined {
  if (buttons === undefined || buttons.length === 0) return undefined;
  const rows: MaxKeyboardButton[][] = [];
  let currentRow: MaxKeyboardButton[] = [];
  let currentRowKind: Button['kind'] | undefined;
  for (const button of buttons) {
    if (
      currentRowKind !== undefined &&
      (button.kind !== currentRowKind ||
        currentRow.length >= (button.kind === 'url' ? 3 : 7))
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentRowKind = undefined;
    }
    if (button.kind === 'url') {
      if (button.url.length > 2048) {
        throw new Error('MAX link button URL must not exceed 2048 characters.');
      }
      currentRow.push({ type: 'link', text: button.label, url: button.url });
    } else {
      if (Array.from(button.data).length > 1024) {
        throw new Error('MAX callback payload must not exceed 1024 characters.');
      }
      currentRow.push({
        type: 'callback',
        text: button.label,
        payload: button.data,
      });
    }
    currentRowKind = button.kind;
  }
  if (currentRow.length > 0) rows.push(currentRow);
  if (rows.length > 30) {
    throw new Error('MAX inline keyboard must not exceed 30 rows.');
  }
  return {
    type: 'inline_keyboard',
    payload: { buttons: rows },
  };
}

function responseMessageId(value: unknown): string {
  if (!isRecord(value) || value.success === false) {
    throw new Error('MAX did not confirm the message was sent.');
  }
  const message = asRecord(value.message) ?? value;
  const body = asRecord(message.body);
  const messageId = maxId(body?.mid) ?? maxId(message.mid);
  if (messageId === undefined) {
    throw new Error('MAX response did not include a message ID.');
  }
  return messageId;
}

function assertSuccessfulResult(value: unknown): void {
  if (isRecord(value) && value.success === false) {
    throw new Error('MAX did not confirm the request was successful.');
  }
}

function assertMaxRef(ref: MessageRef): void {
  if (ref.platform !== 'max') {
    throw new Error('MAX adapter cannot edit a non-MAX message.');
  }
  if (!ref.messageId) throw new Error('MAX message ID must not be empty.');
}

function parseCommand(text: string | undefined): IncomingMessage['command'] {
  if (text === undefined) return undefined;
  const command = /^\/(start|help|reset|status)(?:\s|$)/i.exec(text);
  const normalized = command?.[1]?.toLowerCase();
  if (
    normalized === 'start' ||
    normalized === 'help' ||
    normalized === 'reset' ||
    normalized === 'status'
  ) {
    return `/${normalized}`;
  }
  return undefined;
}

function maxId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function retryAfterMilliseconds(value: string | null): number {
  const seconds = value === null ? Number.NaN : Number(value);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.max(100, seconds * 1000)
    : 1000;
}

class MaxFileTooLargeError extends Error {
  constructor() {
    super('MAX file exceeds the configured download limit.');
    this.name = 'MaxFileTooLargeError';
  }
}

function maxAttachmentBytes(maxAttachmentKb: number): number {
  return maxAttachmentKb * 1024;
}

function isSafeMaxFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return (
      url.protocol === 'https:' &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      isIP(hostname) === 0 &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

function safeFilename(value: string): string | undefined {
  const filename = path.posix.basename(value.replaceAll('\\', '/'));
  return filename.length > 0 && filename.length <= 255
    ? filename
    : undefined;
}

async function readLimitedBody(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new MaxFileTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const content = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return content;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });

    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}
