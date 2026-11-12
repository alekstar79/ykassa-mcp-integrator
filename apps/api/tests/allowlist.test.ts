import { describe, expect, it, vi } from 'vitest';
import { ALLOWED_FIELDS, enforceFieldAllowlist } from '../src/allowlist.js';

describe('enforceFieldAllowlist', () => {
  it('keeps only fields allowed for the selected tool', () => {
    expect(
      enforceFieldAllowlist('create_payment', {
        amount: { value: '100', currency: 'RUB' },
        description: 'Курс английского',
        metadata: { origin: 'user' },
      }),
    ).toEqual({
      amount: { value: '100', currency: 'RUB' },
      description: 'Курс английского',
    });
  });

  it('keeps read-tool filters while dropping unrelated fields', () => {
    expect(
      enforceFieldAllowlist('get_payments', {
        status: 'pending',
        limit: 10,
        shop_id: 'not-allowed',
      }),
    ).toEqual({ status: 'pending', limit: 10 });
    expect(ALLOWED_FIELDS.get_payments.has('status')).toBe(true);
  });

  it('drops all arguments for a tool without a field policy', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(enforceFieldAllowlist('unknown_tool', { id: '123' })).toEqual({});
    expect(log).toHaveBeenCalledOnce();
  });

  it('accepts a clean allowlisted object and defaults null arguments to empty', () => {
    expect(enforceFieldAllowlist('get_payment', { id: 'pay-test' })).toEqual({
      id: 'pay-test',
    });
    expect(enforceFieldAllowlist('get_payment', null)).toEqual({});
  });
});
