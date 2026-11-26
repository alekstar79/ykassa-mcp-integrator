import { readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { Router, type Request, type Response } from 'express';
import type { PublicClientConfig } from '@alekstar79/ykassa-contracts';
import { isRecord } from '../http.js';
import {
  CLIENTS_DIR,
  isValidClientName,
  loadClientConfig,
  validateClientName,
} from '../config.js';

interface ClientPublicRouterOptions {
  clientsDir?: string;
}

export function createClientPublicRouter(
  options: ClientPublicRouterOptions = {},
) {
  const router = Router();
  const clientsDir = options.clientsDir ?? CLIENTS_DIR;

  router.get('/', async (_req: Request, res: Response) => {
    let entries;
    try {
      entries = await readdir(clientsDir, { withFileTypes: true });
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') {
        res.json({ clients: [] });
        return;
      }
      throw error;
    }

    const clients = [];
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === 'example' ||
        !isValidClientName(entry.name)
      ) {
        continue;
      }
      const clientDirectory = path.join(clientsDir, entry.name);
      if (
        !(await isFile(path.join(clientDirectory, 'config.yaml'))) ||
        !(await isFile(path.join(clientDirectory, '.env')))
      ) {
        continue;
      }

      const config = await loadClientConfig(entry.name, clientsDir);
      clients.push({
        name: entry.name,
        display_name: config.brand?.display_name?.trim() || entry.name,
      });
    }

    clients.sort((left, right) =>
      left.display_name.localeCompare(right.display_name),
    );
    res.json({ clients });
  });

  router.get('/:name/public', async (req: Request, res: Response) => {
    const clientName = validateClientName(req.params.name);
    const config = await loadClientConfig(clientName, clientsDir);
    const rawBrand = config.brand;
    const brand: NonNullable<typeof config.brand> = {};

    if (typeof rawBrand?.display_name === 'string') {
      brand.display_name = rawBrand.display_name;
    }

    const publicConfig: PublicClientConfig = {
      brand,
      allowed_scenarios: config.allowed_scenarios,
      approval_threshold: config.approval_threshold,
      ui: {
        mode: config.ui.mode,
        accent: config.ui.accent,
        radius: config.ui.radius,
        shadow: config.ui.shadow,
        font_pair: config.ui.font_pair,
        form_style: config.ui.form_style,
        h1_size: config.ui.h1_size,
      },
      limits: {
        max_messages: config.limits.max_messages,
        max_attachment_kb: config.limits.max_attachment_kb,
      },
    };
    res.json(publicConfig);
  });

  return router;
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return false;
    throw error;
  }
}

export const clientPublicRouter = createClientPublicRouter();
