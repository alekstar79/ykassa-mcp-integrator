import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatRequest, ChatStreamChunk } from '../src/types.js';
import { LLMAPIError } from '../src/types.js';
import { createAnthropic } from '../src/providers/anthropic.js';
import { createGoogle } from '../src/providers/google.js';
import { createOllama } from '../src/providers/ollama.js';
import { createOpenAI } from '../src/providers/openai.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function sseResponse(...events: Array<{ event?: string; data: unknown }>): Response {
  const body = events
    .map(
      ({ event, data }) =>
        `${event === undefined ? '' : `event: ${event}\n`}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
    )
    .join('');
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function stubFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function collect(stream: ReadableStream<ChatStreamChunk>) {
  const chunks: ChatStreamChunk[] = [];
  const reader = stream.getReader();
  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(result.value);
  }
  return chunks;
}

const request: ChatRequest = {
  model: 'test-model',
  messages: [
    { role: 'system', content: 'System instructions' },
    { role: 'user', content: 'Check the payment' },
  ],
  tools: [
    {
      name: 'get_payment',
      description: 'Read payment details',
      parameters: { type: 'object', properties: { id: { type: 'string' } } },
    },
  ],
};

describe('OpenAI SSE provider', () => {
  it('parses content, fragmented tool arguments, finish reason, and usage', async () => {
    const fetchMock = stubFetch(
      sseResponse(
        {
          data: {
            choices: [{ delta: { content: 'Checking ' }, finish_reason: null }],
          },
        },
        {
          data: {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: '{"id":' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
        },
        {
          data: {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-openai',
                      function: { name: 'get_payment', arguments: '"pay-1"}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
        },
        {
          data: {
            usage: {
              prompt_tokens: 11,
              completion_tokens: 3,
              total_tokens: 14,
            },
          },
        },
        { data: '[DONE]' },
      ),
    );
    const result = await createOpenAI({ apiKey: 'test-key' }).chat(request);

    const chunks = await collect(result.stream);
    expect(chunks).toEqual([
      { type: 'text-delta', text: 'Checking ' },
      {
        type: 'tool-call-start',
        toolCallId: 'call-openai',
        toolName: 'get_payment',
      },
      {
        type: 'tool-call-delta',
        toolCallId: 'call-openai',
        args: '{"id":',
      },
      {
        type: 'tool-call-delta',
        toolCallId: 'call-openai',
        args: '"pay-1"}',
      },
      { type: 'tool-call-end', toolCallId: 'call-openai' },
      { type: 'finish', finishReason: 'tool-calls' },
    ]);
    await expect(result.response).resolves.toEqual({
      finishReason: 'tool-calls',
      usage: undefined,
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(init?.body)) as {
      tools: Array<{ function: { name: string } }>;
      stream_options: { include_usage: boolean };
    };
    expect(body.tools[0]?.function.name).toBe('get_payment');
    expect(body.stream_options.include_usage).toBe(true);
  });

  it('can require a tool call instead of accepting a text-only response', async () => {
    const fetchMock = stubFetch(
      sseResponse(
        {
          data: {
            choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          },
        },
        { data: '[DONE]' },
      ),
    );
    const result = await createOpenAI({ apiKey: 'test-key' }).chat({
      ...request,
      toolChoice: 'required',
    });

    await collect(result.stream);
    await result.response;

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      tool_choice?: string;
    };
    expect(body.tool_choice).toBe('required');
  });

  it('resolves usage-only responses and maps prior tool messages', async () => {
    stubFetch(
      sseResponse(
        {
          data: {
            choices: [{ delta: { content: 'Done' }, finish_reason: null }],
          },
        },
        {
          data: {
            usage: {
              prompt_tokens: 4,
              completion_tokens: 2,
              total_tokens: 6,
            },
          },
        },
        { data: '[DONE]' },
      ),
    );
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-old', name: 'get_payment', args: { id: 'pay-1' } },
        ],
      },
      { role: 'tool', toolCallId: 'call-old', content: 'found' },
    ];
    const result = await createOpenAI({ apiKey: 'test-key' }).chat({
      ...request,
      messages,
      tools: undefined,
    });

    expect(await collect(result.stream)).toEqual([
      { type: 'text-delta', text: 'Done' },
    ]);
    await expect(result.response).resolves.toEqual({
      finishReason: 'stop',
      usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
    });
  });

  it('throws an API error for unsuccessful responses and rejects missing bodies', async () => {
    stubFetch(new Response('invalid key', { status: 401 }));
    await expect(
      createOpenAI({ apiKey: 'test-key' }).chat(request),
    ).rejects.toMatchObject<Partial<LLMAPIError>>({
      name: 'LLMAPIError',
      status: 401,
      provider: 'openai',
      body: 'invalid key',
    });

    stubFetch(new Response(null, { status: 200 }));
    await expect(
      createOpenAI({ apiKey: 'test-key' }).chat(request),
    ).rejects.toThrow('OpenAI response has no body');
  });
});

describe('Anthropic SSE provider', () => {
  it('parses text and tool-use events and converts the conversation format', async () => {
    const fetchMock = stubFetch(
      sseResponse(
        {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Payment ' },
          },
        },
        {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 1,
            content_block: {
              type: 'tool_use',
              id: 'call-anthropic',
              name: 'get_payment',
            },
          },
        },
        {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'input_json_delta', partial_json: '{"id":"pay-1"}' },
          },
        },
        {
          event: 'content_block_stop',
          data: { type: 'content_block_stop', index: 1 },
        },
        {
          event: 'message_delta',
          data: {
            type: 'message_delta',
            delta: { stop_reason: 'tool_use' },
            usage: { output_tokens: 8 },
          },
        },
      ),
    );
    const priorMessages: ChatMessage[] = [
      ...request.messages,
      {
        role: 'assistant',
        content: 'Looking up',
        toolCalls: [
          { id: 'call-prior', name: 'get_payment', args: { id: 'pay-1' } },
        ],
      },
      { role: 'tool', toolCallId: 'call-prior', content: 'found' },
    ];
    const result = await createAnthropic({ apiKey: 'test-key' }).chat({
      ...request,
      messages: priorMessages,
      toolChoice: 'required',
    });

    expect(await collect(result.stream)).toEqual([
      { type: 'text-delta', text: 'Payment ' },
      {
        type: 'tool-call-start',
        toolCallId: 'call-anthropic',
        toolName: 'get_payment',
      },
      {
        type: 'tool-call-delta',
        toolCallId: 'call-anthropic',
        args: '{"id":"pay-1"}',
      },
      { type: 'tool-call-end', toolCallId: 'call-anthropic' },
      { type: 'finish', finishReason: 'tool-calls' },
    ]);
    await expect(result.response).resolves.toEqual({
      finishReason: 'tool-calls',
      usage: { promptTokens: 0, completionTokens: 8, totalTokens: 8 },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(init?.body)) as {
      system: string;
      messages: Array<{ role: string; content: unknown }>;
      tool_choice: { type: string; name: string };
    };
    expect(body.system).toBe('System instructions');
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'get_payment' });
    expect(body.messages.at(-1)).toMatchObject({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call-prior' }],
    });
  });

  it('emits stream errors and reports HTTP errors or missing bodies', async () => {
    stubFetch(
      sseResponse({
        event: 'error',
        data: {
          type: 'error',
          error: { message: 'stream interrupted' },
        },
      }),
    );
    const streamResult = await createAnthropic({ apiKey: 'test-key' }).chat(
      request,
    );
    expect(await collect(streamResult.stream)).toEqual([
      {
        type: 'error',
        error: new Error('Anthropic stream error: stream interrupted'),
      },
    ]);

    stubFetch(new Response('bad request', { status: 400 }));
    await expect(
      createAnthropic({ apiKey: 'test-key' }).chat(request),
    ).rejects.toMatchObject({
      status: 400,
      provider: 'anthropic',
      body: 'bad request',
    });

    stubFetch(new Response(null));
    await expect(
      createAnthropic({ apiKey: 'test-key' }).chat(request),
    ).rejects.toThrow('Anthropic response has no body');
  });
});

describe('Google SSE provider', () => {
  it('parses text and function calls and translates tool responses', async () => {
    const fetchMock = stubFetch(
      sseResponse({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Found ' },
                  { functionCall: { name: 'get_payment', args: { id: 'pay-1' } } },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 9,
            candidatesTokenCount: 4,
            totalTokenCount: 13,
          },
        },
      }),
    );
    const messages: ChatMessage[] = [
      ...request.messages,
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-google', name: 'get_payment', args: { id: 'pay-1' } },
        ],
      },
      { role: 'tool', toolCallId: 'call-google', content: '{"ok":true}' },
    ];
    const result = await createGoogle({ apiKey: 'test-key' }).chat({
      ...request,
      messages,
      toolChoice: 'required',
    });

    const chunks = await collect(result.stream);
    expect(chunks[0]).toEqual({ type: 'text-delta', text: 'Found ' });
    expect(chunks[1]).toMatchObject({
      type: 'tool-call-start',
      toolName: 'get_payment',
    });
    expect(chunks[2]).toMatchObject({
      type: 'tool-call-delta',
      args: '{"id":"pay-1"}',
    });
    expect(chunks.at(-1)).toEqual({
      type: 'finish',
      finishReason: 'tool-calls',
    });
    await expect(result.response).resolves.toEqual({
      finishReason: 'tool-calls',
      usage: { promptTokens: 9, completionTokens: 4, totalTokens: 13 },
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:streamGenerateContent?alt=sse&key=test-key',
    );
    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: unknown[] }>;
      toolConfig: {
        functionCallingConfig: {
          mode: string;
          allowedFunctionNames: string[];
        };
      };
    };
    expect(body.systemInstruction.parts[0]?.text).toBe('System instructions');
    expect(body.toolConfig.functionCallingConfig).toEqual({
      mode: 'ANY',
      allowedFunctionNames: ['get_payment'],
    });
    expect(body.contents.at(-1)?.parts[0]).toMatchObject({
      functionResponse: {
        name: 'get_payment',
        response: { result: { ok: true } },
      },
    });
  });

  it('reports API errors and distinguishes length finishes without a tool call', async () => {
    stubFetch(new Response('quota exceeded', { status: 429 }));
    await expect(
      createGoogle({ apiKey: 'test-key' }).chat(request),
    ).rejects.toMatchObject({
      status: 429,
      provider: 'google',
      body: 'quota exceeded',
    });

    stubFetch(
      sseResponse({
        data: {
          candidates: [{ content: { parts: [{ text: 'Long answer' }] }, finishReason: 'MAX_TOKENS' }],
        },
      }),
    );
    const result = await createGoogle({ apiKey: 'test-key' }).chat({
      ...request,
      tools: undefined,
    });
    expect(await collect(result.stream)).toEqual([
      { type: 'text-delta', text: 'Long answer' },
      { type: 'finish', finishReason: 'length' },
    ]);
    await expect(result.response).resolves.toMatchObject({
      finishReason: 'length',
      usage: undefined,
    });

    stubFetch(new Response(null));
    await expect(
      createGoogle({ apiKey: 'test-key' }).chat(request),
    ).rejects.toThrow('Google response has no body');
  });
});

describe('Ollama NDJSON provider', () => {
  it('parses line-delimited content and tool calls and converts messages', async () => {
    const fetchMock = stubFetch(
      new Response(
        [
          '{"message":{"content":"Checking"}}',
          'not-json',
          '{"message":{"tool_calls":[{"function":{"name":"get_payment","arguments":{"id":"pay-1"}}}]}}',
          '{"done":true,"prompt_eval_count":5,"eval_count":2}',
        ].join('\n'),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      ),
    );
    const priorMessages: ChatMessage[] = [
      ...request.messages,
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-ollama', name: 'get_payment', args: '{"id":"pay-1"}' },
        ],
      },
      { role: 'tool', toolCallId: 'call-ollama', content: 'found' },
    ];
    const result = await createOllama({ baseURL: 'http://127.0.0.1:11434' }).chat({
      ...request,
      messages: priorMessages,
    });

    const chunks = await collect(result.stream);
    expect(chunks[0]).toEqual({ type: 'text-delta', text: 'Checking' });
    expect(chunks[1]).toMatchObject({
      type: 'tool-call-start',
      toolName: 'get_payment',
    });
    expect(chunks[2]).toMatchObject({
      type: 'tool-call-delta',
      args: '{"id":"pay-1"}',
    });
    expect(chunks.at(-1)).toEqual({
      type: 'finish',
      finishReason: 'tool-calls',
    });
    await expect(result.response).resolves.toEqual({
      finishReason: 'tool-calls',
      usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; tool_name?: string }>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(body.messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_name: 'call-ollama',
    });
    expect(body.tools[0]?.function.name).toBe('get_payment');
  });

  it('handles incomplete streams and API errors', async () => {
    stubFetch(new Response('{"message":{"content":"still working"}}'));
    const incomplete = await createOllama().chat({
      ...request,
      tools: undefined,
    });
    expect(await collect(incomplete.stream)).toEqual([
      { type: 'text-delta', text: 'still working' },
      { type: 'finish', finishReason: 'stop' },
    ]);
    await expect(incomplete.response).resolves.toEqual({
      finishReason: 'stop',
    });

    stubFetch(new Response('server unavailable', { status: 503 }));
    await expect(createOllama().chat(request)).rejects.toMatchObject({
      status: 503,
      provider: 'ollama',
      body: 'server unavailable',
    });

    stubFetch(new Response(null));
    await expect(createOllama().chat(request)).rejects.toThrow(
      'Ollama response has no body',
    );
  });
});
