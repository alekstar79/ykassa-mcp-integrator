import { describe, expect, it, vi } from 'vitest';
import {
  readErrorBody,
  SSEParserStream,
  tryParseJSON,
} from '../src/sse-parser.js';

describe('SSEParserStream', () => {
  it('joins split chunks and emits complete SSE events', async () => {
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('event: message\r\ndata: {"value":');
        controller.enqueue('"ok"}\r\n\r\ndata: [DONE]\r\n\r\n');
        controller.close();
      },
    });
    const reader = input.pipeThrough(new SSEParserStream()).getReader();
    const events = [];

    for (let result = await reader.read(); !result.done; result = await reader.read()) {
      events.push(result.value);
    }

    expect(events).toEqual([
      { event: 'message', data: '{"value":"ok"}' },
      { data: '[DONE]' },
    ]);
  });

  it('ignores comments and joins multiple data lines', async () => {
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(
          ': keep-alive\nignored: field\nignored\nevent: update\ndata: first\n',
        );
        controller.enqueue('data: second\n\n');
        controller.close();
      },
    });
    const reader = input.pipeThrough(new SSEParserStream()).getReader();
    const result = await reader.read();

    expect(result.value).toEqual({
      event: 'update',
      data: 'first\nsecond',
    });
  });

  it('flushes a final unterminated data line and omits empty events', async () => {
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('data: final');
        controller.close();
      },
    });
    const reader = input.pipeThrough(new SSEParserStream()).getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: { data: 'final' },
    });
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });

    const emptyInput = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(': comment\n');
        controller.close();
      },
    });
    const emptyReader = emptyInput.pipeThrough(new SSEParserStream()).getReader();
    await expect(emptyReader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});

describe('SSE helpers', () => {
  it('returns undefined for malformed JSON', () => {
    expect(tryParseJSON('{invalid')).toBeUndefined();
  });

  it('returns an empty error body when a response cannot be read', async () => {
    const response = new Response();
    vi.spyOn(response, 'text').mockRejectedValue(new Error('read failed'));

    await expect(readErrorBody(response)).resolves.toBe('');
  });
});
