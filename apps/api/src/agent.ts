import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ChatMessage,
  ToolDefinition,
} from './llm.js';
import {
  ALLOWED_FIELDS,
  enforceFieldAllowlist,
  isToolAvailable,
} from './allowlist.js';
import { resumeContinuation } from './continuation.js';
import { isRiskyOperation } from './risky.js';
import { parseArguments, sanitizeReply } from './sanitize.js';
import { executeToolCall } from './toolExecutor.js';
import { enrichToolCall } from './enrich.js';
import {
  requireValidToolCall,
  type ToolSchemaEntry,
  validateToolCall,
} from './validateToolCall.js';
import {
  buildFinancialPlannerPrompt,
  buildSystemPrompt,
} from './prompts.js';
import {
  detectFinancialCreationIntent,
  disallowedOperationFields,
  extractOperationPlan,
} from './operationPlanner.js';
import { HttpError, isRecord } from './http.js';
import type {
  AgentConfig,
  AgentDeps,
  AgentResult,
  ContinuationState,
  ToolCallRecord,
} from './agentTypes.js';

const MAX_ROUNDTRIPS = 5;
const FINANCIAL_CREATION_TOOLS = new Set([
  'create_payment',
  'create_invoice',
]);
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
export async function runAgent(
  messages: ChatMessage[],
  config: AgentConfig,
  deps: AgentDeps,
  continuation?: ContinuationState,
): Promise<AgentResult> {
  const identityReply = getAssistantIdentityReply(
    messages,
    config.clientConfig.brand?.display_name,
    deps.model,
  );
  if (identityReply !== undefined) {
    return { reply: identityReply, toolCalls: [] };
  }

  const effectiveDefaults = { ...config.defaults, ...config.overrides };
  const effectiveConfig = { ...config, defaults: effectiveDefaults };
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
    const availableMcpTools = toolsListResponse.tools.filter((tool) =>
      isToolAvailable(
        tool.name,
        allowedScenarios,
        effectiveDefaults.vat_code,
      ),
    );
    const availableToolNames = new Set(
      availableMcpTools.map((tool) => tool.name),
    );
    const executedToolCalls: ToolCallRecord[] = [];

    if (continuation?.deterministicExecution === true) {
      const history = [...continuation.messages];
      const wasRejected = await resumeContinuation(
        continuation,
        effectiveConfig,
        toolsListResponse.tools,
        availableToolNames,
        mcpClient,
        history,
        executedToolCalls,
        deps,
      );
      return {
        reply: deterministicOperationReply(
          executedToolCalls,
          wasRejected,
          getReplyLanguage(history),
        ),
        toolCalls: executedToolCalls,
      };
    }

    const latestUserMessage =
      [...messages].reverse().find((message) => message.role === 'user')
        ?.content ?? '';
    const capabilitiesReply = getAssistantCapabilitiesReply(
      messages,
      availableMcpTools.map(({ name }) => name),
    );
    if (capabilitiesReply !== undefined) {
      return { reply: capabilitiesReply, toolCalls: executedToolCalls };
    }

    const sessionContext =
      deps.getChatHistory === undefined
        ? 'История этой сессии недоступна.'
        : await deps.getChatHistory(latestUserMessage, 4);
    let requestedFinancialTools = detectFinancialCreationIntent(messages);
    if (requestedFinancialTools.length === 0) {
      const pendingTool = findPendingFinancialTool(
        sessionContext,
        latestUserMessage,
      );
      if (pendingTool !== undefined) requestedFinancialTools = [pendingTool];
    }
    if (requestedFinancialTools.length > 0) {
      const availableFinancialTools = availableMcpTools.filter((tool) =>
        FINANCIAL_CREATION_TOOLS.has(tool.name),
      );
      const availableFinancialNames = new Set(
        availableFinancialTools.map((tool) => tool.name),
      );
      const unavailable = requestedFinancialTools.filter(
        (tool) => !availableFinancialNames.has(tool),
      );
      if (unavailable.length > 0) {
        return {
          reply: humanReply(messages, {
            ru: 'Эта операция недоступна для выбранного магазина. Ничего не создано.',
            en: 'This operation is not available for the selected store. Nothing was created.',
          }),
          toolCalls: executedToolCalls,
        };
      }

      return await runFinancialOperationPlan(
        messages,
        effectiveConfig,
        deps,
        mcpClient,
        toolsListResponse.tools,
        availableFinancialTools,
        requestedFinancialTools,
        sessionContext,
      );
    }

    const tools: ToolDefinition[] = availableMcpTools
      .filter((tool) => !FINANCIAL_CREATION_TOOLS.has(tool.name))
      .filter((tool) =>
        tool.name !== CHAT_HISTORY_TOOL_NAME,
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
    const systemPrompt = buildSystemPrompt(
      config.clientConfig,
      config.overrides,
      tools.map((tool) => tool.name),
      deps.model,
    );
    const history: ChatMessage[] = continuation
      ? [...continuation.messages]
      : [{ role: 'system', content: systemPrompt }, ...messages];
    let roundtrip = continuation?.roundtrip ?? 0;

    const wasRejected = await resumeContinuation(
      continuation,
      effectiveConfig,
      toolsListResponse.tools,
      availableToolNames,
      mcpClient,
      history,
      executedToolCalls,
      deps,
    );
    if (wasRejected) {
      return {
        reply: humanReply(messages, {
          ru: 'Операция отменена. Ничего не создано.',
          en: 'The operation was cancelled. Nothing was created.',
        }),
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
      } finally {
        reader.releaseLock();
      }

      if (finishReason !== 'tool-calls' || collectedToolCalls.size === 0) {
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

        const sanitizedToolCall: {
          id: string;
          name: string;
          args: Record<string, unknown>;
        } = {
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
      reply: humanReply(messages, {
        ru: 'Не удалось завершить запрос. Попробуйте сформулировать его иначе.',
        en: 'I could not complete the request. Please try rephrasing it.',
      }),
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

async function runFinancialOperationPlan(
  messages: ChatMessage[],
  config: AgentConfig,
  deps: AgentDeps,
  mcpClient: Client,
  toolsList: readonly ToolSchemaEntry[],
  availableTools: readonly (ToolSchemaEntry & { description?: string })[],
  requestedTools: readonly string[],
  sessionContext: string,
): Promise<AgentResult> {
  const toolSchemas = availableTools
    .filter((tool) => requestedTools.includes(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: filterPlannerSchema(tool.name, tool.inputSchema),
    }));
  const systemPrompt = buildFinancialPlannerPrompt(
    config.clientConfig,
    config.overrides ?? {},
    toolSchemas,
    sessionContext,
  );
  const history: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  const plan = await extractOperationPlan(
    deps.provider,
    deps.model,
    history,
    toolSchemas,
  );

  if (plan.operations.length === 0) {
    return {
      reply: humanReply(messages, {
        ru: 'Не удалось понять, что нужно создать. Ничего не создано. Уточните, нужна платёжная ссылка или счёт.',
        en: 'I could not determine what should be created. Nothing was created. Please clarify whether you need a payment link or an invoice.',
      }),
      toolCalls: [],
    };
  }
  if (plan.operations.length > 1 && !isBatchRequest(messages)) {
    return {
      reply: humanReply(messages, {
        ru: 'В запросе получилось несколько операций. Ничего не создано. Уточните, что именно нужно выполнить.',
        en: 'The request could mean several different operations. Nothing was created; please clarify what you want done.',
      }),
      toolCalls: [],
    };
  }

  const validatedToolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }> = [];
  for (const operation of plan.operations) {
    const allowedFields = ALLOWED_FIELDS[operation.tool];
    if (allowedFields === undefined) {
      return {
        reply: humanReply(messages, {
          ru: 'Не удалось безопасно подготовить эту операцию. Ничего не создано.',
          en: 'I could not safely prepare this operation. Nothing was created.',
        }),
        toolCalls: [],
      };
    }

    const disallowedFields = disallowedOperationFields(
      operation.args,
      allowedFields,
    );
    if (disallowedFields.length > 0) {
      return {
        reply: humanReply(messages, {
          ru: 'Не удалось безопасно подготовить операцию. Ничего не создано. Уточните запрос и попробуйте ещё раз.',
          en: 'I could not safely prepare the operation. Nothing was created; please clarify the request and try again.',
        }),
        toolCalls: [],
      };
    }
    if (
      operation.tool === 'create_payment' &&
      (typeof operation.args.description !== 'string' ||
        operation.args.description.trim() === '')
    ) {
      return {
        reply: humanReply(messages, {
          ru: 'Укажите, за что будет платёжная ссылка. Пока ничего не создано.',
          en: 'Please specify what the payment link is for. Nothing has been created yet.',
        }),
        toolCalls: [],
      };
    }

    let enrichedArgs: Record<string, unknown>;
    try {
      enrichedArgs = enrichToolCall(
        operation.tool,
        operation.args,
        config,
      ).args;
    } catch (error) {
      if (error instanceof HttpError) {
        return {
          reply: humanReply(messages, {
            ru: 'Не удалось подготовить параметры операции. Проверьте сумму и описание, затем повторите запрос.',
            en: 'I could not prepare the operation details. Check the amount and description, then try again.',
          }),
          toolCalls: [],
        };
      }
      throw error;
    }

    const validation = validatePlannedToolCall(
      operation.tool,
      enrichedArgs,
      toolsList,
    );
    if (validation.args === undefined) {
      return {
        reply: formatPlanValidationReply(
          operation.tool,
          validation.errors,
          getReplyLanguage(messages),
        ),
        toolCalls: [],
      };
    }
    validatedToolCalls.push({
      id: randomUUID(),
      name: operation.tool,
      args: validation.args,
    });
  }

  const proposedActions = validatedToolCalls.map(({ name, args }) => ({
    tool: name,
    args,
    requires_confirmation: isRiskyOperation({ name, args }, config),
  }));
  if (proposedActions.some((action) => action.requires_confirmation)) {
    return {
      reply: approvalReviewReply(
        validatedToolCalls.map((toolCall) => toolCall.name),
        getReplyLanguage(messages),
      ),
      toolCalls: [],
      requiresApproval: {
        approvalId: randomUUID(),
        toolName:
          proposedActions.find((action) => action.requires_confirmation)?.tool ??
          validatedToolCalls[0]?.name ??
          '',
        args: validatedToolCalls[0]?.args ?? {},
        proposedActions,
        continuation: {
          messages: history,
          pendingToolCalls: validatedToolCalls,
          roundtrip: 1,
          deterministicExecution: true,
        },
      },
    };
  }

  const executedToolCalls: ToolCallRecord[] = [];
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
  return {
    reply: deterministicOperationReply(
      executedToolCalls,
      false,
      getReplyLanguage(messages),
    ),
    toolCalls: executedToolCalls,
  };
}

function findPendingFinancialTool(
  sessionContext: string,
  latestUserMessage: string,
): string | undefined {
  const latestText = latestUserMessage.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  if (
    /^\s*(?:не\s|отмен|передум|stop\b|cancel\b|don't\b|do not\b|never\b|как\s|сколько\s|почему\s|покажи\s|проверь\s|найди\s|объясни\s|расскажи\s)/iu.test(
      latestText,
    )
  ) {
    return undefined;
  }

  const trimmedContext = sessionContext.trim();
  if (!trimmedContext.startsWith('[')) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedContext);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpError(
        500,
        'Could not parse session history for the pending financial operation.',
      );
    }
    throw error;
  }
  if (!Array.isArray(parsed)) return undefined;

  let assistantIndex = -1;
  for (let index = parsed.length - 1; index >= 0; index -= 1) {
    const message = parsed[index];
    if (
      isRecord(message) &&
      message.role === 'assistant' &&
      typeof message.content === 'string'
    ) {
      const isMissingInformationReply =
        message.content.startsWith('Для платёжной ссылки не хватает данных:') ||
        message.content.startsWith('Для счёта не хватает данных:') ||
        message.content.startsWith(
          'Укажите, за что будет платёжная ссылка.',
        ) ||
        message.content.startsWith('I still need ') ||
        message.content.startsWith(
          'Please specify what the payment link is for.',
        );
      if (!isMissingInformationReply) return undefined;
      if (
        (message.content.includes('сумму') ||
          message.content.includes('the amount')) &&
        !/(?:\d|руб|₽|тысяч|миллион|ноль|один|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|сто|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)/iu.test(
          latestText,
        )
      ) {
        return undefined;
      }
      assistantIndex = index;
      break;
    }
  }
  if (assistantIndex === -1) return undefined;

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = parsed[index];
    if (
      isRecord(message) &&
      message.role === 'user' &&
      typeof message.content === 'string'
    ) {
      const [tool] = detectFinancialCreationIntent([
        { role: 'user', content: message.content },
      ]);
      return tool;
    }
  }
  return undefined;
}

