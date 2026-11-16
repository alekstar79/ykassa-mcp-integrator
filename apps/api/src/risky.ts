import type { AgentConfig } from './agentTypes.js';
import { isRecord } from './http.js';

export const RISKY_TOOLS = new Set(['create_payment', 'create_invoice']);

export function isRiskyOperation(
  toolCall: { name: string; args: unknown },
  config: AgentConfig,
): boolean {
  if (!RISKY_TOOLS.has(toolCall.name)) return false;
  if (config.requireHumanConfirmation) return true;

  const numericAmount = getOperationAmount(toolCall.name, toolCall.args);
  if (numericAmount === undefined) return toolCall.name === 'create_invoice';
  return numericAmount > config.approvalThreshold;
}

function getOperationAmount(
  toolName: string,
  args: unknown,
): number | undefined {
  if (!isRecord(args)) return undefined;
  const amount = parseAmount(args.amount);
  if (amount !== undefined || toolName !== 'create_invoice') return amount;
  if (!Array.isArray(args.cart)) return undefined;

  let total = 0;
  for (const item of args.cart) {
    if (!isRecord(item)) return undefined;
    const itemAmount = parseAmount(item.amount);
    if (itemAmount === undefined) return undefined;
    total += itemAmount;
  }
  return total;
}

function parseAmount(value: unknown): number | undefined {
  const amountValue = isRecord(value) ? value.value : value;
  if (typeof amountValue === 'number') {
    return Number.isFinite(amountValue) ? amountValue : undefined;
  }
  if (typeof amountValue !== 'string' || amountValue.trim() === '') {
    return undefined;
  }
  const numericAmount = Number.parseFloat(amountValue);
  return Number.isFinite(numericAmount) ? numericAmount : undefined;
}
