import { Bot, InlineKeyboard } from 'grammy';
import path from 'node:path';
import { Buffer } from 'node:buffer';
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

const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const TELEGRAM_FILE_ORIGIN = 'https://api.telegram.org';

export interface TelegramAdapterOptions {
  bot?: Bot;
  fetcher?: typeof fetch;
}

interface TelegramMessageInput {
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
}

interface TelegramCallbackInput {
  id: string;
  from: { id: number };
  data?: string;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
  } | null;
}

export class TelegramAdapter {
  readonly platform = 'telegram' as const;
  private readonly bot: Bot;
  private readonly fetcher: typeof fetch;
  private started = false;
  private pollingTask: Promise<void> | undefined;

  constructor(
    private readonly token: string,
    options: TelegramAdapterOptions = {},
  ) {
    if (!token.trim()) throw new Error('Telegram bot token must not be empty.');
    this.bot = options.bot ?? new Bot(token);
    this.fetcher = options.fetcher ?? globalThis.fetch;
  }

  async start(
    onMessage: MessageHandler,
    onCallback: CallbackHandler,
  ): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.bot.catch((error) => {
      console.error(`Telegram update handler failed (${safeErrorName(error)}).`);
    });
    this.bot.on('message', async (context) => {
      const message = context.message;
      const attachment =
        message.document === undefined
          ? undefined
          : await this.downloadFile(
              message.document.file_id,
              message.document.file_name,
            );
      await onMessage(
        mapTelegramMessage(message, attachment),
      );
    });
    this.bot.on('callback_query:data', async (context) => {
      const event = mapTelegramCallback(context.callbackQuery);
      if (event === undefined) {
        await context.answerCallbackQuery();
        return;
      }
      await onCallback(event);
    });
    this.pollingTask = this.bot.start().catch((error: unknown) => {
      console.error(`Telegram long polling stopped (${safeErrorName(error)}).`);
    });
  }

  async sendText(
    chatId: string,
    text: string,
    buttons?: Button[],
  ): Promise<MessageRef> {
    const replyMarkup = keyboardMarkup(buttons);
    const message = await withRetryAfter(() =>
      this.bot.api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        ...(replyMarkup === undefined ? {} : { reply_markup: replyMarkup }),
      }),
    );
    return {
      platform: this.platform,
      chatId,
      messageId: String(message.message_id),
    };
  }

  async editText(
    ref: MessageRef,
    text: string,
    buttons?: Button[],
  ): Promise<void> {
    assertTelegramRef(ref);
    const messageId = parseMessageId(ref.messageId);
    const replyMarkup = keyboardMarkup(buttons);
    await withRetryAfter(async () => {
      try {
        await this.bot.api.editMessageText(ref.chatId, messageId, text, {
          parse_mode: 'HTML',
          ...(replyMarkup === undefined ? {} : { reply_markup: replyMarkup }),
        });
      } catch (error) {
        if (!isMessageNotModified(error)) throw error;
      }
    });
    if (replyMarkup === undefined) {
      await withRetryAfter(async () => {
        try {
          await this.bot.api.editMessageReplyMarkup(
            ref.chatId,
            messageId,
            { reply_markup: { inline_keyboard: [] } },
          );
        } catch (error) {
          if (!isMessageNotModified(error)) throw error;
        }
      });
    }
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await withRetryAfter(() =>
      this.bot.api.answerCallbackQuery(
        callbackId,
        text === undefined ? {} : { text },
      ),
    );
  }

  async setTyping(chatId: string): Promise<void> {
    await withRetryAfter(() =>
      this.bot.api.sendChatAction(chatId, 'typing'),
    );
  }

  async downloadFile(
    fileId: string,
    filenameHint?: string,
  ): Promise<IncomingAttachment> {
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path || !isSafeFilePath(file.file_path)) {
      throw new Error('Telegram returned an invalid file path.');
    }
    if (
      file.file_size !== undefined &&
      file.file_size > TELEGRAM_DOWNLOAD_LIMIT_BYTES
    ) {
      throw new Error('Telegram file exceeds the Bot API download limit.');
    }
    const filePath = file.file_path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = `${TELEGRAM_FILE_ORIGIN}/file/bot${this.token}/${filePath}`;
    let response: Response;
    try {
      response = await this.fetcher(url, { redirect: 'error' });
    } catch {
      throw new Error('Telegram file download request failed.');
    }
    if (!response.ok || response.body === null) {
      throw new Error('Telegram file download failed.');
    }
    const content = await readLimitedBody(response.body);
    const filename =
      safeFilename(filenameHint) ?? path.posix.basename(file.file_path);
    return { filename, content, bytes: content.byteLength };
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.bot.stop();
    await this.pollingTask;
    this.started = false;
  }
}

