import type {
  ClientLimits,
  ClientMessengersConfig,
  ClientUiConfig,
  KnownMcpScenario,
} from '@alekstar79/ykassa-contracts';

export type Theme = 'light' | 'dark';
export type ViewMode = 'settings' | 'preview';
export const CLIENT_MODES = [
  'reference-ui',
  'custom-ui',
  'messengers',
] as const;
export type ClientMode = (typeof CLIENT_MODES)[number];
export type LlmProviderName = '' | 'openai' | 'anthropic' | 'google' | 'ollama';
export type NumericField =
  | 'approval_threshold'
  | 'limits.max_messages'
  | 'limits.max_attachment_kb';
export type ClientMessengerPlatform = keyof ClientMessengersConfig;
export type ClientMessengerLocale =
  ClientMessengersConfig['telegram']['locale'];

export interface LlmFormState {
  provider: LlmProviderName;
  model: string;
  base_url: string;
  api_key: string;
}

export interface MessengerFormState {
  enabled: boolean;
  allowed_user_ids_text: string;
  locale: ClientMessengerLocale;
  bot_token: string;
}

export interface FormState {
  name: string;
  shop_id: string;
  mcp_token: string;
  llm: LlmFormState;
  clientMode: ClientMode;
  allowed_scenarios: string[];
  approval_threshold: number;
  require_human_confirmation: boolean;
  brand: { display_name: string };
  ui: ClientUiConfig;
  limits: ClientLimits;
  messengers: Record<ClientMessengerPlatform, MessengerFormState>;
}

export interface ValidationSummaryItem {
  field: string;
  label: string;
  message: string;
}

export type ScenarioChangeHandler = (
  scenario: KnownMcpScenario,
  event: Event,
) => void;
