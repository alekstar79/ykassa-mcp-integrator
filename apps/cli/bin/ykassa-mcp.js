#!/usr/bin/env node
import { exec, spawn } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';
import { tmpdir } from 'node:os';
import express from 'express';
import * as path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const clientNamePattern = /^[a-z][a-z0-9-]{1,30}$/;
const MAX_ROOT_CA_FINGERPRINT =
  'D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31';

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === undefined) {
    printHelp();
    return;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }
  if (command === '--version' || command === '-v') {
    const packageJson = JSON.parse(
      await readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
    );
    console.log(packageJson.version);
    return;
  }

  switch (command) {
    case 'init':
      await initClient(args);
      return;
    case 'start':
    case 'start:api':
      ensureNoArguments(command, args);
      process.env.CLIENTS_DIR = path.join(process.cwd(), 'clients');
      process.env.DOTENV_CONFIG_PATH = path.join(process.cwd(), '.env');
      await import('@alekstar79/ykassa-api/server');
      return;
    case 'web':
    case 'start:web':
      ensureNoArguments(command, args);
      await serveApp('web', 5173);
      return;
    case 'configurator':
    case 'start:configurator':
      ensureNoArguments(command, args);
      await serveApp('configurator', 5174);
      return;
    case 'messenger':
    case 'start:messenger':
      ensureNoArguments(command, args);
      await runMessenger();
      return;
    default:
      throw new Error(`Unknown command. Run 'ykassa-mcp --help' for usage.`);
  }
}

async function runMessenger() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error(
      'Refusing to start Messenger because TLS certificate verification is disabled.',
    );
  }

  const certificatePath = path.join(
    packageDirectory,
    'certs',
    'russian-trusted-root-ca.pem',
  );
  const certificate = new X509Certificate(await readFile(certificatePath));
  if (certificate.fingerprint256 !== MAX_ROOT_CA_FINGERPRINT) {
    throw new Error(
      'The bundled Russian Trusted Root CA certificate fingerprint is invalid.',
    );
  }
  console.info(
    'Using the bundled Russian Trusted Root CA for Messenger; TLS verification remains enabled.',
  );

  const existingCaPath = process.env.NODE_EXTRA_CA_CERTS?.trim();
  const existingCa = existingCaPath
    ? await readFile(existingCaPath, 'utf8')
    : '';
  let temporaryDirectory;
  let extraCaPath = certificatePath;
  if (existingCa) {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'ykassa-messenger-ca-'),
    );
    extraCaPath = path.join(temporaryDirectory, 'ca-bundle.pem');
    const bundledCa = await readFile(certificatePath, 'utf8');
    await writeFile(extraCaPath, `${bundledCa.trim()}\n${existingCa.trim()}\n`, {
      mode: 0o600,
    });
  }

  const workerPath = path.join(packageDirectory, 'bin', 'messenger-worker.js');
  const child = spawn(process.execPath, [workerPath], {
    env: {
      ...process.env,
      CLIENTS_DIR: path.join(process.cwd(), 'clients'),
      DOTENV_CONFIG_PATH: path.join(process.cwd(), '.env'),
      MESSENGER_AUDIT_LOG_DIR: process.cwd(),
      NODE_EXTRA_CA_CERTS: extraCaPath,
    },
    stdio: 'inherit',
  });
  const forwardSignal = (signal) => child.kill(signal);
  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        resolve(code ?? (signal === 'SIGINT' ? 130 : 143));
      });
    });
    process.exitCode = exitCode;
  } finally {
    process.removeListener('SIGINT', forwardSignal);
    process.removeListener('SIGTERM', forwardSignal);
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

function printHelp() {
  console.log(`YooKassa MCP integrator CLI

Usage:
  ykassa-mcp init <name>
  ykassa-mcp start | start:api
  ykassa-mcp messenger | start:messenger
  ykassa-mcp web | start:web
  ykassa-mcp configurator | start:configurator
  ykassa-mcp --help
  ykassa-mcp --version`);
}

function ensureNoArguments(command, args) {
  if (args.length > 0) {
    throw new Error(`The '${command}' command does not accept arguments.`);
  }
}

async function initClient(args) {
  const [clientName] = args;
  if (
    args.length !== 1 ||
    typeof clientName !== 'string' ||
    !clientNamePattern.test(clientName)
  ) {
    throw new Error('Usage: ykassa-mcp init <name> (name must match ^[a-z][a-z0-9-]{1,30}$).');
  }

  const templateDirectory = path.join(
    packageDirectory,
    'templates',
    'clients',
    'example',
  );
  try {
    await access(templateDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'The bundled example client template is missing. Build the package after clients/example has been created.',
      );
    }
    throw error;
  }

  if (!stdin.isTTY) {
    throw new Error('Client initialization requires an interactive terminal.');
  }

  const readline = createInterface({ input: stdin, output: stdout });
  let shopId;
  let mcpToken;
  try {
    shopId = (await readline.question('YooKassa shop ID: ')).trim();
    mcpToken = (await readline.question('YooKassa MCP token: ')).trim();
  } finally {
    readline.close();
  }

  if (
    !shopId ||
    !mcpToken ||
    /[\r\n]/.test(shopId) ||
    /[\r\n]/.test(mcpToken)
  ) {
    throw new Error('Shop ID and MCP token must both be non-empty single-line values.');
  }

  const clientDirectory = path.join(process.cwd(), 'clients', clientName);
  await mkdir(clientDirectory, { recursive: true });
  const templateEntries = await readdir(templateDirectory, {
    withFileTypes: true,
  });
  for (const entry of templateEntries) {
    await cp(
      path.join(templateDirectory, entry.name),
      path.join(clientDirectory, entry.name),
      { recursive: true, force: true },
    );
  }

  await writeFile(
    path.join(clientDirectory, '.env'),
    `YOOKASSA_SHOP_ID=${shopId}\nYOOKASSA_MCP_TOKEN=${mcpToken}\n`,
    { mode: 0o600 },
  );
  console.log(`Initialized client '${clientName}' in clients/${clientName}/.`);
}

async function serveApp(appName, port) {
  const buildDirectory = path.join(packageDirectory, 'dist', appName);
  try {
    await access(path.join(buildDirectory, 'index.html'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `Built ${appName} assets are missing. Run npm run build:packages first.`,
      );
    }
    throw error;
  }

  const app = express();
  app.use(express.static(buildDirectory));
  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(port, '127.0.0.1');
    listeningServer.once('listening', () => resolve(listeningServer));
    listeningServer.once('error', reject);
  });

  const url = `http://127.0.0.1:${port}/`;
  console.log(`${appName} available at ${url}`);
  try {
    await openBrowser(url);
  } catch (error) {
    server.close(() => {});
    throw new Error(
      `Could not open a browser for ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

main().catch((error) => {
  console.error(
    `ykassa-mcp: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
