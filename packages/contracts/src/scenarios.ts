export const KNOWN_MCP_SCENARIOS = [
  'create_payment',
  'get_payment',
  'get_payments',
  'get_invoice',
  'get_refund',
  'get_refunds',
  'create_invoice',
] as const;

export type KnownMcpScenario = (typeof KNOWN_MCP_SCENARIOS)[number];
