import type { ClientDefaults, ClientVatCode } from '@alekstar79/ykassa-contracts';

export interface ProposedActionItem {
  tool: string;
  args: Record<string, unknown>;
  requires_confirmation?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  error?: string;
}

export interface ApiResponse {
  reply?: string;
  error?: string;
  session_id?: string;
  requires_approval?: boolean;
  approval_id?: string;
  proposed_action?: ProposedActionItem;
  proposed_actions?: ProposedActionItem[];
  tool_calls?: ToolCall[];
  warning?: string;
}

export type { PublicClientConfig } from '@alekstar79/ykassa-contracts';

export interface AvailableClient {
  name: string;
  display_name: string;
}

export interface PendingApproval {
  approvalId: string;
  actions: ProposedActionItem[];
}

export interface Attachment {
  filename: string;
  content: string;
  bytes: number;
}

export interface RequestPayload {
  message: string;
  attachment: Attachment | null;
}

export interface ChatTurn {
  id: string;
  createdAt: string;
  request: string;
  reply: string;
  warning: string;
  toolCalls: ToolCall[];
}

export interface UiDefaults {
  currency: ClientDefaults['currency'];
  vat_code: ClientVatCode;
  capture: ClientDefaults['capture'];
  return_url: string;
  invoice_expiry_days: ClientDefaults['invoice_expiry_days'];
}
