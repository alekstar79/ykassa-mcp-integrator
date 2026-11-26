import type { ChatMessage, LLMProvider } from './llm.js';
import type { ClientConfig, ClientDefaults } from './config.js';

export interface AgentConfig {
  mcpToken: string;
  mcpUrl: string;
  approvalThreshold: number;
  requireHumanConfirmation: boolean;
  allowedScenarios: string[];
  defaults: ClientDefaults;
  overrides?: Partial<ClientDefaults>;
  clientConfig: ClientConfig;
}

export interface ContinuationState {
  messages: ChatMessage[];
  pendingToolCalls: Array<{ id: string; name: string; args: unknown }>;
  roundtrip: number;
  rejected?: boolean;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  error?: string;
}

export interface AgentResult {
  reply: string;
  toolCalls: ToolCallRecord[];
  requiresApproval?: {
    approvalId: string;
    toolName: string;
    args: unknown;
    proposedActions: Array<{
      tool: string;
      args: Record<string, unknown>;
      requires_confirmation: boolean;
    }>;
    continuation: ContinuationState;
  };
}

export interface AgentDeps {
  provider: LLMProvider;
  model: string;
  getChatHistory?: (query: string, limit: number) => Promise<string>;
  logToolCall?: (entry: {
    tool: string;
    args: unknown;
    result?: string;
    error?: string;
  }) => Promise<void> | void;
}
