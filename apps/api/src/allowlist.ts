export function isToolAvailable(
  toolName: string,
  allowedScenarios: ReadonlySet<string>,
  vatCode: number | undefined,
): boolean {
  return (
    allowedScenarios.has(toolName) &&
    (toolName !== 'create_invoice' || vatCode !== undefined)
  );
}

export const ALLOWED_FIELDS: Record<string, Set<string>> = {
  create_payment: new Set(['amount', 'capture', 'description']),
  create_invoice: new Set([
    'amount',
    'cart',
    'description',
    'expires_at',
    'gateway_id',
    'total_amount',
  ]),
  get_payment: new Set(['id']),
  get_payments: new Set([
    'created_at_gte',
    'created_at_lte',
    'limit',
    'next_cursor',
    'payment_method',
    'period',
    'status',
  ]),
  get_invoice: new Set(['id']),
  get_refunds: new Set([
    'created_at_gte',
    'created_at_lte',
    'limit',
    'next_cursor',
    'payment_id',
    'period',
    'status',
  ]),
  get_refund: new Set(['id']),
};

export function enforceFieldAllowlist(
  toolName: string,
  args: unknown,
): Record<string, unknown> {
  const asRecord = (args as Record<string, unknown>) ?? {};
  const allowed = ALLOWED_FIELDS[toolName];
  if (allowed === undefined) {
    console.error(
      '[agent] no field policy for tool',
      toolName,
      'arguments dropped',
    );
    return {};
  }

  const filtered: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [key, value] of Object.entries(asRecord)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    } else {
      removed.push(key);
    }
  }
  if (removed.length > 0) {
    console.error(
      '[agent] rejected fields not in allowlist for',
      toolName,
      ':',
      removed,
    );
  }
  return filtered;
}
