import { describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_FIELDS,
  enforceFieldAllowlist,
  isToolAvailable,
} from '../src/allowlist.js';

describe('enforceFieldAllowlist', () => {
  it('keeps only fields allowed for the selected tool', () => {
    expect(
      enforceFieldAllowlist('create_payment', {
        amount: { value: '100', currency: 'RUB' },
        capture: false,
        description: 'Курс английского',
        metadata: { origin: 'user' },
      }),
    ).toEqual({
      amount: { value: '100', currency: 'RUB' },
      capture: false,
      description: 'Курс английского',
    });
  });

  it('keeps read-tool filters while dropping unrelated fields', () => {
    expect(
      enforceFieldAllowlist('get_payments', {
        status: 'pending',
        limit: 10,
        period: 'week',
        shop_id: 'not-allowed',
      }),
    ).toEqual({ status: 'pending', limit: 10, period: 'week' });
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

  it('only exposes create_invoice when allowed and a VAT code is configured', () => {
    const allowedScenarios = new Set(['create_invoice']);

    expect(
      isToolAvailable('create_invoice', allowedScenarios, 1),
    ).toBe(true);
    expect(
      isToolAvailable('create_invoice', allowedScenarios, undefined),
    ).toBe(false);
    expect(isToolAvailable('create_invoice', new Set(), 1)).toBe(false);
  });

  it('keeps the supported invoice input fields', () => {
    expect(
      enforceFieldAllowlist('create_invoice', {
        amount: { value: '5000', currency: 'RUB' },
        cart: [],
        description: 'Course',
        expires_at: '2025-01-31T00:00:00.000Z',
        gateway_id: 'gateway',
        total_amount: '5000',
      }),
    ).toEqual({
      amount: { value: '5000', currency: 'RUB' },
      cart: [],
      description: 'Course',
      expires_at: '2025-01-31T00:00:00.000Z',
      gateway_id: 'gateway',
      total_amount: '5000',
    });
  });
});
