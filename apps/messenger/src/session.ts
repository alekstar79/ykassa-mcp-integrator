import type { MessengerPlatform } from './types.js';

export interface SessionMessage {
  role: 'user';
  content: string;
}

interface SessionRecord {
  messages: SessionMessage[];
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly maxMessages: number,
    private readonly ttlMs: number = DEFAULT_SESSION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(maxMessages) || maxMessages < 1) {
      throw new RangeError('maxMessages must be a positive integer.');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('ttlMs must be a positive number.');
    }
  }

  get(platform: MessengerPlatform, chatId: string): SessionMessage[] {
    const key = sessionKey(platform, chatId);
    const record = this.sessions.get(key);
    if (record === undefined) return [];
    if (record.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return [];
    }
    return record.messages.map((message) => ({ ...message }));
  }

  append(
    platform: MessengerPlatform,
    chatId: string,
    message: SessionMessage,
    maxMessages = this.maxMessages,
  ): SessionMessage[] {
    if (!Number.isInteger(maxMessages) || maxMessages < 1) {
      throw new RangeError('maxMessages must be a positive integer.');
    }
    const messages = this.get(platform, chatId);
    messages.push({ ...message });
    if (messages.length > maxMessages) {
      messages.splice(0, messages.length - maxMessages);
    }
    this.sessions.set(sessionKey(platform, chatId), {
      messages,
      expiresAt: this.now() + this.ttlMs,
    });
    return messages.map((entry) => ({ ...entry }));
  }

  reset(platform: MessengerPlatform, chatId: string): void {
    this.sessions.delete(sessionKey(platform, chatId));
  }

  clearExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, record] of this.sessions) {
      if (record.expiresAt <= now) {
        this.sessions.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

function sessionKey(platform: MessengerPlatform, chatId: string): string {
  return JSON.stringify([platform, chatId]);
}
