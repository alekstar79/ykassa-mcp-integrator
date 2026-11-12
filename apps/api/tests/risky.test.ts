import { describe, expect, it } from 'vitest';
import { isRiskyOperation } from '../src/risky.js';
import type { AgentConfig } from '../src/agentTypes.js';

const config: AgentConfig = {
  mcpToken: 'test-only-token',
  mcpUrl: 'http://127.0.0.1:1',
  approvalThreshold: 1000,
  requireHumanConfirmation: false,
  allowedScenarios: ['create_payment'],
  systemPrompt: '',
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
});
