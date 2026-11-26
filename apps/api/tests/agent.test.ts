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

function operationPlanCall(
  id: string,
  operations: Array<{ tool: string; args: Record<string, unknown> }>,
): ChatStreamChunk[] {
  return toolCall(
    id,
    'prepare_operation',
    JSON.stringify({ operations, reply: '' }),
  );
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
        requests.push([...messages]);
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

  it('returns a server-validated payment approval plan without calling MCP', async () => {
    const provider = {
      id: 'test',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall('plan-2', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '1500', currency: 'RUB' },
                description: 'Test purchase',
              },
            },
          ]),
        ),
      ),
    };

    const result = await runAgent(
      [
        {
          role: 'user',
          content: 'Create one payment for 1500 RUB for Test purchase.',
        },
      ],
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
            id: expect.any(String),
            name: 'create_payment',
            args: {
              amount: { value: '1500.00', currency: 'RUB' },
              description: 'Test purchase',
              capture: true,
            },
          },
        ],
        roundtrip: 1,
        deterministicExecution: true,
      },
    });
    expect(result.requiresApproval?.approvalId).toBeTruthy();
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        toolChoice: 'required',
        tools: [
          expect.objectContaining({ name: 'prepare_operation' }),
        ],
      }),
    );
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('requires a new explicit approval for each repeated risky request', async () => {
    let callNumber = 0;
    const provider = {
      id: 'test',
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall(`repeated-call-${++callNumber}`, [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '1500', currency: 'RUB' },
                description: 'Repeated purchase',
              },
            },
          ]),
        ),
      ),
    };
    const messages = [
      {
        role: 'user' as const,
        content: 'Create one payment for 1500 RUB for Repeated purchase.',
      },
    ];

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

  it('does not pass model-invented gateway_id to the MCP tool', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall('plan-with-gateway', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '100', currency: 'RUB' },
                description: 'Test purchase',
                gateway_id: 'invented-gateway',
              },
            },
          ]),
        ),
      ),
    };

    const result = await runAgent(
      [
        {
          role: 'user',
          content: 'Create a payment for 100 RUB for Test purchase.',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );

    expect(result.requiresApproval).toBeUndefined();
    expect(result.reply).toContain('Nothing was created');
    expect(result.reply).not.toContain('gateway_id');
    expect(result.reply).not.toContain('create_payment');
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('asks deterministically for required fields instead of model-generated questions', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall('plan-missing-amount', [
            {
              tool: 'create_payment',
              args: { description: 'Test purchase' },
            },
          ]),
        ),
      ),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Create a payment for Test purchase.' }],
      config,
      { provider, model: 'test-model' },
    );

    expect(result.reply).toContain('I still need the amount');
    expect(result.reply).not.toContain('gateway_id');
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('executes the approved plan without asking the model again', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall('approved-plan', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '1500', currency: 'RUB' },
                description: 'Test purchase',
              },
            },
          ]),
        ),
      ),
    };
    const proposed = await runAgent(
      [
        {
          role: 'user',
          content: 'Create one payment for 1500 RUB for Test purchase.',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );
    const continuation = proposed.requiresApproval?.continuation;

    expect(continuation).toBeDefined();
    if (continuation === undefined) throw new Error('Expected approval plan.');

    mocks.callTool.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: 'payment-1',
            status: 'pending',
            amount: { value: '1500.00', currency: 'RUB' },
            confirmation_url:
              'https://yoomoney.ru/checkout/payments/v2/contract?orderId=payment-1',
          }),
        },
      ],
    });
    const result = await runAgent(
      [],
      config,
      { provider, model: 'test-model' },
      continuation,
    );

    expect(provider.chat).toHaveBeenCalledOnce();
    expect(mocks.callTool).toHaveBeenCalledOnce();
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'create_payment',
      arguments: {
        amount: { value: '1500.00', currency: 'RUB' },
        description: 'Test purchase',
        capture: true,
      },
    });
    expect(result.reply).toContain('Payment link for 1,500.00 RUB');
    expect(result.reply).toContain('waiting for payment');
    expect(result.reply).not.toContain('{"id"');
  });

  it('forces a structured extraction call and returns an approval plan', async () => {
    const requests: ChatRequest[] = [];
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async (request: ChatRequest) => {
        requests.push(request);
        return streamResult(
          operationPlanCall('planned-payment', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '5000', currency: 'RUB' },
                description: 'Тестовый урок E2E',
              },
            },
          ]),
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

    expect(requests).toHaveLength(1);
    expect(requests[0]?.toolChoice).toBe('required');
    expect(requests[0]?.tools?.map((tool) => tool.name)).toEqual([
      'prepare_operation',
    ]);
    expect(requests[0]?.tools?.[0]?.parameters).not.toHaveProperty(
      'properties.operations.items.properties.args.properties.gateway_id',
    );
    expect(result.reply).toContain('После подтверждения');
    expect(result.reply).not.toContain('MCP');
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

  it('handles a simple calculation without calling payment tools and identifies the configured model in context', async () => {
    const requests: ChatRequest[] = [];
    const provider = {
      id: 'openai',
      chat: vi.fn(async (request: ChatRequest) => {
        requests.push(request);
        return streamResult([
          { type: 'text-delta', text: '391' },
          { type: 'finish', finishReason: 'stop' },
        ]);
      }),
    };

    const result = await runAgent(
      [{ role: 'user', content: 'Сколько будет 17 умножить на 23?' }],
      config,
      {
        provider,
        model: 'deepseek/deepseek-v4.1-flash',
      },
    );

    expect(result.reply).toBe('391');
    expect(requests[0]?.messages[0]?.content).toContain(
      'Модель ассистента: deepseek/deepseek-v4.1-flash',
    );
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('identifies itself using the configured model without connecting to payment services', async () => {
    const result = await runAgent(
      [{ role: 'user', content: 'Кто ты?' }],
      config,
      {
        provider: { id: 'openai', chat: vi.fn() },
        model: 'deepseek/deepseek-v4.1-flash',
      },
    );

    expect(result.reply).toBe(
      'Я ИИ-ассистент. Сейчас используется модель deepseek/deepseek-v4.1-flash.',
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.listTools).not.toHaveBeenCalled();
  });

  it('answers capability questions in user-facing terms using available operations', async () => {
    const provider = { id: 'test', chat: vi.fn() };
    const result = await runAgent(
      [{ role: 'user', content: 'А что ты можешь еще?' }],
      config,
      { provider, model: 'test-model' },
    );

    expect(result.reply).toContain('- найти платёж и проверить его данные.');
    expect(result.reply).toContain('- создать платёжную ссылку;');
    expect(result.reply).not.toMatch(
      /сессии|диалога|mcp|api|сервер|инструмент|workflow/iu,
    );
    expect(provider.chat).not.toHaveBeenCalled();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('does not claim creation capabilities that are not available', async () => {
    mocks.listTools.mockResolvedValue({ tools: toolList.slice(0, 1) });
    const result = await runAgent(
      [{ role: 'user', content: 'What else can you do?' }],
      config,
      { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
    );

    expect(result.reply).toContain('- find a payment and check its details.');
    expect(result.reply).not.toContain('create a payment link');
  });

  it('does not turn a negated creation request into a financial operation', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult([
          { type: 'text-delta', text: 'Платёжная ссылка создаётся в ЮKassa.' },
          { type: 'finish', finishReason: 'stop' },
        ]),
      ),
    };

    await runAgent(
      [
        {
          role: 'user',
          content: 'Не надо создавать платёжную ссылку, расскажи как это работает.',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );

    expect(provider.chat).toHaveBeenCalledOnce();
    expect(provider.chat.mock.calls[0]?.[0].tools?.map(({ name }) => name)).not
      .toContain('prepare_operation');
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('lets the server apply configured defaults omitted by the planner', async () => {
    const requests: ChatRequest[] = [];
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async (request: ChatRequest) => {
        requests.push(request);
        return streamResult(
          operationPlanCall('plan-with-defaults', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '500' },
                description: 'Test purchase',
              },
            },
          ]),
        );
      }),
    };

    await runAgent(
      [
        {
          role: 'user',
          content: 'Create a payment for 500 for Test purchase.',
        },
      ],
      config,
      { provider, model: 'test-model' },
    );

    expect(JSON.stringify(requests[0]?.tools?.[0]?.parameters)).toContain(
      '"required":["value"]',
    );
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'create_payment',
      arguments: {
        amount: { value: '500.00', currency: 'RUB' },
        description: 'Test purchase',
        capture: true,
      },
    });
  });

  it('resumes extraction when the user supplies a previously missing amount', async () => {
    const history = JSON.stringify([
      {
        role: 'user',
        content: 'Create a payment for Test purchase.',
      },
      {
        role: 'assistant',
        content:
          'Для платёжной ссылки не хватает данных: сумму. Пока ничего не создано.',
      },
    ]);
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult(
          operationPlanCall('follow-up-payment', [
            {
              tool: 'create_payment',
              args: {
                amount: { value: '500' },
                description: 'Test purchase',
              },
            },
          ]),
        ),
      ),
    };

    await runAgent(
      [{ role: 'user', content: '500 RUB' }],
      config,
      {
        provider,
        model: 'test-model',
        getChatHistory: vi.fn(async () => history),
      },
    );

    expect(provider.chat).toHaveBeenCalledOnce();
    expect(provider.chat.mock.calls[0]?.[0].toolChoice).toBe('required');
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'create_payment',
      arguments: {
        amount: { value: '500.00', currency: 'RUB' },
        description: 'Test purchase',
        capture: true,
      },
    });
  });

  it('does not resume a pending operation after a cancellation message', async () => {
    const history = JSON.stringify([
      { role: 'user', content: 'Create a payment for Test purchase.' },
      {
        role: 'assistant',
        content:
          'Для платёжной ссылки не хватает данных: сумму. Пока ничего не создано.',
      },
    ]);
    const provider = {
      id: 'openai',
      chat: vi.fn(async () =>
        streamResult([
          { type: 'text-delta', text: 'Операцию создавать не буду.' },
          { type: 'finish', finishReason: 'stop' },
        ]),
      ),
    };

    await runAgent(
      [{ role: 'user', content: 'Не надо создавать, я передумал.' }],
      config,
      {
        provider,
        model: 'test-model',
        getChatHistory: async () => history,
      },
    );

    expect(provider.chat).toHaveBeenCalledOnce();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('surfaces malformed structured session history', async () => {
    const provider = {
      id: 'openai',
      chat: vi.fn(),
    };

    await expect(
      runAgent(
        [{ role: 'user', content: 'What happened earlier?' }],
        config,
        {
          provider,
          model: 'test-model',
          getChatHistory: async () => '[invalid json',
        },
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('fails closed when a provider returns unstructured output', async () => {
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
    ).rejects.toMatchObject({ status: 502 });
    expect(provider.chat).toHaveBeenCalledOnce();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('fails closed if the provider returns text despite required plan extraction', async () => {
    const provider = {
      id: 'openai',
      supportsRequiredToolChoice: true,
      chat: vi.fn(async () =>
        streamResult([
          {
            type: 'text-delta',
            text: 'Укажите gateway_id.',
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
    ).rejects.toMatchObject({ status: 502 });
    expect(provider.chat).toHaveBeenCalledOnce();
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
    expect(result.reply).toContain('Please try rephrasing it.');
    expect(result.toolCalls).toHaveLength(5);
  });

  it('retrieves prior chat context only when the model calls the history tool', async () => {
    const requests: ChatMessage[][] = [];
    const getChatHistory = vi.fn(async (query: string, limit: number) =>
      JSON.stringify([
        {
          role: 'assistant',
          content: 'Платёжная ссылка создана.',
          tool_calls: [
            {
              name: 'create_payment',
              args: { amount: { value: '1000', currency: 'RUB' } },
              result: '{"id":"pay-older"}',
            },
          ],
        },
      ]),
    );
    const provider = {
      id: 'test',
      chat: vi.fn(async ({ messages }: { messages: ChatMessage[] }) => {
        requests.push([...messages]);
        if (requests.length === 1) {
          return streamResult(
            toolCall(
              'history-call',
              'get_chat_history',
              '{"query":"последняя платежная ссылка","limit":4}',
            ),
          );
        }
        if (requests.length === 2) {
          return streamResult(
            toolCall(
              'payment-call',
              'get_payment',
              '{"id":"pay-older"}',
            ),
          );
        }
        return streamResult([
          { type: 'text-delta', text: 'Статус платежа проверен.' },
          { type: 'finish', finishReason: 'stop' },
        ]);
      }),
    };

    const result = await runAgent(
      [
        {
          role: 'user',
          content: 'Проверь статус оплаты по последней платежной ссылке.',
        },
      ],
      config,
      { provider, model: 'test-model', getChatHistory },
    );

    expect(requests[0]).not.toContainEqual(
      expect.objectContaining({ content: expect.stringContaining('pay-older') }),
    );
    expect(getChatHistory).toHaveBeenCalledWith(
      'последняя платежная ссылка',
      4,
    );
    expect(requests[1]).toContainEqual({
      role: 'tool',
      toolCallId: 'history-call',
      content: expect.stringContaining('pay-older'),
    });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'get_payment',
      arguments: { id: 'pay-older' },
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.reply).toBe('Статус платежа проверен.');
  });

  it('does not execute other tools in the same round as history retrieval', async () => {
    const provider = {
      id: 'test',
      chat: vi
        .fn()
        .mockResolvedValueOnce(
          streamResult([
            { type: 'tool-call-start', toolCallId: 'history-call', toolName: 'get_chat_history' },
            { type: 'tool-call-delta', toolCallId: 'history-call', args: '{"query":"last payment"}' },
            { type: 'tool-call-start', toolCallId: 'payment-call', toolName: 'get_payment' },
            { type: 'tool-call-delta', toolCallId: 'payment-call', args: '{"id":"pay-1"}' },
            { type: 'finish', finishReason: 'tool-calls' },
          ]),
        )
        .mockResolvedValueOnce(
          streamResult([
            { type: 'text-delta', text: 'Please retry after reviewing history.' },
            { type: 'finish', finishReason: 'stop' },
          ]),
        ),
    };

    await runAgent(
      [{ role: 'user', content: 'Check the last payment.' }],
      config,
      {
        provider,
        model: 'test-model',
        getChatHistory: async () => 'Previous payment: pay-1',
      },
    );

    expect(mocks.callTool).not.toHaveBeenCalled();
  });
});
