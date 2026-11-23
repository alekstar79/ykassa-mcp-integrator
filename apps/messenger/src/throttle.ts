import type { MessengerPlatform } from './types.js';

type AsyncAction<T> = () => Promise<T>;
const DEFAULT_USER_COOLDOWN_MS = 1000;

export class ThrottleRetryAfterError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('The transport requested a retry after a delay.');
    this.name = 'ThrottleRetryAfterError';
    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      throw new RangeError('retryAfterMs must be a non-negative number.');
    }
  }
}

const defaultDelay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class MessageThrottle {
  private readonly chatQueues = new Map<string, Promise<void>>();
  private readonly nextUserSendAt = new Map<string, number>();

  constructor(
    private readonly cooldownMs = DEFAULT_USER_COOLDOWN_MS,
    private readonly now: () => number = Date.now,
    private readonly delay: (milliseconds: number) => Promise<void> = defaultDelay,
  ) {
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
      throw new RangeError('cooldownMs must be a non-negative number.');
    }
  }

  async enqueue<T>(
    platform: MessengerPlatform,
    chatId: string,
    userId: string,
    action: AsyncAction<T>,
  ): Promise<T> {
    const chatKey = JSON.stringify([platform, chatId]);
    const userKey = JSON.stringify([platform, userId]);
    const previous = this.chatQueues.get(chatKey) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      while (true) {
        const waitMs = this.reserveUserSlot(userKey);
        if (waitMs > 0) await this.delay(waitMs);
        try {
          return await action();
        } catch (error) {
          if (!(error instanceof ThrottleRetryAfterError)) throw error;
          await this.delay(error.retryAfterMs);
        }
      }
    });
    const settled = current.then(
      () => undefined,
      () => undefined,
    );
    this.chatQueues.set(chatKey, settled);
    try {
      return await current;
    } finally {
      if (this.chatQueues.get(chatKey) === settled) {
        this.chatQueues.delete(chatKey);
      }
    }
  }

  private reserveUserSlot(userKey: string): number {
    if (this.cooldownMs === 0) return 0;
    const now = this.now();
    for (const [key, scheduledAt] of this.nextUserSendAt) {
      if (scheduledAt <= now) this.nextUserSendAt.delete(key);
    }
    const scheduledAt = this.nextUserSendAt.get(userKey) ?? now;
    this.nextUserSendAt.set(userKey, Math.max(now, scheduledAt) + this.cooldownMs);
    return Math.max(0, scheduledAt - now);
  }
}
