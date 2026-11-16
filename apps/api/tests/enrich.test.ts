import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichToolCall } from '../src/enrich.js';
import type { ClientConfig } from '../src/config.js';

const config: Pick<ClientConfig, 'defaults'> = {
  defaults: {
    currency: 'RUB',
    vat_code: 1,
    capture: true,
    invoice_expiry_days: 30,
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('enrichToolCall', () => {
  it('formats payment amount and applies currency and capture defaults', () => {
    const result = enrichToolCall(
      'create_payment',
      { amount: { value: 5000 } },
      config,
    );

    expect(result.args).toEqual({
      amount: { value: '5000.00', currency: 'RUB' },
      capture: true,
    });
    expect(result.appliedDefaults).toEqual(['amount.currency', 'capture']);
  });

  it('normalizes numeric strings and preserves explicitly supplied values', () => {
    const result = enrichToolCall(
      'create_payment',
      {
        amount: { value: '5000', currency: 'EUR' },
        capture: false,
      },
      config,
    );

    expect(result.args).toEqual({
      amount: { value: '5000.00', currency: 'EUR' },
      capture: false,
    });
    expect(result.appliedDefaults).toEqual([]);
  });

  it('uses client overrides instead of configured defaults', () => {
    const overrides = {
      ...config,
      overrides: { currency: 'USD' as const, vat_code: 11 as const },
    };
    const payment = enrichToolCall(
      'create_payment',
      { amount: { value: 100, currency: 'RUB' } },
      overrides,
    );
    const invoice = enrichToolCall(
      'create_invoice',
      {
        cart: [{
          description: 'Course',
          amount: { value: '100.00' },
          vat_code: 1,
          currency: 'RUB',
        }],
        expires_at: 'later',
      },
      overrides,
    );

    expect(payment.args.amount).toEqual({ value: '100.00', currency: 'USD' });
    expect(invoice.args.cart).toEqual([
      {
        description: 'Course',
        amount: { value: '100.00' },
        quantity: 1,
        vat_code: 11,
        currency: 'USD',
      },
    ]);
  });

  it('parses invoice cart JSON and fills missing item defaults', () => {
    const result = enrichToolCall(
      'create_invoice',
      { cart: '[{"description":"Course","amount":5000}]', expires_at: 'later' },
      config,
    );

    expect(result.args.cart).toEqual([
      {
        description: 'Course',
        amount: 5000,
        quantity: 1,
        vat_code: 1,
        currency: 'RUB',
      },
    ]);
    expect(result.args.expires_at).toBe('later');
  });

  it('rejects an invalid invoice cart string', () => {
    expect(() =>
      enrichToolCall('create_invoice', { cart: '[invalid' }, config),
    ).toThrow('invalid cart format');
  });

  it('builds a cart from flat invoice fields and sets expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    const result = enrichToolCall(
      'create_invoice',
      { description: 'Course', total_amount: '5000' },
      config,
    );

    expect(result.args).toEqual({
      description: 'Course',
      amount: '5000',
      cart: [
        {
          description: 'Course',
          amount: '5000',
          quantity: 1,
          vat_code: 1,
          currency: 'RUB',
        },
      ],
      expires_at: '2025-01-31T00:00:00.000Z',
    });
    expect(result.appliedDefaults).toContain('expires_at');
  });

  it('converts today, week, and month periods to UTC ISO dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:34:56.000Z'));

    const cases = [
      ['today', '2025-03-15T00:00:00.000Z'],
      ['week', '2025-03-08T12:34:56.000Z'],
      ['month', '2025-02-13T12:34:56.000Z'],
    ] as const;

    for (const [period, expectedDate] of cases) {
      const result = enrichToolCall('get_payments', { period }, config);
      expect(result.args).toEqual({
        created_at_gte: expectedDate,
        created_at_lte: '2025-03-15T12:34:56.000Z',
      });
      expect(result.args).not.toHaveProperty('period');
      expect(result.appliedDefaults).toEqual([
        'created_at_gte',
        'created_at_lte',
      ]);
    }

    const refunds = enrichToolCall('get_refunds', { period: 'week' }, config);
    expect(refunds.args).toEqual({
      created_at_gte: '2025-03-08T12:34:56.000Z',
      created_at_lte: '2025-03-15T12:34:56.000Z',
    });
  });

  it('leaves unrecognized periods unchanged', () => {
    const result = enrichToolCall(
      'get_refunds',
      { period: 'quarter' },
      config,
    );

    expect(result.args).toEqual({ period: 'quarter' });
    expect(result.appliedDefaults).toEqual([]);
  });

  it('keeps explicit date bounds and removes a recognized period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:34:56.000Z'));

    const result = enrichToolCall(
      'get_payments',
      {
        period: 'week',
        created_at_gte: '2025-03-01T00:00:00.000Z',
      },
      config,
    );

    expect(result.args).toEqual({
      created_at_gte: '2025-03-01T00:00:00.000Z',
      created_at_lte: '2025-03-15T12:34:56.000Z',
    });
  });
});
