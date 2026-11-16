import { describe, expect, it } from 'vitest';
import {
  requireValidToolCall,
  validateToolCall,
  type ToolSchemaEntry,
} from '../src/validateToolCall.js';

const tools: ToolSchemaEntry[] = [
  {
    name: 'sample_tool',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        label: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { quantity: { type: 'number' } },
            required: ['quantity'],
          },
        },
      },
      required: ['amount'],
      additionalProperties: false,
    },
  },
];

describe('validateToolCall', () => {
  it('accepts arguments that match the tool schema', () => {
    const result = validateToolCall(
      'sample_tool',
      { amount: 5000 },
      tools,
    );

    expect(result).toEqual({
      valid: true,
      errors: [],
      fixedArgs: { amount: 5000 },
    });
  });

  it('accepts MCP schemas declaring JSON Schema draft 2020-12', () => {
    const result = validateToolCall('draft_2020_tool', { amount: 5000 }, [
      {
        name: 'draft_2020_tool',
        inputSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: { amount: { type: 'number' } },
          required: ['amount'],
        },
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.fixedArgs).toEqual({ amount: 5000 });
  });

  it('reports a missing required field', () => {
    const result = validateToolCall('sample_tool', {}, tools);

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('amount');
  });

  it('coerces numeric strings to numbers without mutating input', () => {
    const args = { amount: '5000' };
    const result = validateToolCall('sample_tool', args, tools);

    expect(result.valid).toBe(true);
    expect(result.fixedArgs).toEqual({ amount: 5000 });
    expect(args.amount).toBe('5000');
  });

  it('coerces numbers to strings, including in object properties', () => {
    const result = validateToolCall(
      'sample_tool',
      { amount: 5000, label: 17 },
      tools,
    );

    expect(result.valid).toBe(true);
    expect(result.fixedArgs).toEqual({ amount: 5000, label: '17' });
  });

  it('rejects incompatible object values where an array is required', () => {
    const result = validateToolCall(
      'sample_tool',
      { amount: 5000, items: { quantity: 1 } },
      tools,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('items');
  });

  it('throws an HTTP 400 validation error for invalid tool arguments', () => {
    expect(() =>
      requireValidToolCall('sample_tool', {}, tools),
    ).toThrow('Ошибка в аргументах инструмента:');
  });
});
