#!/usr/bin/env node
/**
 * validate-config.ts
 * Run from the project root:
 *   npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/validate-config.ts clients/<name>/config.yaml
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const PROJECT_ROOT = process.cwd();

const CONFIRMED_OFFICIAL = new Set([
  'create_payment',
  'get_payment',
  'get_payments',
  'create_invoice',
  'get_invoice',
  'get_refund',
  'get_refunds',
]);
const CONFIRMED_NPM_ONLY = new Set([
  'capture_payment', 'cancel_payment', 'save_payment_method',
  'create_recurring_payment', 'create_sbp_payment', 'create_split_payment',
  'create_refund', 'create_receipt', 'list_receipts',
  'create_payout', 'get_payout',
  'create_webhook', 'list_webhooks', 'delete_webhook', 'get_shop_balance',
]);
const REQUIRED_KEYS: Record<string, string> = {
  shop_id: 'string', mcp_token: 'string', allowed_scenarios: 'array',
  approval_threshold: 'number', require_human_confirmation: 'boolean',
};
const PLACEHOLDER_PATTERNS = [
  /^<.*>$/, /^your[-_].*/i, /^placeholder/i, /^xxx+$/i,
];

function fail(msg: string): never {
  console.error('FAIL: ' + msg);
  process.exit(1);
}
function ok(msg: string) { console.log('OK:   ' + msg); }

function validate(configPath: string): void {
  const absolute = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(PROJECT_ROOT, configPath);
  if (!fs.existsSync(absolute)) fail('Config not found: ' + absolute);
  const cfg = yaml.load(fs.readFileSync(absolute, 'utf8')) as any;
  if (!cfg || typeof cfg !== 'object') fail('Config root must be a mapping');

  for (const [key, type] of Object.entries(REQUIRED_KEYS)) {
    if (!(key in cfg)) fail('Missing required key: ' + key);
    const actual = Array.isArray(cfg[key]) ? 'array' : typeof cfg[key];
    if (actual !== type) fail(`Key '${key}' must be ${type}, got ${actual}`);
    ok(`Key '${key}' present and typed correctly`);
  }

  for (const scenario of cfg.allowed_scenarios) {
    if (CONFIRMED_OFFICIAL.has(scenario) || CONFIRMED_NPM_ONLY.has(scenario)) continue;
    fail(`Scenario '${scenario}' is not a known MCP tool`);
  }
  ok(`All ${cfg.allowed_scenarios.length} scenarios are known MCP tools`);

  if (cfg.approval_threshold < 0) fail('approval_threshold must be >= 0');
  ok('approval_threshold = ' + cfg.approval_threshold);

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(cfg.mcp_token)) fail('mcp_token looks like a placeholder');
  }
  ok('mcp_token does not match placeholder patterns');

  const npmOnly = cfg.allowed_scenarios.filter((s: string) => CONFIRMED_NPM_ONLY.has(s) && !CONFIRMED_OFFICIAL.has(s));
  if (npmOnly.length > 0) {
    console.warn('WARN: these tools are only in the npm package, not the official MCP: ' + npmOnly.join(', '));
    console.warn('      Confirm that tools/list returns them, or record ASM-NNN.');
  }
}

const target = process.argv[2];
if (!target) fail('Usage: npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/validate-config.ts <path-to-config.yaml>');
validate(target);
console.log('All checks passed.');
