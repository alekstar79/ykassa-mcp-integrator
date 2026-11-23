import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mapMaxCallback,
  mapMaxMessage,
  MaxAdapter,
} from '../src/adapters/max.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MAX update mapping', () => {
  it('maps private and group messages, commands, sender IDs, and unsupported files', () => {
    expect(
      mapMaxMessage({
        update_type: 'message_created',
        chat_id: 1001,
        user: { user_id: 2002 },
        message: {
          sender: { user_id: 2002 },
          recipient: { chat_id: 1001, chat_type: 'dialog' },
          body: { mid: 'message-1', text: '/status' },
        },
      }),
    ).toEqual({
      platform: 'max',
      chatId: '1001',
      userId: '2002',
      isPrivate: true,
      text: '/status',
      command: '/status',
    });

    expect(
      mapMaxMessage({
        update_type: 'message_created',
        chat_id: 3001,
        user: { user_id: 2002 },
        message: {
          recipient: { chat_id: 3001, chat_type: 'chat' },
          body: {
            mid: 'message-2',
            attachments: [{ type: 'file', payload: {} }],
          },
        },
      }),
    ).toMatchObject({
      chatId: '3001',
      userId: '2002',
      isPrivate: false,
      attachmentIssue: 'unsupported',
    });
  });

  it('accepts one CSV/TXT file and applies the configured size limit', () => {
    const update = {
      update_type: 'message_created',
      chat_id: 1001,
      user: { user_id: 2002 },
      message: {
        recipient: { chat_id: 1001, chat_type: 'dialog' },
        body: {
          mid: 'message-file',
          attachments: [
            {
              type: 'file',
              filename: '../batch.csv',
              size: 12,
              payload: {
                url: 'https://files.max.ru/batch.csv',
                token: 'file-token',
              },
            },
          ],
        },
      },
    };

    expect(mapMaxMessage(update)).toMatchObject({
      chatId: '1001',
      userId: '2002',
      fileDownload: {
        url: 'https://files.max.ru/batch.csv',
        filename: 'batch.csv',
        size: 12,
      },
    });
    expect(mapMaxMessage(update, 1)).toMatchObject({
      fileDownload: {
        filename: 'batch.csv',
        size: 12,
      },
    });
    expect(
      mapMaxMessage(
        {
          ...update,
          message: {
            recipient: { chat_id: 1001, chat_type: 'dialog' },
            body: {
              attachments: [
                {
                  type: 'file',
                  filename: 'batch.csv',
                  size: 1025,
                  payload: { url: 'https://files.max.ru/batch.csv' },
                },
              ],
            },
          },
        },
        1,
      ),
    ).toMatchObject({ attachmentIssue: 'too_large' });
  });

  it('maps private callbacks and ignores malformed or unrelated updates', () => {
    expect(
      mapMaxCallback({
        update_type: 'message_callback',
        chat_id: 1001,
        user: { user_id: 2002 },
        callback: {
          callback_id: 'callback-1',
          payload: 'apr:approval-1:y',
          message: {
            recipient: { chat_id: 1001, chat_type: 'dialog' },
            body: { mid: 'message-1' },
          },
        },
      }),
    ).toEqual({
      platform: 'max',
      chatId: '1001',
      userId: '2002',
      messageId: 'message-1',
      callbackId: 'callback-1',
      data: 'apr:approval-1:y',
      isPrivate: true,
    });
    expect(mapMaxMessage({ update_type: 'message_removed' })).toBeUndefined();
    expect(
      mapMaxCallback({
        update_type: 'message_callback',
        callback: { callback_id: 'missing-payload' },
      }),
    ).toBeUndefined();
  });
});

