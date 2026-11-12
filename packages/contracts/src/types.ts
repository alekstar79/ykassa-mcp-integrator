import type { z } from 'zod';
import type {
  ClientConfigSchema,
  ClientLimitsSchema,
  ClientUiConfigSchema,
} from './schema.js';

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type ClientUiConfig = z.infer<typeof ClientUiConfigSchema>;
export type ClientLimits = z.infer<typeof ClientLimitsSchema>;
export type ClientBrand = NonNullable<ClientConfig['brand']>;

export interface PublicClientConfig {
  brand: Pick<
    ClientBrand,
    'display_name' | 'tone' | 'primary_color' | 'greeting'
  >;
  allowed_scenarios: ClientConfig['allowed_scenarios'];
  approval_threshold: ClientConfig['approval_threshold'];
  ui: ClientUiConfig;
  limits: ClientLimits;
}
