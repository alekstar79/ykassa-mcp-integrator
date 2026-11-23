import { randomUUID } from 'node:crypto';
import { Bot } from 'grammy';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mapTelegramCallback,
  mapTelegramMessage,
  TelegramAdapter,
} from '../src/adapters/telegram.js';
import { ThrottleRetryAfterError, MessageThrottle } from '../src/throttle.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Telegram adapter mapping', () => {
  it('maps private and group messages, sender IDs, text, attachments, and commands', () => {
    const attachment = {
      filename: 'batch.csv',
      content: new Uint8Array([1, 2, 3]),
      bytes: 3,
    };
    expect(
      mapTelegramMessage(
        {
          chat: { id: 1001, type: 'private' },
          from: { id: 2002 },
          text: '/status@school_bot',
        },
        attachment,
      ),
    ).toEqual({
      platform: 'telegram',
      chatId: '1001',
      userId: '2002',
      isPrivate: true,
      text: '/status@school_bot',
      attachment,
      command: '/status',
    });
    expect(
      mapTelegramMessage({
        chat: { id: -1001, type: 'group' },
        from: { id: 2002 },
        text: '/help',
      }),
    ).toMatchObject({
      chatId: '-1001',
      userId: '2002',
      isPrivate: false,
      command: '/help',
    });
  });

  it('maps callbacks, including chat privacy and the original callback data', () => {
    expect(
      mapTelegramCallback({
        id: 'callback-id',
        from: { id: 2002 },
        data: 'apr:approval-id:y',
        message: {
          message_id: 31,
          chat: { id: 1001, type: 'private' },
        },
      }),
    ).toEqual({
      platform: 'telegram',
      chatId: '1001',
      userId: '2002',
      messageId: '31',
      callbackId: 'callback-id',
      data: 'apr:approval-id:y',
      isPrivate: true,
    });
    expect(
      mapTelegramCallback({
        id: 'group-callback',
        from: { id: 2002 },
        data: 'apr:approval-id:n',
        message: {
          message_id: 32,
          chat: { id: -1001, type: 'supergroup' },
        },
      })?.isPrivate,
    ).toBe(false);
    expect(
      mapTelegramCallback({
        id: 'inline-callback',
        from: { id: 2002 },
        data: 'apr:approval-id:y',
      }),
    ).toBeUndefined();
  });
});

