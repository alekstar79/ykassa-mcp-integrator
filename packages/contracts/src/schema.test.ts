import { describe, expect, it } from 'vitest';
import { ClientConfigSchema } from './schema.js';

describe('ClientConfigSchema', () => {
  it('applies UI and limits defaults when parsing a minimal client config', () => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_payment'],
      approval_threshold: 1000,
      require_human_confirmation: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ui.accent).toBe('navy');
    expect(result.data.limits.max_messages).toBeGreaterThan(0);
  });

  it('rejects a negative approval threshold', () => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_payment'],
      approval_threshold: -1,
      require_human_confirmation: true,
    });

    expect(result.success).toBe(false);
  });
});
