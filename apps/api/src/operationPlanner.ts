import type {
  ChatMessage,
  LLMProvider,
  ToolDefinition,
} from './llm.js';
import { HttpError, isRecord } from './http.js';
import { parseArguments } from './sanitize.js';

export const OPERATION_PLAN_TOOL_NAME = 'prepare_operation';
export const MAX_PLANNED_OPERATIONS = 20;

export interface PlannedOperation {
  tool: string;
  args: Record<string, unknown>;
}

export interface OperationPlan {
  operations: PlannedOperation[];
  reply: string;
}

export interface PlannerToolSchema {
  name: string;
  inputSchema: unknown;
}

export function detectFinancialCreationIntent(
  messages: readonly ChatMessage[],
): string[] {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content;
  if (latestUserMessage === undefined) return [];

  const text = latestUserMessage.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  if (
    /^\s*(?:как(?:\s+мне)?\s+|how\s+(?:do|can|to)\s+)/iu.test(text) ||
    /(?:объясни|подскажи|расскажи|покажи|explain|tell\s+me)[\s\S]{0,100}(?:как\s+)?(?:созда|сформир|сдела|выстав|сгенер|оформ)\p{L}*|(?:explain|tell\s+me)[\s\S]{0,100}\b(?:create|make|generate|issue)\b/iu.test(
      text,
    ) ||
    /(?:^|\s)(?:не\s+(?:(?:надо|нужно|следует|хочу)\s+)?(?:созда|сформир|сдела|выстав|сгенер|оформ)\p{L}*|(?:don't|do not|never)\s+(?:want\s+to\s+)?(?:create|make|generate|issue))(?=$|[\s,.!?])/iu.test(
      text,
    )
  ) {
    return [];
  }

  const intentText = text.replace(/\b(?:create|make|generate|issue)_[\w]+\b/giu, ' ');
  const hasCreationVerb =
    /созда|сформир|сделай|сделать|выстав|сгенер|оформи|оформить|подготовь|generate|create|make|issue/iu.test(
      intentText,
    );
  if (!hasCreationVerb) return [];

  const tools: string[] = [];
  if (/плат[её]ж|оплат|платежн\w*\s+ссылк|payment|checkout/iu.test(intentText)) {
    tools.push('create_payment');
  }
  if (/сч[её]т|invoice/iu.test(intentText)) {
    tools.push('create_invoice');
  }
  return tools;
}

export function createOperationPlanTool(
  availableTools: readonly PlannerToolSchema[],
): ToolDefinition {
  const argumentSchemas = availableTools
    .map((tool) => tool.inputSchema)
    .filter((schema) => schema !== undefined);
  const argumentsSchema =
    argumentSchemas.length === 1
      ? argumentSchemas[0]
      : argumentSchemas.length > 1
        ? { oneOf: argumentSchemas }
        : { type: 'object', additionalProperties: false };

  return {
    name: OPERATION_PLAN_TOOL_NAME,
    description:
      'Extract the requested operation and its explicit arguments. This only prepares a plan; it never executes an MCP tool.',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          maxItems: MAX_PLANNED_OPERATIONS,
          items: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                enum: availableTools.map((tool) => tool.name),
              },
              args: argumentsSchema ?? {
                type: 'object',
                additionalProperties: false,
              },
            },
            required: ['tool', 'args'],
            additionalProperties: false,
          },
        },
        reply: { type: 'string' },
      },
      required: ['operations', 'reply'],
      additionalProperties: false,
    },
  };
}

export async function extractOperationPlan(
  provider: LLMProvider,
  model: string,
  messages: ChatMessage[],
  availableTools: readonly PlannerToolSchema[],
): Promise<OperationPlan> {
  if (availableTools.length === 0) {
    throw new HttpError(503, 'No financial operation is available to plan.');
  }

  const tool = createOperationPlanTool(availableTools);
  const availableToolNames = availableTools.map((item) => item.name);
  const { stream, response } = await provider.chat({
    model,
    messages,
    tools: [tool],
    ...(provider.supportsRequiredToolChoice === true
      ? { toolChoice: 'required' as const }
      : {}),
  });

  let finishReason: 'stop' | 'tool-calls' | 'length' | 'error' = 'stop';
  const calls = new Map<string, { name: string; args: string }>();
  const reader = stream.getReader();
  try {
    for (let item = await reader.read(); !item.done; item = await reader.read()) {
      const chunk = item.value;
      if (chunk.type === 'tool-call-start') {
        calls.set(chunk.toolCallId, { name: chunk.toolName, args: '' });
      } else if (chunk.type === 'tool-call-delta') {
        const call = calls.get(chunk.toolCallId);
        if (call !== undefined) call.args += chunk.args;
      } else if (chunk.type === 'finish') {
        finishReason = chunk.finishReason;
      } else if (chunk.type === 'error') {
        throw chunk.error;
      }
    }
    await response;
  } finally {
    reader.releaseLock();
  }

  if (finishReason !== 'tool-calls' || calls.size !== 1) {
    throw new HttpError(
      502,
      'Не удалось безопасно обработать запрос. Операция не выполнялась. Повторите запрос или обратитесь к администратору.',
    );
  }

  const [toolCallId, call] = [...calls.entries()][0] ?? [];
  if (toolCallId === undefined || call?.name !== OPERATION_PLAN_TOOL_NAME) {
    throw new HttpError(
      502,
      'Не удалось безопасно обработать запрос. Операция не выполнялась. Повторите запрос или обратитесь к администратору.',
    );
  }

  const parsed = parseArguments(call.args);
  if (parsed === null || !isRecord(parsed)) {
    throw new HttpError(
      502,
      'Не удалось безопасно обработать запрос. Операция не выполнялась. Повторите запрос или обратитесь к администратору.',
    );
  }

  return parseOperationPlan(parsed, availableToolNames);
}

export function disallowedOperationFields(
  args: Readonly<Record<string, unknown>>,
  allowedFields: ReadonlySet<string>,
): string[] {
  return Object.keys(args).filter((key) => !allowedFields.has(key));
}

function parseOperationPlan(
  value: Record<string, unknown>,
  availableTools: readonly string[],
): OperationPlan {
  if (
    !Array.isArray(value.operations) ||
    value.operations.length > MAX_PLANNED_OPERATIONS ||
    typeof value.reply !== 'string'
  ) {
    throw new HttpError(
      502,
      'Не удалось безопасно обработать запрос. Операция не выполнялась. Повторите запрос или обратитесь к администратору.',
    );
  }

  const operations = value.operations.map((entry, _index) => {
    if (
      !isRecord(entry) ||
      typeof entry.tool !== 'string' ||
      !availableTools.includes(entry.tool) ||
      !isRecord(entry.args)
    ) {
      throw new HttpError(
        502,
        'Не удалось безопасно обработать запрос. Операция не выполнялась. Повторите запрос или обратитесь к администратору.',
      );
    }
    return { tool: entry.tool, args: entry.args };
  });

  return { operations, reply: value.reply };
}
