import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ChatMessage, ToolDefinition } from './llm.js';
import { enforceFieldAllowlist, isToolAvailable } from './allowlist.js';
import { resumeContinuation } from './continuation.js';
import { isRiskyOperation } from './risky.js';
import { parseArguments, sanitizeReply } from './sanitize.js';
import { executeToolCall } from './toolExecutor.js';
import { enrichToolCall } from './enrich.js';
import { requireValidToolCall } from './validateToolCall.js';
import { buildSystemPrompt } from './prompts.js';
import type {
  AgentConfig,
  AgentDeps,
  AgentResult,
  ContinuationState,
  ToolCallRecord,
} from './agentTypes.js';

const MAX_ROUNDTRIPS = 5;

export async function runAgent(
  messages: ChatMessage[],
  config: AgentConfig,
  deps: AgentDeps,
  continuation?: ContinuationState,
): Promise<AgentResult> {
  const effectiveDefaults = { ...config.defaults, ...config.overrides };
  const effectiveConfig = { ...config, defaults: effectiveDefaults };
  const systemPrompt = buildSystemPrompt(
    config.clientConfig,
    config.overrides,
  );
  const mcpClient = new Client({ name: 'yookassa-agent', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    requestInit: {
      headers: { Authorization: `Bearer ${config.mcpToken}` },
    },
  });

  try {
    await mcpClient.connect(transport);
    const toolsListResponse = await mcpClient.listTools();
    const allowedScenarios = new Set(config.allowedScenarios);
    const tools: ToolDefinition[] = toolsListResponse.tools
      .filter((tool) =>
        isToolAvailable(
          tool.name,
          allowedScenarios,
          effectiveDefaults.vat_code,
        ),
      )
      .map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        parameters:
          (tool.inputSchema as Record<string, unknown> | undefined) ?? {
            type: 'object',
            properties: {},
          },
      }));
    const executedToolCalls: ToolCallRecord[] = [];
    const history: ChatMessage[] = continuation
      ? [...continuation.messages]
      : [{ role: 'system', content: systemPrompt }, ...messages];
    let roundtrip = continuation?.roundtrip ?? 0;

    const wasRejected = await resumeContinuation(
      continuation,
      effectiveConfig,
      toolsListResponse.tools,
      new Set(tools.map((tool) => tool.name)),
      mcpClient,
      history,
      executedToolCalls,
      deps,
    );
    if (wasRejected) {
      return {
        reply: 'Партия отклонена менеджером.',
        toolCalls: executedToolCalls,
      };
    }

    while (roundtrip < MAX_ROUNDTRIPS) {
      roundtrip += 1;
      const { stream, response } = await deps.provider.chat({
        model: deps.model,
        messages: history,
        tools,
      });

      let accumulatedText = '';
      const collectedToolCalls = new Map<
        string,
        { name: string; args: string }
      >();
      let finishReason: 'stop' | 'tool-calls' | 'length' | 'error' = 'stop';
      const reader = stream.getReader();
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        const value = chunk.value;
        if (value.type === 'text-delta') {
          accumulatedText += value.text;
        } else if (value.type === 'tool-call-start') {
          collectedToolCalls.set(value.toolCallId, {
            name: value.toolName,
            args: '',
          });
        } else if (value.type === 'tool-call-delta') {
          const entry = collectedToolCalls.get(value.toolCallId);
          if (entry !== undefined) entry.args += value.args;
        } else if (value.type === 'finish') {
          finishReason = value.finishReason;
        } else if (value.type === 'error') {
          throw value.error;
        }
      }
      reader.releaseLock();
      await response;

      if (finishReason !== 'tool-calls') {
        return {
          reply: sanitizeReply(accumulatedText),
          toolCalls: executedToolCalls,
        };
      }
      if (collectedToolCalls.size === 0) {
        if (accumulatedText !== '') {
          return {
            reply: sanitizeReply(accumulatedText),
            toolCalls: executedToolCalls,
          };
        }
        continue;
      }

      const assistantToolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];
      const malformedToolCalls: Array<{
        id: string;
        name: string;
        raw: string;
      }> = [];
      for (const [id, entry] of collectedToolCalls) {
        const args = parseArguments(entry.args);
        if (args === null) {
          malformedToolCalls.push({ id, name: entry.name, raw: entry.args });
          console.error('[agent] malformed args for', entry.name, entry.args);
          continue;
        }
        assistantToolCalls.push({ id, name: entry.name, args });
      }

      if (assistantToolCalls.length > 0) {
        history.push({
          role: 'assistant',
          content: accumulatedText,
          toolCalls: assistantToolCalls,
        });
      }
      for (const malformedToolCall of malformedToolCalls) {
        history.push({
          role: 'tool',
          toolCallId: malformedToolCall.id,
          content: JSON.stringify({ error: 'Malformed JSON arguments' }),
        });
      }

      const validatedToolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];
      const riskyToolCalls: typeof validatedToolCalls = [];
      for (const toolCall of assistantToolCalls) {
        const knownTool = tools.find((tool) => tool.name === toolCall.name);
        if (knownTool === undefined) {
          history.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Unknown tool' }),
          });
          continue;
        }

        const sanitizedToolCall = {
          id: toolCall.id,
          name: toolCall.name,
          args: requireValidToolCall(
            toolCall.name,
            enrichToolCall(
              toolCall.name,
              enforceFieldAllowlist(toolCall.name, toolCall.args),
              effectiveConfig,
            ).args,
            toolsListResponse.tools,
          ),
        };
        validatedToolCalls.push(sanitizedToolCall);
        if (isRiskyOperation(sanitizedToolCall, effectiveConfig)) {
          riskyToolCalls.push(sanitizedToolCall);
        }
      }

      if (riskyToolCalls.length > 0) {
        const proposedActions = validatedToolCalls.map(({ name, args }) => ({
          tool: name,
          args,
          requires_confirmation: isRiskyOperation(
            { name, args },
            effectiveConfig,
          ),
        }));
        return {
          reply:
            accumulatedText ||
            'Требуется подтверждение менеджера для выполнения операции.',
          toolCalls: executedToolCalls,
          requiresApproval: {
            approvalId: randomUUID(),
            toolName: riskyToolCalls[0].name,
            args: riskyToolCalls[0].args,
            proposedActions,
            continuation: {
              messages: history,
              pendingToolCalls: validatedToolCalls,
              roundtrip,
            },
          },
        };
      }

      for (const toolCall of validatedToolCalls) {
        await executeToolCall(
          mcpClient,
          toolCall,
          toolCall.args,
          history,
          executedToolCalls,
          deps,
        );
      }
    }

    return {
      reply: 'Превышен лимит итераций агента — операция не завершена.',
      toolCalls: executedToolCalls,
    };
  } finally {
    try {
      await mcpClient.close();
    } catch {
      // Ignore close errors — the connection is being discarded anyway.
    }
  }
}
