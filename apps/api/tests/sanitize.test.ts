import { describe, expect, it } from 'vitest';
import { parseArguments, sanitizeReply } from '../src/sanitize.js';

describe('parseArguments', () => {
  it('parses JSON objects', () => {
    expect(parseArguments('{"amount":{"value":"100"}}')).toEqual({
      amount: { value: '100' },
    });
  });

  it('returns null for malformed JSON and non-object JSON', () => {
    expect(parseArguments('{"amount":')).toBeNull();
    expect(parseArguments('["not", "an", "object"]')).toBeNull();
  });
});

describe('sanitizeReply', () => {
  it('removes unexpected CJK text while preserving the Russian reply', () => {
    expect(sanitizeReply('Платёж готов。不')).toBe('Платёж готов。');
  });

  it('keeps text without CJK characters unchanged', () => {
    expect(sanitizeReply('Платёж готов.')).toBe('Платёж готов.');
  });
});
