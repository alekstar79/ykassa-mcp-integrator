import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ChatMessage,
  ChatResponse,
  ChatStreamChunk,
  ToolDefinition,
} from './llm.js';
import { enforceFieldAllowlist, isToolAvailable } from './allowlist.js';
import { resumeContinuation } from './continuation.js';
import { isRiskyOperation } from './risky.js';
import { parseArguments, sanitizeReply } from './sanitize.js';
import { executeToolCall } from './toolExecutor.js';
import { enrichToolCall } from './enrich.js';
import { requireValidToolCall } from './validateToolCall.js';
import { buildSystemPrompt } from './prompts.js';
import { HttpError } from './http.js';
import type {
  AgentConfig,
  AgentDeps,
  AgentResult,
  ContinuationState,
  ToolCallRecord,
} from './agentTypes.js';

const MAX_ROUNDTRIPS = 5;
const CHAT_HISTORY_TOOL_NAME = 'get_chat_history';
const CHAT_HISTORY_TOOL: ToolDefinition = {
  name: CHAT_HISTORY_TOOL_NAME,
  description:
    'Retrieve relevant earlier user requests, assistant replies, and payment tool results from this conversation session.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'What earlier fact or object to find. Use the current request as the query when it refers to prior conversation.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 8,
        description: 'Maximum number of earlier conversation turns to return.',
      },
    },
    additionalProperties: false,
  },
};
const APPROVAL_RECOVERY_INSTRUCTION =
  'The previous response incorrectly asked for approval in chat text. Do not ask for approval in text. Call only the provided creation tool with the requested operation. The API will stop before execution and return an approval card.';

