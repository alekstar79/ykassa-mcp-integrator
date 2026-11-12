import { z } from 'zod';
import {
  CLIENT_ACCENTS,
  CLIENT_FONT_PAIRS,
  CLIENT_FORM_STYLES,
  CLIENT_H1_SIZES,
  CLIENT_RADII,
  CLIENT_SHADOWS,
  CLIENT_UI_MODES,
} from './enums.js';
import type { ClientRadius } from './enums.js';
import { CLIENT_CONFIG_DEFAULTS } from './defaults.js';
import { CLIENT_LIMITS } from './limits.js';

export const ClientUiConfigSchema = z
  .object({
    mode: z.enum(CLIENT_UI_MODES).default(CLIENT_CONFIG_DEFAULTS.ui.mode),
    accent: z.enum(CLIENT_ACCENTS).default(CLIENT_CONFIG_DEFAULTS.ui.accent),
    radius: z
      .number()
      .refine(
        (value): value is ClientRadius =>
          CLIENT_RADII.some((radius) => radius === value),
      )
      .default(CLIENT_CONFIG_DEFAULTS.ui.radius),
    shadow: z.enum(CLIENT_SHADOWS).default(CLIENT_CONFIG_DEFAULTS.ui.shadow),
    font_pair: z
      .enum(CLIENT_FONT_PAIRS)
      .default(CLIENT_CONFIG_DEFAULTS.ui.font_pair),
    form_style: z
      .enum(CLIENT_FORM_STYLES)
      .default(CLIENT_CONFIG_DEFAULTS.ui.form_style),
    h1_size: z.enum(CLIENT_H1_SIZES).default(CLIENT_CONFIG_DEFAULTS.ui.h1_size),
  });

export const ClientLimitsSchema = z
  .object({
    max_messages: z
      .int()
      .min(CLIENT_LIMITS.max_messages.min)
      .max(CLIENT_LIMITS.max_messages.max)
      .default(CLIENT_CONFIG_DEFAULTS.limits.max_messages),
    max_attachment_kb: z
      .int()
      .min(CLIENT_LIMITS.max_attachment_kb.min)
      .max(CLIENT_LIMITS.max_attachment_kb.max)
      .default(CLIENT_CONFIG_DEFAULTS.limits.max_attachment_kb),
  });

type ClientBrand = {
  display_name?: string;
  tone?: string;
  primary_color?: string;
  greeting?: string;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ClientBrandSchema = z
  .unknown()
  .optional()
  .transform((value): ClientBrand | undefined => {
    if (!isRecord(value)) return undefined;
    return value as ClientBrand;
  });

export const ClientConfigSchema = z.object({
  allowed_scenarios: z.array(z.string()).min(1),
  approval_threshold: z.number().nonnegative(),
  require_human_confirmation: z.boolean(),
  brand: ClientBrandSchema,
  ui: ClientUiConfigSchema.default(CLIENT_CONFIG_DEFAULTS.ui),
  limits: ClientLimitsSchema.default(CLIENT_CONFIG_DEFAULTS.limits),
});
