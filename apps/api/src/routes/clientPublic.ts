import { Router, type Request, type Response } from 'express';
import type { PublicClientConfig } from '@alekstar79/ykassa-contracts';
import {
  CLIENTS_DIR,
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

  router.get('/:name/public', async (req: Request, res: Response) => {
    const clientName = validateClientName(req.params.name);
    const config = await loadClientConfig(clientName, clientsDir);
    const rawBrand = config.brand;
    const brand: NonNullable<typeof config.brand> = {};

    if (typeof rawBrand?.display_name === 'string') {
      brand.display_name = rawBrand.display_name;
    }
    if (typeof rawBrand?.tone === 'string') {
      brand.tone = rawBrand.tone;
    }
    if (
      typeof rawBrand?.primary_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(rawBrand.primary_color)
    ) {
      brand.primary_color = rawBrand.primary_color;
    }
    if (typeof rawBrand?.greeting === 'string') {
      brand.greeting = rawBrand.greeting;
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

export const clientPublicRouter = createClientPublicRouter();
