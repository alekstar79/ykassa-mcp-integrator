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
  requires_approval?: boolean;
  approval_id?: string;
  proposed_action?: ProposedActionItem;
  proposed_actions?: ProposedActionItem[];
  tool_calls?: ToolCall[];
  warning?: string;
}

export type { PublicClientConfig } from '@alekstar79/ykassa-contracts';

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
