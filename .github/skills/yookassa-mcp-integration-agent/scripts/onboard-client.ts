#!/usr/bin/env node
/**
 * onboard-client.ts
 * Run from the project root:
 *   npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <client-name>
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..');
const PROJECT_ROOT = path.resolve(SKILL_ROOT, '../../..');
const TEMPLATE_PATH = path.join(
  SKILL_ROOT,
  'assets',
  'example-client-config.yaml',
);
const CLIENTS_DIR = path.join(PROJECT_ROOT, 'clients');
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;
const GITIGNORE_RULE = 'clients/*/.env';

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ensureClientEnvIgnored(): void {
  const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
  const contents = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, 'utf8')
    : '';
  if (
    contents
      .split(/\r?\n/)
      .some((line) => line.trim() === GITIGNORE_RULE)
  ) {
    return;
  }

  const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
  const addition = `${separator}${GITIGNORE_RULE}\n`;
  if (existsSync(gitignorePath)) {
    appendFileSync(gitignorePath, addition, 'utf8');
  } else {
    writeFileSync(gitignorePath, addition, 'utf8');
  }
  console.log(`Added '${GITIGNORE_RULE}' to .gitignore`);
}

const name = process.argv[2];
if (!name) {
  fail(
    'Usage: npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <client-name>',
  );
}
if (!NAME_PATTERN.test(name)) {
  fail(`Client name '${name}' must match ${NAME_PATTERN.source}`);
}

const shopId = (process.env.YOOKASSA_SHOP_ID ?? '').trim();
const mcpToken = (process.env.YOOKASSA_MCP_TOKEN ?? '').trim();
if (!shopId) fail('Environment variable YOOKASSA_SHOP_ID is required');
if (!mcpToken) fail('Environment variable YOOKASSA_MCP_TOKEN is required');
if (!existsSync(TEMPLATE_PATH)) fail(`Template not found: ${TEMPLATE_PATH}`);

const clientDir = path.join(CLIENTS_DIR, name);
if (existsSync(clientDir)) fail(`Client directory already exists: ${clientDir}`);

ensureClientEnvIgnored();
mkdirSync(clientDir, { recursive: true });

const configPath = path.join(clientDir, 'config.yaml');
const secretsPath = path.join(clientDir, '.env');
const validateScriptPath = path.join(
  SKILL_ROOT,
  'scripts',
  'validate-config.ts',
);
writeFileSync(configPath, readFileSync(TEMPLATE_PATH, 'utf8'), 'utf8');
writeFileSync(
  secretsPath,
  [
    `YOOKASSA_SHOP_ID=${JSON.stringify(shopId)}`,
    `YOOKASSA_MCP_TOKEN=${JSON.stringify(mcpToken)}`,
    '',
  ].join('\n'),
  { encoding: 'utf8', mode: 0o600 },
);
const secretsMode = statSync(secretsPath).mode & 0o777;
if (process.platform !== 'win32' && (secretsMode & 0o077) !== 0) {
  console.warn(
    `WARN: ${secretsPath} has permissions ${secretsMode.toString(8)}. Restrict access using filesystem permissions or ACLs.`,
  );
}
console.log(`Created ${configPath}`);
console.log(`Created ${secretsPath}`);

console.log('\nRunning config validation...');
try {
  execFileSync('npx', ['tsx', validateScriptPath, name], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
} catch (error) {
  const detail = error instanceof Error ? ` (${error.message})` : '';
  fail(`Validation failed for client '${name}'${detail}`);
}

console.log(`\nClient '${name}' onboarded successfully.`);
console.log('Next steps:');
console.log(`  1. Review ${configPath}`);
console.log('  2. Start the API: npm run start:api');
console.log('  3. Start the reference UI in another terminal: npm run dev');
console.log(
  '  4. For Telegram or MAX, enable it and set its token, then run: npm run start --workspace=@alekstar79/ykassa-messenger',
);
