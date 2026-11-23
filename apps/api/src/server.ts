#!/usr/bin/env node
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PROJECT_ROOT } from './config.js';
import { createApp } from './lib.js';

const cwdEnvPath = process.env.DOTENV_CONFIG_PATH ?? path.join(process.cwd(), '.env');
const dotenvPath = existsSync(cwdEnvPath)
  ? cwdEnvPath
  : path.join(PROJECT_ROOT, '.env');
loadDotenv({ path: dotenvPath });

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const cwdClientsDir = process.env.CLIENTS_DIR ?? path.join(process.cwd(), 'clients');
const clientsDir = existsSync(cwdClientsDir) ? cwdClientsDir : undefined;

createApp({ clientsDir }).listen(port, () => {
  console.log(`YooKassa agent API listening on port ${port}.`);
});
