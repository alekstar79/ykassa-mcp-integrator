import { describe, expect, it } from 'vitest';
import { MessageThrottle } from '../src/throttle.js';

describe('MessageThrottle', () => {
  it('serializes sends in the same chat and continues after a rejected send', async () => {
    const throttle = new MessageThrottle();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = throttle.enqueue('telegram', 'chat-1', 'user-1', async () => {
      order.push('first-start');
      await firstStarted;
      order.push('first-end');
      throw new Error('transport failed');
    });
    const second = throttle.enqueue('telegram', 'chat-1', 'user-2', async () => {
      order.push('second');
      return 'sent';
    });

    await Promise.resolve();
    releaseFirst?.();
    await expect(first).rejects.toThrow('transport failed');
    await expect(second).resolves.toBe('sent');
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });

  it('applies the cooldown across chats for the same platform user', async () => {
    let now = 100;
    const waits: number[] = [];
    const throttle = new MessageThrottle(250, () => now, async (milliseconds) => {
      waits.push(milliseconds);
      now += milliseconds;
    });
    const action = async () => 'sent';

    await throttle.enqueue('telegram', 'chat-1', 'user-1', action);
    await throttle.enqueue('telegram', 'chat-2', 'user-1', action);
    await throttle.enqueue('max', 'chat-3', 'user-1', action);

    expect(waits).toEqual([250]);
  });
});
