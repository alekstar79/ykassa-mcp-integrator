import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { getMessengerRuntimeConfig, PROJECT_ROOT } from './config.js';
import {
  startMessengerClients,
  stopMessengerClients,
} from './runtime.js';

const configuredEnvPath = process.env.DOTENV_CONFIG_PATH;
const cwdEnvPath = configuredEnvPath ?? path.join(process.cwd(), '.env');
const dotenvPath = existsSync(cwdEnvPath)
  ? cwdEnvPath
  : configuredEnvPath ?? path.join(PROJECT_ROOT, '.env');
loadDotenv({ path: dotenvPath });

async function main(): Promise<void> {
  const runtime = getMessengerRuntimeConfig();
  const clients = await startMessengerClients(runtime);
  if (clients.length === 0) {
    console.info('No enabled messenger clients were found.');
  }
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; stopping messenger clients.`);
    void stopMessengerClients(clients).catch((error: unknown) => {
      console.error(
        `Messenger shutdown failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
      );
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

void main().catch((error: unknown) => {
  console.error(
    `Messenger gateway failed to start (${error instanceof Error ? error.message : 'unknown error'}).`,
  );
  process.exitCode = 1;
});
