import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../src/types.js';
import type { ContinuationState } from '../src/agentTypes.js';
import type { ClientConfig } from '../src/config.js';
import { runAgent } from '../src/agent.js';
import {
  createProviderFromEnv,
  resolveLlmEnvironment,
} from '../src/llm.js';
import {
  loadClientConfig,
  loadClientEnvironment,
  parseClientSecrets,
} from '../src/config.js';
import { appendCallLog } from '../src/audit.js';
import { errorHandler } from '../src/http.js';
import { pendingApprovals } from '../src/pendingApprovals.js';
import { approveRouter } from '../src/routes/approve.js';

const mocks = vi.hoisted(() => ({
  runAgent: vi.fn(),
  createProviderFromEnv: vi.fn(),
  resolveLlmEnvironment: vi.fn(),
  loadClientConfig: vi.fn(),
  loadClientEnvironment: vi.fn(),
  parseClientSecrets: vi.fn(),
  appendCallLog: vi.fn(),
  appendChatHistory: vi.fn(),
  readRelevantChatHistory: vi.fn(),
  formatChatHistoryForModel: vi.fn(),
}));

vi.mock('../src/agent.js', () => ({ runAgent: mocks.runAgent }));
vi.mock('../src/llm.js', () => ({
  createProviderFromEnv: mocks.createProviderFromEnv,
  resolveLlmEnvironment: mocks.resolveLlmEnvironment,
}));
vi.mock('../src/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...actual,
    loadClientConfig: mocks.loadClientConfig,
    loadClientEnvironment: mocks.loadClientEnvironment,
    parseClientSecrets: mocks.parseClientSecrets,
  };
});
vi.mock('../src/audit.js', () => ({ appendCallLog: mocks.appendCallLog }));
vi.mock('../src/chatHistory.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chatHistory.js')>();
  return {
    ...actual,
    appendChatHistory: mocks.appendChatHistory,
    readRelevantChatHistory: mocks.readRelevantChatHistory,
    formatChatHistoryForModel: mocks.formatChatHistoryForModel,
  };
});