function validatePlannedToolCall(
  toolName: string,
  args: Record<string, unknown>,
  tools: readonly ToolSchemaEntry[],
): { args?: Record<string, unknown>; errors: string[] } {
  const validation = validateToolCall(toolName, args, tools);
  if (!validation.valid) return { errors: validation.errors };
  if (!isRecord(validation.fixedArgs)) {
    return {
      errors: [`${toolName}: tool arguments must be an object`],
    };
  }
  return { args: validation.fixedArgs, errors: [] };
}

function filterPlannerSchema(toolName: string, value: unknown): unknown {
  const allowedFields = ALLOWED_FIELDS[toolName];
  if (allowedFields === undefined) return value;
  return filterSchemaNode(value, allowedFields, true);
}

function filterSchemaNode(
  value: unknown,
  allowedTopLevelFields: ReadonlySet<string>,
  isTopLevel: boolean,
): unknown {
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = { ...value };
  if (isRecord(value.properties)) {
    const properties = Object.fromEntries(
      Object.entries(value.properties)
        .filter(([key]) =>
          isTopLevel
            ? allowedTopLevelFields.has(key)
            : key !== 'gateway_id',
        )
        .map(([key, schema]) => [
          key,
          filterSchemaNode(schema, allowedTopLevelFields, false),
        ]),
    );
    result.properties = properties;
    if (Array.isArray(value.required)) {
      result.required = value.required.filter(
        (key): key is string =>
          typeof key === 'string' &&
          Object.hasOwn(properties, key) &&
          !['currency', 'capture', 'vat_code', 'expires_at'].includes(key),
      );
    }
  }
  if (isRecord(value.items)) {
    result.items = filterSchemaNode(value.items, allowedTopLevelFields, false);
  }
  for (const keyword of ['oneOf', 'anyOf', 'allOf']) {
    const schemas = value[keyword];
    if (Array.isArray(schemas)) {
      result[keyword] = schemas.map((schema) =>
        filterSchemaNode(schema, allowedTopLevelFields, false),
      );
    }
  }
  return result;
}

