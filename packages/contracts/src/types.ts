import type { z } from 'zod';
import type {
  ClientConfigSchema,
  ClientDefaultsSchema,
  ClientLimitsSchema,
  ClientMessengerPlatformConfigSchema,
  ClientMessengersConfigSchema,
  ClientUiConfigSchema,
} from './schema.js';

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type ClientDefaults = z.infer<typeof ClientDefaultsSchema>;
export type ClientUiConfig = z.infer<typeof ClientUiConfigSchema>;
export type ClientLimits = z.infer<typeof ClientLimitsSchema>;
export type ClientMessengerPlatformConfig = z.infer<
  typeof ClientMessengerPlatformConfigSchema
>;
export type ClientMessengersConfig = z.infer<
  typeof ClientMessengersConfigSchema
>;
export type ClientBrand = NonNullable<ClientConfig['brand']>;

export interface PublicClientConfig {
  brand: Pick<ClientBrand, 'display_name'>;
  allowed_scenarios: ClientConfig['allowed_scenarios'];
  approval_threshold: ClientConfig['approval_threshold'];
  ui: ClientUiConfig;
  limits: ClientLimits;
}
