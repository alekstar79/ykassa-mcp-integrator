export type MessengerPlatform = 'telegram' | 'max';
export type MessengerLocale = 'ru' | 'en';

export type Button =
  | { kind: 'callback'; label: string; data: string }
  | { kind: 'url'; label: string; url: string };

export interface MessageRef {
  platform: MessengerPlatform;
  chatId: string;
  messageId: string;
}

export interface IncomingAttachment {
  filename: string;
  content: Uint8Array;
  bytes: number;
}

export interface IncomingMessage {
  platform: MessengerPlatform;
  chatId: string;
  userId: string;
  isPrivate: boolean;
  text?: string;
  attachment?: IncomingAttachment;
  attachmentIssue?: 'unsupported' | 'too_large' | 'download_failed';
  command?: '/start' | '/help' | '/reset' | '/status';
}

export interface CallbackEvent {
  platform: MessengerPlatform;
  chatId: string;
  userId: string;
  messageId: string;
  callbackId: string;
  data: string;
  isPrivate: boolean;
}

export type MessageHandler = (message: IncomingMessage) => Promise<void>;
export type CallbackHandler = (event: CallbackEvent) => Promise<void>;

export interface MessengerAdapter {
  readonly platform: MessengerPlatform;
  start(
    onMessage: MessageHandler,
    onCallback: CallbackHandler,
  ): Promise<void>;
  // Telegram text is HTML-escaped by render.ts; adapters send it as HTML.
  sendText(
    chatId: string,
    text: string,
    buttons?: Button[],
  ): Promise<MessageRef>;
  editText(ref: MessageRef, text: string, buttons?: Button[]): Promise<void>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  setTyping(chatId: string): Promise<void>;
  stop(): Promise<void>;
}