describe('MAX transport', () => {
  it('sends Markdown messages with link and callback keyboard rows', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: { body: { mid: 'sent-message-1' } } }),
    );
    const adapter = new MaxAdapter('max-token', { fetcher });

    await expect(
      adapter.sendText('1001', 'Payment link', [
        { kind: 'url', label: 'Pay', url: 'https://example.test/pay' },
        { kind: 'url', label: 'Pay 2', url: 'https://example.test/pay-2' },
        { kind: 'callback', label: 'Approve', data: 'apr:id:y' },
        { kind: 'callback', label: 'Reject', data: 'apr:id:n' },
      ]),
    ).resolves.toEqual({
      platform: 'max',
      chatId: '1001',
      messageId: 'sent-message-1',
    });

    const [requestUrl, requestInit] = fetcher.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(
      'https://platform-api2.max.ru/messages?chat_id=1001',
    );
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Authorization: 'max-token',
      'Content-Type': 'application/json',
    });
    expect(requestInit?.redirect).toBe('error');
    expect(requestInit?.body).toBe(
      JSON.stringify({
        text: 'Payment link',
        format: 'markdown',
        attachments: [
          {
            type: 'inline_keyboard',
            payload: {
              buttons: [
                [
                  { type: 'link', text: 'Pay', url: 'https://example.test/pay' },
                  {
                    type: 'link',
                    text: 'Pay 2',
                    url: 'https://example.test/pay-2',
                  },
                ],
                [
                  {
                    type: 'callback',
                    text: 'Approve',
                    payload: 'apr:id:y',
                  },
                  {
                    type: 'callback',
                    text: 'Reject',
                    payload: 'apr:id:n',
                  },
                ],
              ],
            },
          },
        ],
      }),
    );
  });

  it('edits messages and removes attachments when approval buttons are cleared', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ success: true }),
    );
    const adapter = new MaxAdapter('max-token', { fetcher });

    await adapter.editText(
      { platform: 'max', chatId: '1001', messageId: 'message-1' },
      'Decision recorded',
      [],
    );

    const [requestUrl, requestInit] = fetcher.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(
      'https://platform-api2.max.ru/messages?message_id=message-1',
    );
    expect(requestInit?.method).toBe('PUT');
    expect(requestInit?.body).toBe(
      JSON.stringify({
        text: 'Decision recorded',
        format: 'markdown',
        attachments: [],
      }),
    );
    await expect(
      adapter.editText(
        { platform: 'telegram', chatId: '1001', messageId: '42' },
        'wrong platform',
      ),
    ).rejects.toThrow('non-MAX');
  });

  it('answers callbacks and surfaces MAX API failures without exposing tokens', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(
        Response.json({}, { status: 401, statusText: 'Unauthorized' }),
      );
    const adapter = new MaxAdapter('secret-token', { fetcher });

    await adapter.answerCallback('callback-1', 'Received');
    const [requestUrl, requestInit] = fetcher.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(
      'https://platform-api2.max.ru/answers?callback_id=callback-1',
    );
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Authorization: 'secret-token',
      'Content-Type': 'application/json',
    });
    expect(requestInit?.body).toBe(
      JSON.stringify({ message: { text: 'Received' } }),
    );

    await expect(adapter.sendText('1001', 'hello')).rejects.toThrow(
      'MAX API request failed with status 401.',
    );
  });

  it('logs a safe network error code when long polling cannot connect', async () => {
    const networkCause = Object.assign(new Error('DNS lookup failed'), {
      code: 'ENOTFOUND',
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new TypeError('request failed with secret-token', {
          cause: networkCause,
        }),
      );
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = new MaxAdapter('secret-token', { fetcher });

    await adapter.start(async () => {}, async () => {});

    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        'MAX long polling failed (MAX API request failed (TypeError; cause ENOTFOUND)).',
      );
    });
    expect(logError.mock.calls.flat().join(' ')).not.toContain('secret-token');

    await adapter.stop();
  });

  it('polls messages and callbacks, advances the marker, and stops cleanly', async () => {
    const pollUrls: URL[] = [];
    const downloadedFiles: URL[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === '/updates') {
          pollUrls.push(url);
        }
        if (url.pathname === '/batch.csv') {
          downloadedFiles.push(url);
          return new Response(new Uint8Array([97, 44, 49]));
        }
        if (url.pathname === '/updates' && pollUrls.length === 1) {
          return Response.json({
            marker: 123,
            updates: [
              {
                update_type: 'message_created',
                chat_id: 1001,
                user: { user_id: 2002 },
                message: {
                  recipient: { chat_id: 1001, chat_type: 'dialog' },
                  body: {
                    mid: 'message-1',
                    text: 'Process this file',
                    attachments: [
                      {
                        type: 'file',
                        filename: 'batch.csv',
                        size: 3,
                        payload: { url: 'https://files.max.ru/batch.csv' },
                      },
                    ],
                  },
                },
              },
              {
                update_type: 'message_callback',
                chat_id: 1001,
                user: { user_id: 2002 },
                callback: {
                  callback_id: 'callback-1',
                  payload: 'apr:approval-1:y',
                  message: {
                    recipient: { chat_id: 1001, chat_type: 'dialog' },
                    body: { mid: 'message-2' },
                  },
                },
              },
            ],
          });
        }
        if (url.pathname === '/updates') {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          });
        }
        throw new Error('Unexpected MAX request.');
      },
    );
    const adapter = new MaxAdapter('max-token', {
      fetcher,
      pollTimeoutSeconds: 0,
    });
    const onMessage = vi.fn(async () => {});
    const onCallback = vi.fn(async () => {});

    await adapter.start(onMessage, onCallback);
    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledOnce();
      expect(onCallback).toHaveBeenCalledOnce();
      expect(pollUrls).toHaveLength(2);
    });
    expect(pollUrls[0]?.searchParams.get('types')).toBe(
      'message_created,message_callback',
    );
    expect(pollUrls[1]?.searchParams.get('marker')).toBe('123');
    expect(downloadedFiles).toEqual([
      new URL('https://files.max.ru/batch.csv'),
    ]);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Process this file',
        attachment: {
          filename: 'batch.csv',
          content: new Uint8Array([97, 44, 49]),
          bytes: 3,
        },
      }),
    );

    await adapter.stop();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('rejects a MAX file whose downloaded body exceeds the client limit', async () => {
    let updateDelivered = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === '/updates') {
        if (updateDelivered) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          });
        }
        updateDelivered = true;
        return Response.json({
          marker: 124,
          updates: [
            {
              update_type: 'message_created',
              chat_id: 1001,
              user: { user_id: 2002 },
              message: {
                recipient: { chat_id: 1001, chat_type: 'dialog' },
                body: {
                  attachments: [
                    {
                      type: 'file',
                      filename: 'batch.txt',
                      size: 1,
                      payload: { url: 'https://files.max.ru/batch.txt' },
                    },
                  ],
                },
              },
            },
          ],
        });
      }
      if (url.pathname === '/batch.txt') {
        return new Response(new Uint8Array(1025));
      }
      throw new Error('Unexpected MAX request.');
    });
    const adapter = new MaxAdapter('max-token', {
      fetcher,
      pollTimeoutSeconds: 1,
      maxAttachmentKb: 1,
    });
    const onMessage = vi.fn(async () => {});

    await adapter.start(onMessage, async () => {});
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledOnce());
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentIssue: 'too_large' }),
    );
    await adapter.stop();
  });

  it('enforces the documented callback and link limits', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const adapter = new MaxAdapter('max-token', { fetcher });

    await expect(
      adapter.sendText('1001', 'too long payload', [
        { kind: 'callback', label: 'Approve', data: 'x'.repeat(1025) },
      ]),
    ).rejects.toThrow('1024 characters');
    await expect(
      adapter.sendText('1001', 'too long URL', [
        { kind: 'url', label: 'Pay', url: `https://${'x'.repeat(2041)}` },
      ]),
    ).rejects.toThrow('2048 characters');
    await expect(
      adapter.sendText(
        '1001',
        'too many buttons',
        Array.from({ length: 91 }, (_, index) => ({
          kind: 'url' as const,
          label: `Pay ${index}`,
          url: 'https://example.test/pay',
        })),
      ),
    ).rejects.toThrow('30 rows');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