const config: ClientConfig = {
  allowed_scenarios: ['create_payment'],
  approval_threshold: 4000,
  require_human_confirmation: true,
  brand: undefined,
  ui: {
    mode: 'reference-ui' as const,
    accent: 'navy' as const,
    radius: 2 as const,
    shadow: 'soft' as const,
    font_pair: 'manrope+jetbrains' as const,
    form_style: 'flat' as const,
    h1_size: 'm' as const,
  },
  limits: {
    max_messages: 20,
    max_attachment_kb: 100,
  },
  defaults: {
    currency: 'RUB' as const,
    vat_code: 1,
    capture: true,
    invoice_expiry_days: 30,
  },
};
const provider: LLMProvider = {
  id: 'test-provider',
  chat: async () => {
    throw new Error('Mock provider should not be called.');
  },
};
const continuation: ContinuationState = {
  messages: [{ role: 'system', content: 'test prompt' }],
  pendingToolCalls: [{ id: 'call-1', name: 'create_payment', args: {} }],
  roundtrip: 1,
};
const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const turnId = '123e4567-e89b-42d3-a456-426614174001';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(approveRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /approve', () => {
  beforeEach(() => {
    pendingApprovals.clear();
    vi.clearAllMocks();
    vi.mocked(loadClientConfig).mockResolvedValue(config);
    vi.mocked(loadClientEnvironment).mockResolvedValue({});
    vi.mocked(parseClientSecrets).mockReturnValue({
      shopId: 'test-shop-only',
      mcpToken: 'test-token-only',
    });
    vi.mocked(appendCallLog).mockResolvedValue(undefined);
    mocks.appendChatHistory.mockResolvedValue(undefined);
    mocks.readRelevantChatHistory.mockResolvedValue([]);
    mocks.formatChatHistoryForModel.mockReturnValue('No previous messages.');
    vi.mocked(createProviderFromEnv).mockReturnValue({
      provider,
      model: 'test-model',
    });
    vi.mocked(resolveLlmEnvironment).mockReturnValue({
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'test-model',
      LLM_API_KEY: 'test-llm-key',
      LLM_BASE_URL: 'https://llm.example/v1',
    });
    vi.mocked(runAgent).mockResolvedValue({
      reply: 'Решение обработано.',
      toolCalls: [],
    });
  });

  it('returns 404 for an unknown approval id', async () => {
    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'missing', approved: true });

    expect(response.status).toBe(404);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed approval decision', async () => {
    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'approval-1', approved: 'yes' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('approved (boolean)');
  });

  it('returns 410 and removes an expired approval', async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    pendingApprovals.set('expired', {
      client: 'online-school',
      sessionId,
      turnId,
      continuation,
      createdAt: now - 15 * 60 * 1000 - 1,
    });

    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'expired', approved: true });

    expect(response.status).toBe(410);
    expect(pendingApprovals.has('expired')).toBe(false);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'passes the approval decision (%s) to the agent continuation',
    async (approved) => {
      pendingApprovals.set('approval-1', {
        client: 'online-school',
        sessionId,
        turnId,
        continuation,
        createdAt: Date.now(),
      });

      const response = await request(createApp())
        .post('/approve')
        .send({ approval_id: 'approval-1', approved });

      expect(response.status).toBe(200);
      expect(response.body.approved).toBe(approved);
      expect(response.body.session_id).toBe(sessionId);
      expect(runAgent).toHaveBeenCalledOnce();
      expect(vi.mocked(runAgent).mock.calls[0]?.[3]).toEqual({
        ...continuation,
        rejected: !approved,
      });
      if (approved) {
        const dependencies = vi.mocked(runAgent).mock.calls[0]?.[2];
        await dependencies?.getChatHistory?.('payment link', 3);
        expect(mocks.readRelevantChatHistory).toHaveBeenCalledWith(
          'online-school',
          sessionId,
          'payment link',
          3,
          turnId,
          expect.any(String),
        );
        await dependencies?.logToolCall?.({
          tool: 'create_payment',
          args: {},
          result: 'ok',
        });
        expect(appendCallLog).toHaveBeenCalledWith('test-shop-only', {
          tool: 'create_payment',
          args: {},
          result: 'ok',
        });
      }
      expect(mocks.appendChatHistory).toHaveBeenCalledWith(
        'online-school',
        sessionId,
        [
          {
            turnId,
            role: 'assistant',
            content: 'Решение обработано.',
            toolCalls: [],
          },
        ],
        expect.any(String),
      );
    },
  );

  it('stores a follow-up approval returned by the agent', async () => {
    const nextContinuation: ContinuationState = {
      ...continuation,
      roundtrip: 2,
    };
    vi.mocked(runAgent).mockResolvedValueOnce({
      reply: 'Нужно ещё одно подтверждение.',
      toolCalls: [],
      requiresApproval: {
        approvalId: 'approval-2',
        toolName: 'create_payment',
        args: {},
        proposedActions: [
          { tool: 'create_payment', args: {}, requires_confirmation: true },
        ],
        continuation: nextContinuation,
      },
    });

    pendingApprovals.set('approval-1', {
      client: 'online-school',
      sessionId,
      turnId,
      continuation,
      createdAt: Date.now(),
    });

    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'approval-1', approved: true });

    expect(response.status).toBe(202);
    expect(response.body.session_id).toBe(sessionId);
    expect(pendingApprovals.get('approval-2')?.continuation).toEqual(
      nextContinuation,
    );
    expect(pendingApprovals.get('approval-2')).toMatchObject({
      sessionId,
      turnId,
    });
  });

  it('resolves LLM settings from the client that owns the approval', async () => {
    const clientEnvironment = {
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'client-model',
      LLM_API_KEY: 'test-client-key',
      LLM_BASE_URL: 'https://llm.example/v1',
    };
    const resolvedEnvironment = {
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'client-model',
      LLM_API_KEY: 'test-client-key',
      LLM_BASE_URL: 'https://llm.example/v1',
    };
    pendingApprovals.set('approval-1', {
      client: 'online-school',
      sessionId,
      turnId,
      continuation,
      createdAt: Date.now(),
    });
    vi.mocked(loadClientEnvironment).mockResolvedValue(clientEnvironment);
    vi.mocked(resolveLlmEnvironment).mockReturnValue(resolvedEnvironment);

    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'approval-1', approved: true });

    expect(response.status).toBe(200);
    expect(loadClientEnvironment).toHaveBeenCalledWith(
      'online-school',
      expect.any(String),
    );
    expect(resolveLlmEnvironment).toHaveBeenCalledWith(clientEnvironment);
    expect(createProviderFromEnv).toHaveBeenCalledWith(resolvedEnvironment);
  });

  it('rejects a follow-up approval without a confirmation-required action', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runAgent).mockResolvedValueOnce({
      reply: 'Нужно подтверждение.',
      toolCalls: [],
      requiresApproval: {
        approvalId: 'approval-invalid',
        toolName: 'create_payment',
        args: {},
        proposedActions: [],
        continuation,
      },
    });
    pendingApprovals.set('approval-1', {
      client: 'online-school',
      sessionId,
      turnId,
      continuation,
      createdAt: Date.now(),
    });

    const response = await request(createApp())
      .post('/approve')
      .send({ approval_id: 'approval-1', approved: true });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal server error.');
    expect(log).toHaveBeenCalledOnce();
  });
});
