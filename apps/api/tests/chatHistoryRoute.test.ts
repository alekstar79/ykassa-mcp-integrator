import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { appendChatHistory } from '../src/chatHistory.js';
import { createApp } from '../src/lib.js';

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
const temporaryDirectories: string[] = [];

async function createHistoryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'ykassa-history-api-'));
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

describe('GET /api/history', () => {
  it('returns only the requested client session transcript without caching it', async () => {
    const historyDir = await createHistoryDirectory();
    await appendChatHistory(
      'online-school',
      SESSION_ID,
      [
        {
          turnId: 'turn-one',
          role: 'user',
          content: 'Create a payment link.',
        },
        {
          turnId: 'turn-one',
          role: 'assistant',
          content: 'Payment link created.',
          toolCalls: [
            {
              name: 'create_payment',
              args: { amount: { value: '100', currency: 'RUB' } },
              result: '{"id":"payment-123"}',
            },
          ],
        },
      ],
      historyDir,
    );
    await appendChatHistory(
      'another-client',
      SESSION_ID,
      [{ turnId: 'other', role: 'user', content: 'Do not expose this.' }],
      historyDir,
    );

    const response = await request(createApp({ historyDir })).get(
      `/api/history?client=online-school&session_id=${SESSION_ID}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.messages).toMatchObject([
      { turn_id: 'turn-one', role: 'user', content: 'Create a payment link.' },
      {
        turn_id: 'turn-one',
        role: 'assistant',
        content: 'Payment link created.',
        tool_calls: [{ name: 'create_payment' }],
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Do not expose this.');
  });

  it('returns an empty transcript for a valid session with no saved messages', async () => {
    const historyDir = await createHistoryDirectory();

    const response = await request(createApp({ historyDir })).get(
      `/api/history?client=online-school&session_id=${SESSION_ID}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ session_id: SESSION_ID, messages: [] });
  });

  it('rejects missing or invalid session identifiers', async () => {
    const app = createApp();

    await expect(request(app).get('/api/history?client=online-school')).resolves
      .toMatchObject({
        status: 400,
        body: { error: '"session_id" is required.' },
      });
    await expect(
      request(app).get('/api/history?client=online-school&session_id=../other'),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: '"session_id" must be a valid UUID.' },
    });
  });
});
