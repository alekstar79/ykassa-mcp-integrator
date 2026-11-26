import { describe, expect, it } from 'vitest';
import { SessionStore } from '../src/session.js';

describe('SessionStore', () => {
  it('keeps only the newest messages up to the ring-buffer limit', () => {
    const sessions = new SessionStore(2);
    sessions.append('telegram', 'chat-1', { role: 'user', content: 'one' });
    sessions.append('telegram', 'chat-1', { role: 'user', content: 'two' });
    const current = sessions.append('telegram', 'chat-1', {
      role: 'user',
      content: 'three',
    });

    expect(current.map((message) => message.content)).toEqual(['two', 'three']);
    expect(sessions.get('telegram', 'chat-1')).toEqual(current);
  });

  it('expires idle sessions after the configured TTL', () => {
    let now = 100;
    const sessions = new SessionStore(5, 30_000, () => now);
    sessions.append('telegram', 'chat-1', { role: 'user', content: 'hello' });

    now = 30_100;

    expect(sessions.get('telegram', 'chat-1')).toEqual([]);
    expect(sessions.clearExpired()).toBe(0);
  });

  it('keeps sessions isolated by platform and supports reset', () => {
    const sessions = new SessionStore(5);
    const telegramSessionId = sessions.getSessionId('telegram', 'same-chat');
    sessions.append('telegram', 'same-chat', {
      role: 'user',
      content: 'telegram',
    });
    sessions.append('max', 'same-chat', { role: 'user', content: 'max' });

    sessions.reset('telegram', 'same-chat');

    expect(sessions.getSessionId('telegram', 'same-chat')).not.toBe(
      telegramSessionId,
    );
    expect(sessions.get('telegram', 'same-chat')).toEqual([]);
    expect(sessions.get('max', 'same-chat').map((item) => item.content)).toEqual([
      'max',
    ]);
  });

  it('clears pending text without changing the conversation session ID', () => {
    const sessions = new SessionStore(5);
    const sessionId = sessions.getSessionId('max', 'chat-1');
    sessions.append('max', 'chat-1', { role: 'user', content: 'pending' });

    sessions.clearMessages('max', 'chat-1');

    expect(sessions.get('max', 'chat-1')).toEqual([]);
    expect(sessions.getSessionId('max', 'chat-1')).toBe(sessionId);
  });

  it('uses the current configured limit when appending', () => {
    const sessions = new SessionStore(5);
    sessions.append('telegram', 'chat-1', { role: 'user', content: 'old' });
    sessions.append(
      'telegram',
      'chat-1',
      { role: 'user', content: 'new' },
      1,
    );

    expect(sessions.get('telegram', 'chat-1')).toEqual([
      { role: 'user', content: 'new' },
    ]);
  });
});
