import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatStreamChunk } from '../src/llm.js';
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
