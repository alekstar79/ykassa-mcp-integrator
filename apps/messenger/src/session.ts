import { randomUUID } from 'node:crypto';
import type { MessengerPlatform } from './types.js';

export interface SessionMessage {
  role: 'user';
  content: string;
}

interface SessionRecord {
  sessionId: string;
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
    return (this.getRecord(key)?.messages ?? []).map((message) => ({
      ...message,
    }));
  }

  getSessionId(platform: MessengerPlatform, chatId: string): string {
    const key = sessionKey(platform, chatId);
    const record = this.getRecord(key);
    const sessionId = record?.sessionId ?? randomUUID();
    this.sessions.set(key, {
      sessionId,
      messages: record?.messages ?? [],
      expiresAt: this.now() + this.ttlMs,
    });
    return sessionId;
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
    const key = sessionKey(platform, chatId);
    const record = this.getRecord(key);
    const messages = (record?.messages ?? []).map((entry) => ({ ...entry }));
    messages.push({ ...message });
    if (messages.length > maxMessages) {
      messages.splice(0, messages.length - maxMessages);
    }
    this.sessions.set(key, {
      sessionId: record?.sessionId ?? randomUUID(),
      messages,
      expiresAt: this.now() + this.ttlMs,
    });
    return messages.map((entry) => ({ ...entry }));
  }

  clearMessages(platform: MessengerPlatform, chatId: string): void {
    const key = sessionKey(platform, chatId);
    const record = this.getRecord(key);
    this.sessions.set(key, {
      sessionId: record?.sessionId ?? randomUUID(),
      messages: [],
      expiresAt: this.now() + this.ttlMs,
    });
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

  private getRecord(key: string): SessionRecord | undefined {
    const record = this.sessions.get(key);
    if (record === undefined) return undefined;
    if (record.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return undefined;
    }
    return record;
  }
}

function sessionKey(platform: MessengerPlatform, chatId: string): string {
  return JSON.stringify([platform, chatId]);
}
