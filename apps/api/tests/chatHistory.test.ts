import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendChatHistory,
  formatChatHistoryForModel,
  readRelevantChatHistory,
  resolveSessionId,
} from '../src/chatHistory.js';

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
const temporaryDirectories: string[] = [];

async function createHistoryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'ykassa-history-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('chat history storage', () => {
  it('creates UUID sessions and rejects invalid session identifiers', () => {
    expect(resolveSessionId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(() => resolveSessionId('../outside')).toThrow('valid UUID');
  });

  it('retrieves relevant earlier turns without mixing client histories', async () => {
    const historyDir = await createHistoryDirectory();
    await appendChatHistory(
      'online-school',
      SESSION_ID,
      [
        {
          turnId: 'turn-payment',
          role: 'user',
          content: 'Создай платёжную ссылку для Анны.',
        },
        {
          turnId: 'turn-payment',
          role: 'assistant',
          content: 'Платёжная ссылка создана.',
          toolCalls: [
            {
              name: 'create_payment',
              args: { amount: { value: '1000', currency: 'RUB' } },
              result: '{"id":"pay-older","confirmation_url":"https://pay.example"}',
            },
          ],
        },
        {
          turnId: 'turn-other',
          role: 'user',
          content: 'Какие есть способы доставки?',
        },
        {
          turnId: 'turn-other',
          role: 'assistant',
          content: 'Доступна курьерская доставка.',
        },
        {
          turnId: 'turn-current',
          role: 'user',
          content: 'Добрый день.',
        },
      ],
      historyDir,
    );

    const relevant = await readRelevantChatHistory(
      'online-school',
      SESSION_ID,
      'Проверь статус последней платёжной ссылки',
      2,
      'turn-current',
      historyDir,
    );

    expect(relevant.map((message) => message.turnId)).toEqual([
      'turn-payment',
      'turn-payment',
      'turn-other',
      'turn-other',
    ]);
    expect(relevant[1]?.toolCalls?.[0]?.result).toContain('pay-older');
    expect(formatChatHistoryForModel(relevant)).toContain('pay-older');
    await expect(
      readRelevantChatHistory(
        'another-client',
        SESSION_ID,
        '',
        4,
        undefined,
        historyDir,
      ),
    ).resolves.toEqual([]);
  });

  it('returns only the latest requested turns when there is no search query', async () => {
    const historyDir = await createHistoryDirectory();
    await appendChatHistory(
      'online-school',
      SESSION_ID,
      [
        { turnId: 'old', role: 'user', content: 'old request' },
        { turnId: 'new', role: 'user', content: 'new request' },
      ],
      historyDir,
    );

    await expect(
      readRelevantChatHistory(
        'online-school',
        SESSION_ID,
        '',
        1,
        undefined,
        historyDir,
      ),
    ).resolves.toMatchObject([{ turnId: 'new', content: 'new request' }]);
  });

  it('keeps approval continuations in chronological order and selects their turn as recent', async () => {
    const historyDir = await createHistoryDirectory();
    await appendChatHistory(
    'online-school',
    SESSION_ID,
    [
      { turnId: 'approval', role: 'user', content: 'Create a payment.' },
      { turnId: 'later', role: 'user', content: 'Another request.' },
      { turnId: 'approval', role: 'assistant', content: 'Payment approved.' },
    ],
    historyDir,
    );

    await expect(
    readRelevantChatHistory(
      'online-school',
      SESSION_ID,
      '',
      1,
      undefined,
      historyDir,
    ),
    ).resolves.toMatchObject([
    { turnId: 'approval', content: 'Create a payment.' },
    { turnId: 'approval', content: 'Payment approved.' },
    ]);
  });
});