class ApprovalCardRecoveryError extends HttpError {
  constructor() {
    super(
      503,
      'Не удалось подготовить карточку подтверждения. Операция не выполнялась; повторите запрос.',
    );
    this.name = 'ApprovalCardRecoveryError';
  }
}

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
    tools.push(CHAT_HISTORY_TOOL);
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

    let forcedToolName: string | undefined;
    while (roundtrip < MAX_ROUNDTRIPS) {
      roundtrip += 1;
      const requestTools =
        forcedToolName === undefined
          ? tools
          : tools.filter((tool) => tool.name === forcedToolName);
      if (
        forcedToolName !== undefined &&
        (deps.provider.supportsRequiredToolChoice !== true ||
          requestTools.length !== 1)
      ) {
        throw new ApprovalCardRecoveryError();
      }

      let stream: ReadableStream<ChatStreamChunk>;
      let response: Promise<ChatResponse>;
      try {
        ({ stream, response } = await deps.provider.chat({
          model: deps.model,
          messages: history,
          tools: requestTools,
          ...(forcedToolName === undefined
            ? {}
            : { toolChoice: 'required' as const }),
        }));
      } catch (error) {
        if (forcedToolName !== undefined) {
          throw new ApprovalCardRecoveryError();
        }
        throw error;
      }

      let accumulatedText = '';
      const collectedToolCalls = new Map<
        string,
        { name: string; args: string }
      >();
      let finishReason: 'stop' | 'tool-calls' | 'length' | 'error' = 'stop';
      const reader = stream.getReader();
      try {
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
        await response;
      } catch (error) {
        if (forcedToolName !== undefined) {
          throw new ApprovalCardRecoveryError();
        }
        throw error;
      } finally {
        reader.releaseLock();
      }

      if (finishReason !== 'tool-calls' || collectedToolCalls.size === 0) {
        if (forcedToolName !== undefined) {
          throw new ApprovalCardRecoveryError();
        }
        const recoveryToolName =
          continuation === undefined && finishReason === 'stop'
            ? confirmationRecoveryTool(messages, accumulatedText)
            : undefined;
        if (recoveryToolName !== undefined) {
          const systemMessage = history.find(
            (message) => message.role === 'system',
          );
          if (
            deps.provider.supportsRequiredToolChoice !== true ||
            !tools.some((tool) => tool.name === recoveryToolName) ||
            systemMessage === undefined
          ) {
            throw new ApprovalCardRecoveryError();
          }
          systemMessage.content += `\n\n${APPROVAL_RECOVERY_INSTRUCTION}`;
          forcedToolName = recoveryToolName;
          continue;
        }
        return {
          reply: sanitizeReply(accumulatedText),
          toolCalls: executedToolCalls,
        };
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

      if (
        forcedToolName !== undefined &&
        (assistantToolCalls.length === 0 ||
          assistantToolCalls.some((toolCall) => toolCall.name !== forcedToolName))
      ) {
        throw new ApprovalCardRecoveryError();
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

      const requestedChatHistory =
        assistantToolCalls.some(
          (toolCall) => toolCall.name === CHAT_HISTORY_TOOL_NAME,
        ) ||
        malformedToolCalls.some(
          (toolCall) => toolCall.name === CHAT_HISTORY_TOOL_NAME,
        );
      if (requestedChatHistory) {
        for (const toolCall of assistantToolCalls) {
          if (toolCall.name === CHAT_HISTORY_TOOL_NAME) {
            const query = toolCall.args.query;
            const limit = toolCall.args.limit;
            if (
              (query !== undefined && typeof query !== 'string') ||
              (limit !== undefined &&
                (typeof limit !== 'number' ||
                  !Number.isInteger(limit) ||
                  limit < 1 ||
                  limit > 8)) ||
              Object.keys(toolCall.args).some(
                (key) => key !== 'query' && key !== 'limit',
              )
            ) {
              history.push({
                role: 'tool',
                toolCallId: toolCall.id,
                content: JSON.stringify({
                  error: 'query must be a string and limit must be an integer from 1 to 8.',
                }),
              });
              continue;
            }
            if (deps.getChatHistory === undefined) {
              history.push({
                role: 'tool',
                toolCallId: toolCall.id,
                content: JSON.stringify({
                  error: 'History retrieval is unavailable for this request.',
                }),
              });
              continue;
            }
            const content = await deps.getChatHistory(
              typeof query === 'string' ? query : '',
              typeof limit === 'number' ? limit : 4,
            );
            history.push({
              role: 'tool',
              toolCallId: toolCall.id,
              content,
            });
            continue;
          }
          history.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error:
                'Retrieve and review chat history before calling any other tool.',
            }),
          });
        }
        continue;
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

        let sanitizedToolCall: {
          id: string;
          name: string;
          args: Record<string, unknown>;
        };
        try {
          sanitizedToolCall = {
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
        } catch (error) {
          if (forcedToolName !== undefined) {
            throw new ApprovalCardRecoveryError();
          }
          throw error;
        }
        validatedToolCalls.push(sanitizedToolCall);
        if (
          isRiskyOperation(sanitizedToolCall, effectiveConfig) ||
          sanitizedToolCall.name === forcedToolName
        ) {
          riskyToolCalls.push(sanitizedToolCall);
        }
      }

      if (riskyToolCalls.length > 0) {
        const proposedActions = validatedToolCalls.map(({ name, args }) => ({
          tool: name,
          args,
          requires_confirmation:
            isRiskyOperation({ name, args }, effectiveConfig) ||
            name === forcedToolName,
        }));
        return {
          reply:
            forcedToolName !== undefined
              ? ''
              : accumulatedText ||
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

    function confirmationRecoveryTool(
      messages: ChatMessage[],
      reply: string,
    ): string | undefined {
      if (
        !/подтверд|одобр|согласован|продолж|please\s+(?:confirm|approve)|\b(?:confirm|approval|approve|proceed|continue)\b/iu.test(
          reply,
        )
      ) {
        return undefined;
      }

      let latestUserMessage: string | undefined;
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role === 'user') {
          latestUserMessage = message.content;
          break;
        }
      }
      if (latestUserMessage === undefined) return undefined;

      const createVerb =
        /создай(?:те)?|создать|сформируй(?:те)?|сформировать|сделай(?:те)?|сделать|выставь(?:те)?|выставить|create|make|generate|issue/iu.exec(
          latestUserMessage,
        );
      if (createVerb === null) return undefined;

      if (
        /^\s*(?:как(?:\s+мне)?\s+|how\s+(?:do|can)\s+|how\s+to\s+)/iu.test(
          latestUserMessage,
        ) ||
        /(?:^|[\s,])не\s+(?:(?:надо|нужно)\s+)?(?:созда|сформир|сдел|выстав)/iu.test(
          latestUserMessage,
        ) ||
        /\b(?:don't|do not|never)\s+(?:want\s+to\s+)?(?:create|make|generate|issue)\b/iu.test(
          latestUserMessage,
        )
      ) {
        return undefined;
      }

      const prefix = latestUserMessage.slice(0, createVerb.index).trimEnd();
      if (/(?:^|[\s,])(?:не|как|how|don't|do not|never)\s*$/iu.test(prefix)) {
        return undefined;
      }

      const asksForPayment = /плат[её]ж|оплат|payment/iu.test(latestUserMessage);
      const asksForInvoice = /сч[её]т|invoice/iu.test(latestUserMessage);
      if (asksForPayment === asksForInvoice) return undefined;
      return asksForPayment ? 'create_payment' : 'create_invoice';
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