export function mapTelegramMessage(
  message: TelegramMessageInput,
  attachment?: IncomingAttachment,
): IncomingMessage {
  const command = parseCommand(message.text);
  return {
    platform: 'telegram',
    chatId: String(message.chat.id),
    userId: message.from === undefined ? '' : String(message.from.id),
    isPrivate: message.chat.type === 'private',
    ...(message.text === undefined ? {} : { text: message.text }),
    ...(attachment === undefined ? {} : { attachment }),
    ...(command === undefined ? {} : { command }),
  };
}

export function mapTelegramCallback(
  query: TelegramCallbackInput,
): CallbackEvent | undefined {
  if (query.data === undefined || query.message == null) return undefined;
  return {
    platform: 'telegram',
    chatId: String(query.message.chat.id),
    userId: String(query.from.id),
    messageId: String(query.message.message_id),
    callbackId: query.id,
    data: query.data,
    isPrivate: query.message.chat.type === 'private',
  };
}

function keyboardMarkup(buttons: Button[] | undefined) {
  if (buttons === undefined || buttons.length === 0) return undefined;
  const keyboard = new InlineKeyboard();
  let previousKind: Button['kind'] | undefined;
  for (const button of buttons) {
    if (
      previousKind !== undefined &&
      (button.kind === 'url' || previousKind === 'url')
    ) {
      keyboard.row();
    }
    if (button.kind === 'url') {
      keyboard.url(button.label, button.url);
    } else {
      if (Buffer.byteLength(button.data, 'utf8') > 64) {
        throw new Error('Telegram callback data must not exceed 64 bytes.');
      }
      keyboard.text(button.label, button.data);
    }
    previousKind = button.kind;
  }
  return keyboard;
}

function parseCommand(text: string | undefined): IncomingMessage['command'] {
  if (text === undefined) return undefined;
  const command = /^\/(start|help|reset|status)(?:@[\w]+)?(?:\s|$)/i.exec(text);
  if (command === null) return undefined;
  const normalized = command[1]?.toLowerCase();
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

function assertTelegramRef(ref: MessageRef): void {
  if (ref.platform !== 'telegram') {
    throw new Error('Telegram adapter cannot edit a non-Telegram message.');
  }
}

function parseMessageId(value: string): number {
  const messageId = Number(value);
  if (!Number.isSafeInteger(messageId) || messageId < 1) {
    throw new Error('Telegram message ID is invalid.');
  }
  return messageId;
}

function isSafeFilePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith('/') &&
    value.split('/').every((segment) => segment.length > 0 && segment !== '..')
  );
}

function safeFilename(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const filename = path.posix.basename(value.replaceAll('\\', '/'));
  return filename.length > 0 ? filename : undefined;
}

async function readLimitedBody(
  body: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
        await reader.cancel();
        throw new Error('Telegram file exceeds the Bot API download limit.');
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

async function withRetryAfter<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const retryAfter = retryAfterMilliseconds(error);
    if (retryAfter !== undefined) {
      throw new ThrottleRetryAfterError(retryAfter);
    }
    throw error;
  }
}

function retryAfterMilliseconds(error: unknown): number | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('error_code' in error) ||
    error.error_code !== 429 ||
    !('parameters' in error) ||
    typeof error.parameters !== 'object' ||
    error.parameters === null ||
    !('retry_after' in error.parameters) ||
    typeof error.parameters.retry_after !== 'number' ||
    !Number.isFinite(error.parameters.retry_after) ||
    error.parameters.retry_after < 0
  ) {
    return undefined;
  }
  return Math.max(100, error.parameters.retry_after * 1000);
}

function isMessageNotModified(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error_code' in error &&
    error.error_code === 400 &&
    'description' in error &&
    typeof error.description === 'string' &&
    error.description.includes('message is not modified')
  );
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