function isBatchRequest(messages: readonly ChatMessage[]): boolean {
  const request = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n')
    .toLocaleLowerCase('ru');
  return /пользователь приложил файл|из списка|по списку|кажд(?:ому|ого|ой|ым)|всем получател|массов|batch|spreadsheet/iu.test(
    request,
  );
}

function formatPlanValidationReply(
  toolName: string,
  errors: readonly string[],
  language: ReplyLanguage,
): string {
  const missingFields = errors.flatMap((error) => {
    const match = /^(.*?): must have required property '([^']+)'$/u.exec(
      error,
    );
    if (match === null) return [];
    return [match[1] ?? match[2] ?? ''];
  });
  if (missingFields.includes('gateway_id')) {
    return humanReply(language, {
      ru: 'Не удалось безопасно подготовить платёж. Ничего не создано; попробуйте ещё раз или обратитесь к администратору.',
      en: 'I could not safely prepare the payment. Nothing was created; try again or contact your administrator.',
    });
  }

  const labels: Record<string, Record<ReplyLanguage, string>> = {
    amount: { ru: 'сумму', en: 'the amount' },
    value: { ru: 'сумму', en: 'the amount' },
    currency: { ru: 'валюту', en: 'the currency' },
    'amount.value': { ru: 'сумму', en: 'the amount' },
    'amount.currency': { ru: 'валюту', en: 'the currency' },
    description: { ru: 'назначение платежа', en: 'a description' },
    cart: { ru: 'состав счёта', en: 'the invoice items' },
    expires_at: { ru: 'срок действия счёта', en: 'the invoice expiry' },
    id: { ru: 'номер операции', en: 'the operation ID' },
  };
  const missingLabels = [
    ...new Set(
      missingFields.map(
        (field) =>
          labels[field]?.[language] ??
          (language === 'ru' ? 'нужные данные' : 'the required details'),
      ),
    ),
  ];
  if (missingLabels.length > 0) {
    const operationLabel =
      toolName === 'create_invoice'
        ? language === 'ru'
          ? 'счёта'
          : 'an invoice'
        : language === 'ru'
          ? 'платёжной ссылки'
          : 'a payment link';
    return language === 'ru'
      ? `Для ${operationLabel} не хватает данных: ${missingLabels.join(', ')}. Пока ничего не создано.`
      : `I still need ${missingLabels.join(', ')} to create ${operationLabel}. Nothing has been created yet.`;
  }
  return humanReply(language, {
    ru: 'Не удалось проверить параметры операции. Ничего не создано. Проверьте сумму и описание, затем повторите запрос.',
    en: 'I could not verify the operation details. Nothing was created. Check the amount and description, then try again.',
  });
}