describe('Telegram adapter transport', () => {
  it('sends HTML text with URL and callback buttons, respecting rows and byte limits', async () => {
    const bot = new Bot(randomUUID());
    const send = vi.spyOn(bot.api, 'sendMessage').mockResolvedValue(
      telegramMessage(42),
    );
    const adapter = new TelegramAdapter(randomUUID(), { bot });
    const ref = await adapter.sendText('1001', '&lt;safe&gt;', [
      { kind: 'url', label: 'Pay', url: 'https://example.test/pay' },
      { kind: 'callback', label: 'Approve', data: 'apr:id:y' },
      { kind: 'callback', label: 'Reject', data: 'apr:id:n' },
    ]);

    expect(ref).toEqual({
      platform: 'telegram',
      chatId: '1001',
      messageId: '42',
    });
    expect(send).toHaveBeenCalledWith(
      '1001',
      '&lt;safe&gt;',
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Pay', url: 'https://example.test/pay' }],
            [
              { text: 'Approve', callback_data: 'apr:id:y' },
              { text: 'Reject', callback_data: 'apr:id:n' },
            ],
          ],
        },
      }),
    );
    await expect(
      adapter.sendText('1001', 'no', [
        { kind: 'callback', label: 'Too long', data: 'x'.repeat(65) },
      ]),
    ).rejects.toThrow('64 bytes');
  });

  it('edits text and explicitly removes the inline keyboard after a decision', async () => {
    const bot = new Bot(randomUUID());
    const editText = vi
      .spyOn(bot.api, 'editMessageText')
      .mockResolvedValue(true);
    const editMarkup = vi
      .spyOn(bot.api, 'editMessageReplyMarkup')
      .mockResolvedValue(true);
    const adapter = new TelegramAdapter(randomUUID(), { bot });

    await adapter.editText(
      { platform: 'telegram', chatId: '1001', messageId: '42' },
      'Approved',
      [],
    );

    expect(editText).toHaveBeenCalledWith(
      '1001',
      42,
      'Approved',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
    expect(editMarkup).toHaveBeenCalledWith('1001', 42, {
      reply_markup: { inline_keyboard: [] },
    });
  });

  it('maps callback answers and typing indicators to Telegram API methods', async () => {
    const bot = new Bot(randomUUID());
    const answer = vi
      .spyOn(bot.api, 'answerCallbackQuery')
      .mockResolvedValue(true);
    const typing = vi.spyOn(bot.api, 'sendChatAction').mockResolvedValue(true);
    const adapter = new TelegramAdapter(randomUUID(), { bot });

    await adapter.answerCallback('callback-id', 'Received');
    await adapter.setTyping('1001');

    expect(answer).toHaveBeenCalledWith('callback-id', { text: 'Received' });
    expect(typing).toHaveBeenCalledWith('1001', 'typing');
  });

  it('downloads files through getFile and rejects files over the Bot API limit', async () => {
    const bot = new Bot(randomUUID());
    const getFile = vi.spyOn(bot.api, 'getFile').mockResolvedValue({
      file_id: 'file-id',
      file_unique_id: 'unique-id',
      file_path: 'documents/report.csv',
      file_size: 4,
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4])),
    );
    const token = randomUUID();
    const adapter = new TelegramAdapter(token, { bot, fetcher });

    await expect(adapter.downloadFile('file-id', '../report.csv')).resolves.toEqual({
      filename: 'report.csv',
      content: new Uint8Array([1, 2, 3, 4]),
      bytes: 4,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/file/bot${token}/documents/report.csv`),
      { redirect: 'error' },
    );

    getFile.mockResolvedValueOnce({
      file_id: 'large-file',
      file_unique_id: 'large-file',
      file_path: 'documents/large.csv',
      file_size: 20 * 1024 * 1024 + 1,
    });
    await expect(adapter.downloadFile('large-file')).rejects.toThrow(
      'Bot API download limit',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('hands Telegram retry_after delays to the shared throttle', async () => {
    const bot = new Bot(randomUUID());
    const send = vi
      .spyOn(bot.api, 'sendMessage')
      .mockRejectedValueOnce({
        error_code: 429,
        parameters: { retry_after: 0.01 },
      })
      .mockResolvedValueOnce(telegramMessage(43));
    const adapter = new TelegramAdapter(randomUUID(), { bot });
    const delay = vi.fn(async () => {});
    const throttle = new MessageThrottle(0, Date.now, delay);

    await throttle.enqueue('telegram', '1001', '2002', () =>
      adapter.sendText('1001', 'retry'),
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(100);
    await expect(
      adapter.editText(
        { platform: 'max', chatId: '1001', messageId: '42' },
        'not Telegram',
      ),
    ).rejects.toThrow('non-Telegram');
  });

  it('retries keyboard removal through the throttle without failing an unchanged text edit', async () => {
    const bot = new Bot(randomUUID());
    const editText = vi
      .spyOn(bot.api, 'editMessageText')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce({
        error_code: 400,
        description: 'Bad Request: message is not modified',
      });
    const editMarkup = vi
      .spyOn(bot.api, 'editMessageReplyMarkup')
      .mockRejectedValueOnce({
        error_code: 429,
        parameters: { retry_after: 0 },
      })
      .mockResolvedValueOnce(true);
    const adapter = new TelegramAdapter(randomUUID(), { bot });
    const delay = vi.fn(async () => {});
    const throttle = new MessageThrottle(0, Date.now, delay);

    await throttle.enqueue('telegram', '1001', '2002', () =>
      adapter.editText(
        { platform: 'telegram', chatId: '1001', messageId: '42' },
        'Decision recorded',
        [],
      ),
    );

    expect(editText).toHaveBeenCalledTimes(2);
    expect(editMarkup).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(100);
  });

  it('starts long polling once and stops it cleanly', async () => {
    const bot = new Bot(randomUUID());
    const on = vi.spyOn(bot, 'on');
    const start = vi.spyOn(bot, 'start').mockResolvedValue();
    const stop = vi.spyOn(bot, 'stop');
    const adapter = new TelegramAdapter(randomUUID(), { bot });
    const onMessage = vi.fn(async () => {});
    const onCallback = vi.fn(async () => {});

    await adapter.start(onMessage, onCallback);
    await adapter.start(onMessage, onCallback);
    expect(on).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(1);
    await adapter.stop();
    expect(stop).toHaveBeenCalledOnce();
  });
});

function telegramMessage(messageId: number) {
  return {
    message_id: messageId,
    date: 0,
    chat: {
      id: 1001,
      type: 'private' as const,
      first_name: 'Test',
    },
    text: '',
  };
}
