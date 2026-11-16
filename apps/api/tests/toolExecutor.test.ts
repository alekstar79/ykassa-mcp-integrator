import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/llm.js';
import type { ToolCallRecord } from '../src/agentTypes.js';

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
  executeToolCall,
  extractTextFromToolResult,
} from '../src/toolExecutor.js';

describe('executeToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a successful MCP result in history and the audit log', async () => {
    mocks.callTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'first line' },
        { type: 'image', data: 'ignored' },
        { type: 'text', text: 'second line' },
      ],
    });
    const history: ChatMessage[] = [];
    const executed: ToolCallRecord[] = [];
    const logToolCall = vi.fn();

    await executeToolCall(
      new Client({ name: 'test', version: '1' }),
      { id: 'call-1', name: 'get_payment', args: { id: 'pay-1' } },
      { id: 'pay-1' },
      history,
      executed,
      { provider: { id: 'test', chat: async () => { throw new Error('unused'); } }, model: 'test-model', logToolCall },
    );

    expect(executed).toEqual([
      {
        id: 'call-1',
        name: 'get_payment',
        args: { id: 'pay-1' },
        result: 'first line\nsecond line',
      },
    ]);
    expect(history).toEqual([
      {
        role: 'tool',
        toolCallId: 'call-1',
        content: 'first line\nsecond line',
      },
    ]);
    expect(logToolCall).toHaveBeenCalledWith({
      tool: 'get_payment',
      args: { id: 'pay-1' },
      result: 'first line\nsecond line',
    });
  });

  it('records MCP error responses without throwing', async () => {
    mocks.callTool.mockResolvedValue({
      isError: true,
      content: [{ type: 'text', text: 'not found' }],
    });
    const history: ChatMessage[] = [];
    const executed: ToolCallRecord[] = [];
    const logToolCall = vi.fn();

    await executeToolCall(
      new Client({ name: 'test', version: '1' }),
      { id: 'call-2', name: 'get_payment', args: {} },
      { id: 'missing' },
      history,
      executed,
      { provider: { id: 'test', chat: async () => { throw new Error('unused'); } }, model: 'test-model', logToolCall },
    );

    expect(executed[0]).toMatchObject({ error: 'not found' });
    expect(history[0]?.content).toBe('{"error":"not found"}');
    expect(logToolCall).toHaveBeenCalledWith({
      tool: 'get_payment',
      args: { id: 'missing' },
      error: 'not found',
    });
  });

  it('logs thrown MCP errors and supports non-Error values', async () => {
    mocks.callTool.mockRejectedValueOnce(new Error('connection lost'));
    mocks.callTool.mockRejectedValueOnce('unexpected failure');
    const logToolCall = vi.fn();
    const history: ChatMessage[] = [];
    const executed: ToolCallRecord[] = [];
    const client = new Client({ name: 'test', version: '1' });
    const deps = {
      provider: { id: 'test', chat: async () => { throw new Error('unused'); } },
      model: 'test-model',
      logToolCall,
    };

    await executeToolCall(
      client,
      { id: 'call-3', name: 'get_payment', args: {} },
      {},
      history,
      executed,
      deps,
    );
    await executeToolCall(
      client,
      { id: 'call-4', name: 'get_payment', args: {} },
      {},
      history,
      executed,
      deps,
    );

    expect(executed.map((call) => call.error)).toEqual([
      'connection lost',
      'unexpected failure',
    ]);
    expect(logToolCall).toHaveBeenNthCalledWith(2, {
      tool: 'get_payment',
      args: {},
      error: 'unexpected failure',
    });
  });
});

describe('extractTextFromToolResult', () => {
  it('serializes legacy toolResult payloads and returns empty for unsupported values', () => {
    expect(extractTextFromToolResult({ toolResult: { id: 'pay-1' } })).toBe(
      '{"id":"pay-1"}',
    );
    expect(extractTextFromToolResult({ content: 'not an array' })).toBe('');
    expect(extractTextFromToolResult(null)).toBe('');
  });
});