function deterministicOperationReply(
  toolCalls: readonly ToolCallRecord[],
  wasRejected: boolean,
  language: ReplyLanguage,
): string {
  if (wasRejected) {
    return humanReply(language, {
      ru: 'Операция отменена. Ничего не создано.',
      en: 'The operation was cancelled. Nothing was created.',
    });
  }
  if (toolCalls.length === 0) {
    return humanReply(language, {
      ru: 'Не удалось завершить операцию. Попробуйте ещё раз.',
      en: 'The operation could not be completed. Please try again.',
    });
  }

  const summaries = toolCalls.map((toolCall) =>
    formatCreatedOperation(toolCall, language),
  );
  return summaries.length === 1
    ? summaries[0] ?? ''
    : `${language === 'ru' ? 'Готово. Результаты:' : 'Done. Results:'}\n\n${summaries.map((summary) => `- ${summary}`).join('\n')}`;
}

function formatCreatedOperation(
  toolCall: ToolCallRecord,
  language: ReplyLanguage,
): string {
  const isInvoice = toolCall.name === 'create_invoice';
  const operationName =
    language === 'ru'
      ? isInvoice
        ? 'Счёт'
        : 'Платёжная ссылка'
      : isInvoice
        ? 'Invoice'
        : 'Payment link';

  if (toolCall.error !== undefined) {
    return language === 'ru'
      ? `Не удалось создать ${isInvoice ? 'счёт' : 'платёжную ссылку'}. Проверьте данные и повторите запрос.`
      : `I could not create the ${isInvoice ? 'invoice' : 'payment link'}. Check the details and try again.`;
  }

  const result = parseToolResult(toolCall.result);
  const args = isRecord(toolCall.args) ? toolCall.args : {};
  const amount =
    formatMoney(result?.amount, language) ??
    formatMoney(args.amount ?? args.total_amount, language);
  const description =
    typeof args.description === 'string'
      ? args.description.trim().replaceAll(/\s+/gu, ' ')
      : '';
  const hasPaymentLink = isSafeConfirmationUrl(result?.confirmation_url);

  if (!hasPaymentLink) {
    return language === 'ru'
      ? `${operationName} подготовлен, но ссылка для оплаты не получена. Проверьте результат в личном кабинете.`
      : `${operationName} was prepared, but no payment link was returned. Please check your account dashboard.`;
  }

  const amountText =
    amount === undefined
      ? ''
      : language === 'ru'
        ? ` на ${amount}`
        : ` for ${amount}`;
  const descriptionText =
    description.length === 0
      ? ''
      : language === 'ru'
        ? `, назначение: «${description}»`
        : `, purpose: “${description}”`;
  const pendingText =
    result?.status === 'pending'
      ? language === 'ru'
        ? ' Ссылка ожидает оплаты.'
        : ' It is waiting for payment.'
      : '';

  if (language === 'ru') {
    return `${operationName}${amountText}${descriptionText} ${isInvoice ? 'создан' : 'создана'}.${pendingText} Ссылка доступна ниже.`;
  }
  return `${operationName}${amountText}${descriptionText} is ready.${pendingText} The link is available below.`;
}

function isSafeConfirmationUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'yoomoney.ru' &&
      url.pathname.startsWith('/checkout/')
    );
  } catch {
    return false;
  }
}

function parseToolResult(result: string | undefined): Record<string, unknown> | undefined {
  if (result === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(result);
    return isRecord(parsed) ? parsed : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function formatMoney(value: unknown, language: ReplyLanguage): string | undefined {
  const amountValue = isRecord(value) ? value.value : value;
  if (
    (typeof amountValue !== 'string' && typeof amountValue !== 'number') ||
    (typeof amountValue === 'string' && amountValue.trim() === '')
  ) {
    return undefined;
  }
  const numericAmount = Number(amountValue);
  if (!Number.isFinite(numericAmount)) return undefined;

  const currency = isRecord(value) && typeof value.currency === 'string'
    ? value.currency.toUpperCase()
    : '';
  const numberText = numericAmount.toLocaleString(
    language === 'ru' ? 'ru-RU' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const suffix =
    currency === 'RUB'
      ? language === 'ru'
        ? ' ₽'
        : ' RUB'
      : currency.length > 0
        ? ` ${currency}`
        : '';
  return `${numberText}${suffix}`;
}

type ReplyLanguage = 'ru' | 'en';

function getReplyLanguage(messages: readonly ChatMessage[]): ReplyLanguage {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content;
  return latestUserMessage !== undefined && /[а-яё]/iu.test(latestUserMessage)
    ? 'ru'
    : 'en';
}

function getAssistantIdentityReply(
  messages: readonly ChatMessage[],
  brandName: string | undefined,
  modelName: string,
): string | undefined {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content;
  if (latestUserMessage === undefined) return undefined;

  const identityQuestion =
    /^(?:(?:привет[, ]*)?(?:кто ты|ты кто|представься|как тебя зовут|на какой модели ты(?: работаешь)?|какая у тебя модель|какую модель ты используешь)|(?:hi[, ]*)?(?:who are you|what model are you|introduce yourself|what are you|which model are you using))[?.! ]*$/iu;
  if (!identityQuestion.test(latestUserMessage.trim())) return undefined;

  const language = getReplyLanguage(messages);
  if (language === 'ru') {
    const serviceName =
      brandName === undefined ? '' : ` сервиса «${brandName}»`;
    return `Я ИИ-ассистент${serviceName}. Сейчас используется модель ${modelName}.`;
  }

  const serviceName =
    brandName === undefined ? '' : ` for ${brandName}`;
  return `I'm an AI assistant${serviceName}. The configured model is ${modelName}.`;
}

function getAssistantCapabilitiesReply(
  messages: readonly ChatMessage[],
  availableTools: readonly string[],
): string | undefined {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content;
  const capabilitiesQuestion =
    /^(?:(?:а|ну)\s+)?(?:что\s+(?:(?:ещё|еще)\s+)?(?:ты\s+)?(?:умеешь|можешь)(?:\s+(?:ещё|еще))?(?:\s+(?:делать|выполнять))?|какие\s+(?:у\s+тебя\s+)?(?:есть\s+)?возможности|чем\s+(?:ты\s+)?можешь\s+помочь|what\s+(?:(?:else)\s+)?can\s+you\s+do|what\s+are\s+you\s+able\s+to\s+do|what\s+are\s+your\s+capabilities|how\s+can\s+you\s+help)[?.! ]*$/iu;
  if (
    latestUserMessage === undefined ||
    !capabilitiesQuestion.test(latestUserMessage.trim())
  ) {
    return undefined;
  }

  const language = getReplyLanguage(messages);
  const hasTool = (...names: string[]) =>
    names.some((name) => availableTools.includes(name));
  const capabilities: string[] = [];

  if (hasTool('get_payment', 'get_payments')) {
    capabilities.push(
      language === 'ru'
        ? 'найти платёж и проверить его данные'
        : 'find a payment and check its details',
    );
  }
  if (hasTool('get_invoice')) {
    capabilities.push(
      language === 'ru'
        ? 'проверить счёт и его статус'
        : 'check an invoice and its status',
    );
  }
  if (hasTool('create_payment')) {
    capabilities.push(
      language === 'ru'
        ? 'создать платёжную ссылку; перед созданием покажу детали и, если потребуется, попрошу подтвердить'
        : 'create a payment link; I will show the details first and ask for approval if required',
    );
  }
  if (hasTool('create_invoice')) {
    capabilities.push(
      language === 'ru'
        ? 'выставить счёт; перед оформлением покажу детали и, если потребуется, попрошу подтвердить'
        : 'issue an invoice; I will show the details first and ask for approval if required',
    );
  }
  if (hasTool('get_refund', 'get_refunds')) {
    capabilities.push(
      language === 'ru'
        ? 'найти возврат и проверить его статус'
        : 'find a refund and check its status',
    );
  }

  if (language === 'ru') {
    capabilities.push('ответить на общие вопросы и помочь с расчётами');
    return [
      'Я могу:',
      ...capabilities.map((capability) => `- ${capability}.`),
      '',
      'Актуальные внешние данные, например погоду или курсы валют, сейчас проверить не могу.',
    ].join('\n');
  }

  capabilities.push('answer general questions and help with calculations');
  return [
    'I can:',
    ...capabilities.map((capability) => `- ${capability}.`),
    '',
    'I cannot check current external information such as weather or exchange rates.',
  ].join('\n');
}

function humanReply(
  messages: readonly ChatMessage[],
  values: Record<ReplyLanguage, string>,
): string;
function humanReply(
  language: ReplyLanguage,
  values: Record<ReplyLanguage, string>,
): string;
function humanReply(
  source: readonly ChatMessage[] | ReplyLanguage,
  values: Record<ReplyLanguage, string>,
): string {
  const language =
    typeof source === 'string' ? source : getReplyLanguage(source);
  return values[language];
}

function approvalReviewReply(
  toolNames: readonly string[],
  language: ReplyLanguage,
): string {
  const invoicesOnly =
    toolNames.includes('create_invoice') &&
    !toolNames.includes('create_payment');
  if (language === 'ru') {
    return invoicesOnly
      ? 'Проверьте сумму и состав счёта. После подтверждения счёт будет создан.'
      : 'Проверьте сумму и назначение. После подтверждения платёжная ссылка будет создана.';
  }
  return invoicesOnly
    ? 'Review the amount and invoice details. The invoice will be created after you approve it.'
    : 'Review the amount and description. The payment link will be created after you approve it.';
}
