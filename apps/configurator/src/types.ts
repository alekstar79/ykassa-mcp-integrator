import type {
  ClientLimits,
  ClientUiConfig,
  KnownMcpScenario,
} from '@alekstar79/ykassa-contracts';

export type Theme = 'light' | 'dark';
export type ViewMode = 'settings' | 'preview';
export type NumericField =
  | 'approval_threshold'
  | 'limits.max_messages'
  | 'limits.max_attachment_kb';

export interface FormState {
  name: string;
  shop_id: string;
  mcp_token: string;
  allowed_scenarios: string[];
  approval_threshold: number;
  require_human_confirmation: boolean;
  brand: { display_name: string };
  ui: ClientUiConfig;
  limits: ClientLimits;
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
