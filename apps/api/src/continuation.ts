import { enforceFieldAllowlist } from './allowlist.js';
import { enrichToolCall } from './enrich.js';
import { executeToolCall } from './toolExecutor.js';
import {
  requireValidToolCall,
  type ToolSchemaEntry,
} from './validateToolCall.js';
import type {
  AgentConfig,
  AgentDeps,
  ContinuationState,
  ToolCallRecord,
} from './agentTypes.js';
import type { ChatMessage } from './llm.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class OperationNoLongerAllowedError extends Error {
  readonly status = 409;

  constructor() {
    super('Операция больше не разрешена');
    this.name = 'OperationNoLongerAllowedError';
  }
}

export async function resumeContinuation(
  continuation: ContinuationState | undefined,
  config: AgentConfig,
  toolsList: readonly ToolSchemaEntry[],
  availableTools: Set<string>,
  mcpClient: Client,
  history: ChatMessage[],
  executedToolCalls: ToolCallRecord[],
  deps: AgentDeps,
): Promise<boolean> {
  if (continuation && continuation.rejected !== true) {
    const currentMcpTools = new Set(toolsList.map((tool) => tool.name));
    const allowedScenarios = new Set(config.allowedScenarios);
    const hasDisallowedCall = continuation.pendingToolCalls.some(
      (toolCall) =>
        !currentMcpTools.has(toolCall.name) ||
        !allowedScenarios.has(toolCall.name) ||
        !availableTools.has(toolCall.name),
    );
    if (hasDisallowedCall) throw new OperationNoLongerAllowedError();
  }

  if (continuation) {
    for (const pendingToolCall of continuation.pendingToolCalls) {
      const sanitizedArgs = enforceFieldAllowlist(
        pendingToolCall.name,
        pendingToolCall.args,
      );
      if (continuation.rejected === true) {
        history.push({
          role: 'tool',
          toolCallId: pendingToolCall.id,
          content: JSON.stringify({ error: 'rejected' }),
        });
        executedToolCalls.push({
          id: pendingToolCall.id,
          name: pendingToolCall.name,
          args: sanitizedArgs,
          error: 'rejected',
        });
        continue;
      }

      const enrichedArgs = requireValidToolCall(
        pendingToolCall.name,
        enrichToolCall(pendingToolCall.name, sanitizedArgs, config).args,
        toolsList,
      );
      await executeToolCall(
        mcpClient,
        pendingToolCall,
        enrichedArgs,
        history,
        executedToolCalls,
        deps,
      );
    }
  }
  return continuation?.rejected === true;
}
