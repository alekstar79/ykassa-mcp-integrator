import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/llm.js';
import type {
  AgentConfig,
  ContinuationState,
  ToolCallRecord,
} from '../src/agentTypes.js';

const mocks = vi.hoisted(() => ({
  callTool: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    callTool = mocks.callTool;
  },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  OperationNoLongerAllowedError,
  resumeContinuation,
} from '../src/continuation.js';

const config: AgentConfig = {
  mcpToken: 'test-token',
  mcpUrl: 'http://127.0.0.1:1',
  approvalThreshold: 1000,
  requireHumanConfirmation: false,
  allowedScenarios: ['create_payment'],
  defaults: {
    currency: 'RUB',
    vat_code: 1,
    capture: true,
    invoice_expiry_days: 30,
  },
  clientConfig: {
    allowed_scenarios: ['create_payment'],
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

const tools = [
  {
    name: 'create_payment',
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
        },
        capture: { type: 'boolean' },
      },
      required: ['amount'],
    },
  },
];

const continuation: ContinuationState = {
  messages: [{ role: 'assistant', content: 'Please confirm.' }],
  pendingToolCalls: [
    {
      id: 'call-1',
      name: 'create_payment',
      args: {
        amount: {         value: '1500.00', currency: 'RUB' },
        untrusted: 'discarded',
      },
    },
  ],
  roundtrip: 1,
};

describe('resumeContinuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callTool.mockResolvedValue({
      content: [{ type: 'text', text: 'payment created' }],
    });
  });

  it('executes an approved call after applying the current field policy and defaults', async () => {
    const history: ChatMessage[] = [...continuation.messages];
    const executed: ToolCallRecord[] = [];

    await expect(
      resumeContinuation(
        continuation,
        config,
        tools,
        new Set(['create_payment']),
        new Client({ name: 'test', version: '1' }),
        history,
        executed,
        { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
      ),
    ).resolves.toBe(false);

    const args = {
      amount: { value: '1500.00', currency: 'RUB' },
      capture: true,
    };
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: 'create_payment',
      arguments: args,
    });
    expect(executed).toEqual([
      {
        id: 'call-1',
        name: 'create_payment',
        args,
        result: 'payment created',
      },
    ]);
    expect(history.at(-1)).toEqual({
      role: 'tool',
      toolCallId: 'call-1',
      content: 'payment created',
    });
  });

  it('marks rejected calls without invoking MCP', async () => {
    const rejected: ContinuationState = { ...continuation, rejected: true };
    const history: ChatMessage[] = [...rejected.messages];
    const executed: ToolCallRecord[] = [];

    await expect(
      resumeContinuation(
        rejected,
        config,
        [],
        new Set(),
        new Client({ name: 'test', version: '1' }),
        history,
        executed,
        { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
      ),
    ).resolves.toBe(true);

    expect(mocks.callTool).not.toHaveBeenCalled();
    expect(executed).toEqual([
      {
        id: 'call-1',
        name: 'create_payment',
        args: { amount: { value: '1500.00', currency: 'RUB' } },
        error: 'rejected',
      },
    ]);
    expect(history.at(-1)?.content).toBe('{"error":"rejected"}');
  });

  it('revalidates calls against the current allowed scenarios and MCP tools', async () => {
    const notAllowed = { ...config, allowedScenarios: [] };

    await expect(
      resumeContinuation(
        continuation,
        notAllowed,
        tools,
        new Set(['create_payment']),
        new Client({ name: 'test', version: '1' }),
        [],
        [],
        { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
      ),
    ).rejects.toBeInstanceOf(OperationNoLongerAllowedError);

    await expect(
      resumeContinuation(
        continuation,
        config,
        [],
        new Set(['create_payment']),
        new Client({ name: 'test', version: '1' }),
        [],
        [],
        { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
      ),
    ).rejects.toMatchObject({
      name: 'OperationNoLongerAllowedError',
      status: 409,
    });
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it('revalidates the arguments against the current MCP schema', async () => {
    const changedSchema = [
      {
        name: 'create_payment',
        inputSchema: {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description'],
        },
      },
    ];

    await expect(
      resumeContinuation(
        continuation,
        config,
        changedSchema,
        new Set(['create_payment']),
        new Client({ name: 'test', version: '1' }),
        [],
        [],
        { provider: { id: 'test', chat: vi.fn() }, model: 'test-model' },
      ),
    ).rejects.toThrow('Не удалось проверить параметры запроса.');
    expect(mocks.callTool).not.toHaveBeenCalled();
  });
});
