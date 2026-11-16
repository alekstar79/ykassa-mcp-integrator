import { describe, expect, it } from 'vitest';
import { CLIENT_VAT_CODES } from '../src/enums.js';
import { ClientConfigSchema } from '../src/schema.js';

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
    expect(result.data.defaults).toEqual({
      currency: 'RUB',
      vat_code: 1,
      capture: true,
      invoice_expiry_days: 30,
    });
  });

  it('fills defaults for omitted values in a partial defaults block', () => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_invoice'],
      approval_threshold: 1000,
      require_human_confirmation: true,
      defaults: { vat_code: 3 },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.defaults).toEqual({
      currency: 'RUB',
      vat_code: 3,
      capture: true,
      invoice_expiry_days: 30,
    });
  });

  it.each(CLIENT_VAT_CODES)('accepts supported VAT code %s', (vat_code) => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_invoice'],
      approval_threshold: 1000,
      require_human_confirmation: true,
      defaults: { vat_code },
    });

    expect(result.success).toBe(true);
  });

  it.each([0, 10.5, 13])('rejects unsupported VAT code %s', (vat_code) => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_invoice'],
      approval_threshold: 1000,
      require_human_confirmation: true,
      defaults: { vat_code },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a negative approval threshold', () => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_payment'],
      approval_threshold: -1,
      require_human_confirmation: true,
    });

    expect(result.success).toBe(false);
  });

  it('accepts radius 24 and rejects unsupported radius 10', () => {
    const config = {
      allowed_scenarios: ['create_payment'],
      approval_threshold: 1000,
      require_human_confirmation: true,
    };

    expect(
      ClientConfigSchema.safeParse({ ...config, ui: { radius: 24 } }).success,
    ).toBe(true);
    expect(
      ClientConfigSchema.safeParse({ ...config, ui: { radius: 10 } }).success,
    ).toBe(false);
  });

  it('keeps only the supported display name in the client brand', () => {
    const result = ClientConfigSchema.safeParse({
      allowed_scenarios: ['create_payment'],
      approval_threshold: 1000,
      require_human_confirmation: true,
      brand: {
        display_name: 'Online School',
        greeting: 'Create a payment link',
        tone: 'professional',
        primary_color: '#1a365d',
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.brand).toEqual({ display_name: 'Online School' });
  });
});
