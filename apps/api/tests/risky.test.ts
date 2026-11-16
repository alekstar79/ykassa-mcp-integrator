import { describe, expect, it } from 'vitest';
import { isRiskyOperation } from '../src/risky.js';
import type { AgentConfig } from '../src/agentTypes.js';

const config: AgentConfig = {
  mcpToken: 'test-only-token',
  mcpUrl: 'http://127.0.0.1:1',
  approvalThreshold: 1000,
  requireHumanConfirmation: false,
  allowedScenarios: ['create_payment'],
  defaults: {
    currency: 'RUB',
    vat_code: 1,
    capture: true,
    invoice_expiry_days: 30,
  },
  clientConfig: {
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: undefined,
    ui: {
      mode: 'reference-ui',
      accent: 'navy',
      radius: 2,
      shadow: 'soft',
      font_pair: 'manrope+jetbrains',
      form_style: 'flat',
      h1_size: 'm',
    },
    limits: { max_messages: 20, max_attachment_kb: 100 },
    defaults: {
      currency: 'RUB',
      vat_code: 1,
      capture: true,
      invoice_expiry_days: 30,
    },
  },
};

describe('isRiskyOperation', () => {
  it('requires approval above the configured threshold', () => {
    expect(
      isRiskyOperation(
        { name: 'create_payment', args: { amount: { value: '1000.01' } } },
        config,
      ),
    ).toBe(true);
  });

  it('does not require approval at or below the threshold', () => {
    expect(
      isRiskyOperation(
        { name: 'create_payment', args: { amount: { value: '1000' } } },
        config,
      ),
    ).toBe(false);
    expect(
      isRiskyOperation(
        { name: 'create_payment', args: { amount: { value: '500' } } },
        config,
      ),
    ).toBe(false);
  });

  it('requires approval whenever human confirmation is enabled', () => {
    expect(
      isRiskyOperation(
        { name: 'create_payment', args: { amount: { value: '1' } } },
        { ...config, requireHumanConfirmation: true },
      ),
    ).toBe(true);
  });

  it('does not classify read tools as risky', () => {
    expect(
      isRiskyOperation({ name: 'get_payment', args: { id: 'pay-1' } }, config),
    ).toBe(false);
  });

  it('requires approval for invoices above the threshold or with unknown totals', () => {
    expect(
      isRiskyOperation(
        {
          name: 'create_invoice',
          args: { amount: { value: '1000.01', currency: 'RUB' } },
        },
        config,
      ),
    ).toBe(true);
    expect(
      isRiskyOperation(
        {
          name: 'create_invoice',
          args: { amount: { value: '500', currency: 'RUB' } },
        },
        config,
      ),
    ).toBe(false);
    expect(
      isRiskyOperation(
        { name: 'create_invoice', args: { cart: [{ description: 'Course' }] } },
        config,
      ),
    ).toBe(true);
  });
});
