import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
} from 'ajv/dist/2020.js';
import * as formatsPlugin from 'ajv-formats';
import { HttpError, isRecord } from './http.js';

export interface ToolSchemaEntry {
  name: string;
  inputSchema?: unknown;
}

export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
  fixedArgs?: unknown;
}

const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: true,
  strict: false,
});
const addFormats: unknown = formatsPlugin.default;
if (!isAjvFormatsPlugin(addFormats)) {
  throw new Error('ajv-formats did not export a compatible plugin.');
}
addFormats(ajv);

export function validateToolCall(
  toolName: string,
  args: unknown,
  tools: readonly ToolSchemaEntry[],
): ToolValidationResult {
  const tool = tools.find((entry) => entry.name === toolName);
  if (tool === undefined) {
    return {
      valid: false,
      errors: [`${toolName}: tool was not returned by tools/list`],
    };
  }
  if (!isJsonSchema(tool.inputSchema)) {
    return {
      valid: false,
      errors: [`${toolName}: inputSchema is missing or invalid`],
    };
  }

  const validate = ajv.compile(tool.inputSchema);
  const fixedArgs: unknown = structuredClone(args);
  const preparedArgs = coerceNumbersToStrings(fixedArgs, tool.inputSchema);
  const valid = validate(preparedArgs);
  if (valid) return { valid: true, errors: [], fixedArgs: preparedArgs };

  return {
    valid: false,
    errors: formatErrors(validate.errors),
  };
}

export function requireValidToolCall(
  toolName: string,
  args: unknown,
  tools: readonly ToolSchemaEntry[],
): Record<string, unknown> {
  const result = validateToolCall(toolName, args, tools);
  if (!result.valid) throw new ToolValidationError(result.errors);
  if (!isRecord(result.fixedArgs)) {
    throw new ToolValidationError([
      `${toolName}: tool arguments must be an object`,
    ]);
  }
  return result.fixedArgs;
}

export class ToolValidationError extends HttpError {
  constructor(errors: string[]) {
    super(400, `Ошибка в аргументах инструмента: ${errors.join('; ')}`);
    this.name = 'ToolValidationError';
  }
}

function isJsonSchema(value: unknown): value is AnySchema {
  return typeof value === 'boolean' || isRecord(value);
}

function isAjvFormatsPlugin(
  value: unknown,
): value is (instance: Ajv2020) => Ajv2020 {
  return typeof value === 'function';
}

function coerceNumbersToStrings(value: unknown, schema: unknown): unknown {
  if (!isRecord(schema)) return value;
  if (schema.type === 'string' && typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value) && isRecord(schema.properties)) {
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) {
        value[key] = coerceNumbersToStrings(value[key], propertySchema);
      }
    }
  }

  if (Array.isArray(value)) {
    const itemSchemas = schema.prefixItems;
    if (Array.isArray(itemSchemas)) {
      for (const [index, item] of value.entries()) {
        const itemSchema: unknown = itemSchemas[index] ?? schema.items;
        value[index] = coerceNumbersToStrings(item, itemSchema);
      }
    } else {
      for (const [index, item] of value.entries()) {
        value[index] = coerceNumbersToStrings(item, schema.items);
      }
    }
  }

  return value;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    let path = pointerToPath(error.instancePath);
    if (
      error.keyword === 'required' &&
      isRecord(error.params) &&
      typeof error.params.missingProperty === 'string'
    ) {
      path = [path, error.params.missingProperty].filter(Boolean).join('.');
    }
    return path === ''
      ? (error.message ?? error.keyword)
      : `${path}: ${error.message ?? error.keyword}`;
  });
}

function pointerToPath(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');
}
