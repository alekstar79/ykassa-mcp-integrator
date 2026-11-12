import type { AgentConfig } from './agentTypes.js';

export const RISKY_TOOLS = new Set(['create_payment']);

export function isRiskyOperation(
  toolCall: { name: string; args: unknown },
  config: AgentConfig,
): boolean {
  if (!RISKY_TOOLS.has(toolCall.name)) return false;
  if (config.requireHumanConfirmation) return true;

  const args = toolCall.args as { amount?: { value?: string } } | undefined;
  const amountValue = args?.amount?.value ?? '0';
  const numericAmount = Number.parseFloat(amountValue);
  return (
    Number.isFinite(numericAmount) &&
    numericAmount > config.approvalThreshold
  );
}
