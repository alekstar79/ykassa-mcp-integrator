#!/usr/bin/env node
/**
 * onboard-client.ts
 * Run from the project root:
 *   npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <client-name>
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const PROJECT_ROOT = process.cwd();
const SKILL_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(SKILL_ROOT, 'assets', 'example-client-config.yaml');
const CLIENTS_DIR = path.join(PROJECT_ROOT, 'clients');

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

function fail(msg: string): never { console.error('FAIL: ' + msg); process.exit(1); }

const name = process.argv[2];
if (!name) fail('Usage: npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <client-name>');
if (!NAME_PATTERN.test(name)) fail(`Client name '${name}' must match ${NAME_PATTERN.source}`);

const shopId = (process.env.YOOKASSA_SHOP_ID || '').trim();
const mcpToken = (process.env.YOOKASSA_MCP_TOKEN || '').trim();
if (!shopId) fail('Environment variable YOOKASSA_SHOP_ID is required');
if (!mcpToken) fail('Environment variable YOOKASSA_MCP_TOKEN is required');
if (!fs.existsSync(TEMPLATE_PATH)) fail('Template not found: ' + TEMPLATE_PATH);

const clientDir = path.join(CLIENTS_DIR, name);
if (fs.existsSync(clientDir)) fail('Client directory already exists: ' + clientDir);
fs.mkdirSync(clientDir, { recursive: true });

const rendered = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  .replace('<SHOP_ID>', shopId)
  .replace('<MCP_TOKEN>', mcpToken);
const configPath = path.join(clientDir, 'config.yaml');
fs.writeFileSync(configPath, rendered, 'utf8');
console.log('Created ' + configPath);

console.log('\nRunning config validation...');
try {
  execFileSync('npx', ['tsx', path.join(SKILL_ROOT, 'scripts', 'validate-config.ts'), configPath], { stdio: 'inherit' });
} catch {
  fail('Validation failed. Fix the config and re-run validate-config.ts.');
}

console.log(`\nClient '${name}' onboarded successfully.`);
console.log('Next steps:');
console.log('  1. Review ' + configPath);
console.log('  2. Run the demo: npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/run-demo.ts --client ' + name);
