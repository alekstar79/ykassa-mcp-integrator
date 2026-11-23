import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatRequest, ChatStreamChunk } from '../src/llm.js';
import type { AgentConfig } from '../src/agentTypes.js';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = mocks.connect;
    listTools = mocks.listTools;
    callTool = mocks.callTool;
    close = mocks.close;
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {},
}));

import { runAgent } from '../src/agent.js';

const toolList = [
  {
    name: 'get_payment',
    description: 'Read a payment',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_payment',
    description: 'Create a payment',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            currency: { type: 'string' },
          },
          required: ['value', 'currency'],
          additionalProperties: false,
        },
        capture: { type: 'boolean' },
        description: { type: 'string' },
      },
      required: ['amount'],
      additionalProperties: false,
    },
  },
];

const config: AgentConfig = {
  mcpToken: 'test-token',
  mcpUrl: 'http://127.0.0.1:1',
  approvalThreshold: 1000,
  requireHumanConfirmation: false,
  allowedScenarios: ['get_payment', 'create_payment'],
  defaults: {
    currency: 'RUB',
    vat_code: 1,
    capture: true,
    invoice_expiry_days: 30,
  },
  clientConfig: {
    allowed_scenarios: ['get_payment', 'create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: undefined,
    ui: {
      mode: 'reference-ui',
      accent: 'navy',
      radius: 2,
      shadow: 'soft',
      font_pair: 'manrope+jetbrains',
      form_style: 'flat',
      h1_size: 'm',
    },
    limits: { max_messages: 20, max_attachment_kb: 100 },
    defaults: {
      currency: 'RUB',
      vat_code: 1,
      capture: true,
      invoice_expiry_days: 30,
    },
  },
};

function streamResult(chunks: ChatStreamChunk[]) {
  return {
    stream: new ReadableStream<ChatStreamChunk>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    response: Promise.resolve({ finishReason: 'stop' as const }),
  };
}

function toolCall(id: string, name: string, args: string): ChatStreamChunk[] {
  return [
    { type: 'tool-call-start', toolCallId: id, toolName: name },
    { type: 'tool-call-delta', toolCallId: id, args },
    { type: 'finish', finishReason: 'tool-calls' },
  ];
}

describe('runAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.listTools.mockResolvedValue({ tools: toolList });
    mocks.callTool.mockResolvedValue({
      content: [{ type: 'text', text: 'payment found' }],
    });
    mocks.close.mockResolvedValue(undefined);
  });

  it('executes a valid safe tool call and returns the provider reply', async () => {
    const requests: ChatMessage[][] = [];
    const provider = {
      id: 'test',
      chat: vi.fn(async ({ messages }: { messages: ChatMessage[] }) => {
        requests.push(messages);
        return requests.length === 1
          ? streamResult(toolCall('call-1', 'get_payment', '{"id":"pay-1"}'))
          : streamResult([{ type: 'text-delta', text: 'Payment is paid.' }]);
      }),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Check payment' }],
      config,
      { provider, model: 'test-model' },
    );

    expect(result).toEqual({
      reply: 'Payment is paid.',
      toolCalls: [
        {
          id: 'call-1',
          name: 'get_payment',
          args: { id: 'pay-1' },
          result: 'payment found',
        },
      ],
    });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'get_payment',
      arguments: { id: 'pay-1' },
    });
    expect(requests[1]).toContainEqual({
      role: 'tool',
      toolCallId: 'call-1',
      content: 'payment found',
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('returns an approval request instead of calling a risky tool', async () => {
    const provider = {
      id: 'test',
      chat: vi.fn(async () =>
        streamResult(
          toolCall(
            'call-2',
            'create_payment',
            '{"amount":{"value":"1500","currency":"RUB"}}',
          ),
        ),
      ),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Create a payment' }],
      config,
      { provider, model: 'test-model' },
    );

    expect(result.requiresApproval).toMatchObject({
      toolName: 'create_payment',
      args: {
        amount: {         value: '1500.00', currency: 'RUB' },
        capture: true,
      },
      proposedActions: [
        {
          tool: 'create_payment',
          requires_confirmation: true,
        },
      ],
      continuation: {
        pendingToolCalls: [
          {
            id: 'call-2',
            name: 'create_payment',
            args: {
              amount: {               value: '1500.00', currency: 'RUB' },
              capture: true,
            },
          },
        ],
        roundtrip: 1,
      },
    });
    expect(result.requiresApproval?.approvalId).toBeTruthy();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('requires a new explicit approval for each repeated risky request', async () => {
    let callNumber = 0;
    const provider = {
      id: 'test',
      chat: vi.fn(async () =>
        streamResult(
          toolCall(
            `repeated-call-${++callNumber}`,
            'create_payment',
            '{"amount":{"value":"1500","currency":"RUB"}}',
          ),
        ),
      ),
    };
    const messages = [{ role: 'user' as const, content: 'Create a payment' }];

    const first = await runAgent(messages, config, {
      provider,
      model: 'test-model',
    });
    const repeated = await runAgent(messages, config, {
      provider,
      model: 'test-model',
    });

    expect(first.requiresApproval).toBeDefined();
    expect(repeated.requiresApproval).toBeDefined();
    expect(repeated.requiresApproval?.approvalId).not.toBe(
      first.requiresApproval?.approvalId,
    );
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('retries a text-only confirmation as a required tool call and returns approval', async () => {
    const requests: ChatRequest[] = [];
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async (request: ChatRequest) => {
        requests.push(request);
        return requests.length === 1
          ? streamResult([
              {
                type: 'text-delta',
                text: 'Сумма превышает лимит. Подтвердите выполнение.',
              },
              { type: 'finish', finishReason: 'stop' },
            ])
          : streamResult(
              toolCall(
                'recovered-payment',
                'create_payment',
                '{"amount":{"value":"5000","currency":"RUB"},"description":"Тестовый урок E2E"}',
              ),
            );
      }),
    };

    const result = await runAgent(
      [
        {
          role: 'user',
          content:
            'Создай платёжную ссылку на 5000 RUB за «Тестовый урок E2E».',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]?.toolChoice).toBeUndefined();
    expect(requests[1]?.toolChoice).toBe('required');
    expect(requests[1]?.tools?.map((tool) => tool.name)).toEqual([
      'create_payment',
    ]);
    expect(result.reply).toBe('');
    expect(result.requiresApproval?.proposedActions).toEqual([
      {
        tool: 'create_payment',
        args: {
          amount: { value: '5000.00', currency: 'RUB' },
          capture: true,
          description: 'Тестовый урок E2E',
        },
        requires_confirmation: true,
      },
    ]);
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('does not force a creation tool for a how-to question', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult([
          {
            type: 'text-delta',
            text: 'Для создания платежа сначала нужно подтвердить запрос.',
          },
          { type: 'finish', finishReason: 'stop' },
        ]),
      ),
    };

    const result = await runAgent(
      [
        {
          role: 'user',
          content: 'Как создать платёжную ссылку?',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );

    expect(provider.chat).toHaveBeenCalledOnce();
    expect(result.requiresApproval).toBeUndefined();
  });

  it('fails closed when the provider cannot force the approval proposal tool', async () => {
    const provider = {
      id: 'ollama',
      chat: vi.fn(async () =>
        streamResult([
          {
            type: 'text-delta',
            text: 'Подтвердите создание платежа.',
          },
          { type: 'finish', finishReason: 'stop' },
        ]),
      ),
    };

    await expect(
      runAgent(
        [
          {
            role: 'user',
            content: 'Создай платёжную ссылку на 5000 RUB.',
          },
        ],
        config,
        { provider, model: 'test-model' },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(provider.chat).toHaveBeenCalledOnce();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('fails closed if the provider still returns text after a required tool choice', async () => {
    let requestCount = 0;
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () => {
        requestCount += 1;
        return streamResult([
          {
            type: 'text-delta',
            text:
              requestCount === 1
                ? 'Подтвердите создание платежа.'
                : 'Подтвердите, и я продолжу.',
          },
          { type: 'finish', finishReason: 'stop' },
        ]);
      }),
    };

    await expect(
      runAgent(
        [
          {
            role: 'user',
            content: 'Создай платёжную ссылку на 5000 RUB.',
          },
        ],
        config,
        { provider, model: 'test-model' },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('records an MCP error as a tool result and continues the conversation', async () => {
    mocks.callTool.mockResolvedValueOnce({
      isError: true,
      content: [{ type: 'text', text: 'payment not found' }],
    });
    const logToolCall = vi.fn();
    const provider = {
      id: 'test',
      chat: vi
        .fn()
        .mockResolvedValueOnce(
          streamResult(toolCall('call-3', 'get_payment', '{"id":"missing"}')),
        )
        .mockResolvedValueOnce(
          streamResult([{ type: 'text-delta', text: 'No payment.' }]),
        ),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Check payment' }],
      config,
      { provider, model: 'test-model', logToolCall },
    );

    expect(result.toolCalls).toEqual([
      {
        id: 'call-3',
        name: 'get_payment',
        args: { id: 'missing' },
        error: 'payment not found',
      },
    ]);
    expect(logToolCall).toHaveBeenCalledWith({
      tool: 'get_payment',
      args: { id: 'missing' },
      error: 'payment not found',
    });
    expect(result.reply).toBe('No payment.');
  });

  it('stops after the maximum number of tool-call round trips', async () => {
    const provider = {
      id: 'test',
      chat: vi.fn(async () =>
        streamResult(toolCall('repeated-call', 'get_payment', '{"id":"pay-1"}')),
      ),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Check payment' }],
      config,
      { provider, model: 'test-model' },
    );

    expect(provider.chat).toHaveBeenCalledTimes(5);
    expect(mocks.callTool).toHaveBeenCalledTimes(5);
    expect(result.reply).toContain('лимит итераций');
    expect(result.toolCalls).toHaveLength(5);
  });
});
