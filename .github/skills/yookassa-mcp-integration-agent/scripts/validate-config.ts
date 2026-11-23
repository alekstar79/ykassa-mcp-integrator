#!/usr/bin/env node
/**
 * validate-config.ts
 * Run from the project root:
 *   npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/validate-config.ts <client-name>
 */
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';
import { load as loadYaml } from 'js-yaml';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const CLIENTS_DIR = path.join(PROJECT_ROOT, 'clients');
const CLIENT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

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
  'capture_payment',
  'cancel_payment',
  'save_payment_method',
  'create_recurring_payment',
  'create_sbp_payment',
  'create_split_payment',
  'create_refund',
  'create_receipt',
  'list_receipts',
  'create_payout',
  'get_payout',
  'create_webhook',
  'list_webhooks',
  'delete_webhook',
  'get_shop_balance',
]);
const PLACEHOLDER_PATTERNS = [
  /^<.*>$/,
  /^your[-_].*/i,
  /^placeholder/i,
  /^xxx+$/i,
];

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`OK:   ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validate(clientName: string): void {
  if (!CLIENT_NAME_PATTERN.test(clientName)) {
    fail(`Client name '${clientName}' must match ${CLIENT_NAME_PATTERN.source}`);
  }

  const clientDir = path.join(CLIENTS_DIR, clientName);
  const configPath = path.join(clientDir, 'config.yaml');
  const secretsPath = path.join(clientDir, '.env');
  if (!existsSync(configPath)) {
    fail(`Config not found for client '${clientName}': ${configPath}`);
  }

  let config: unknown;
  try {
    config = loadYaml(readFileSync(configPath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    fail(`Could not parse config for client '${clientName}'${detail}`);
  }
  if (!isRecord(config)) fail('Config root must be a YAML mapping');

  const scenarios = config.allowed_scenarios;
  if (
    !Array.isArray(scenarios) ||
    !scenarios.every((scenario): scenario is string => typeof scenario === 'string')
  ) {
    fail("Key 'allowed_scenarios' must be an array of strings");
  }
  if (scenarios.length === 0) {
    fail("Key 'allowed_scenarios' must contain at least one MCP tool");
  }
  ok("Key 'allowed_scenarios' is a non-empty array of strings");

  for (const scenario of scenarios) {
    if (CONFIRMED_OFFICIAL.has(scenario) || CONFIRMED_NPM_ONLY.has(scenario)) {
      continue;
    }
    fail(`Scenario '${scenario}' is not a known MCP tool`);
  }
  ok(`All ${scenarios.length} scenarios are known MCP tools`);

  const threshold = config.approval_threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    fail("Key 'approval_threshold' must be a non-negative number");
  }
  ok(`Key 'approval_threshold' is valid (${threshold})`);

  if (typeof config.require_human_confirmation !== 'boolean') {
    fail("Key 'require_human_confirmation' must be a boolean");
  }
  ok("Key 'require_human_confirmation' is a boolean");

  const npmOnly = scenarios.filter(
    (scenario) =>
      CONFIRMED_NPM_ONLY.has(scenario) && !CONFIRMED_OFFICIAL.has(scenario),
  );
  if (npmOnly.length > 0) {
    console.warn(
      'WARN: these tools are only in the npm package, not the official MCP: ' +
        npmOnly.join(', '),
    );
    console.warn('      Confirm that tools/list returns them, or record ASM-NNN.');
  }

  if (!existsSync(secretsPath)) {
    fail(`Secrets file not found for client '${clientName}': ${secretsPath}`);
  }
  const secrets = parseDotenv(readFileSync(secretsPath, 'utf8'));
  const shopId = (secrets.YOOKASSA_SHOP_ID ?? '').trim();
  const mcpToken = (secrets.YOOKASSA_MCP_TOKEN ?? '').trim();
  if (!shopId) fail('YOOKASSA_SHOP_ID is missing or empty in the client .env');
  ok('YOOKASSA_SHOP_ID is present');

  if (!mcpToken) fail('YOOKASSA_MCP_TOKEN is missing or empty in the client .env');
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(mcpToken))) {
    fail('YOOKASSA_MCP_TOKEN looks like a placeholder');
  }
  ok('YOOKASSA_MCP_TOKEN is present and does not match placeholder patterns');
}

const clientName = process.argv[2];
if (!clientName) {
  fail(
    'Usage: npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/validate-config.ts <client-name>',
  );
}
validate(clientName);
console.log('All checks passed.');
