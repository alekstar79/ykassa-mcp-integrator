import type { SessionMessage } from './session.js';

export interface MessengerAttachmentPayload {
  filename: string;
  content: string;
}

export interface ToolCallResult {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  requires_confirmation: boolean;
}

export interface ApprovalRequiredResponse {
  reply: string;
  session_id?: string;
  warning?: string;
  requires_approval: true;
  approval_id: string;
  proposed_action: ProposedAction;
  proposed_actions: ProposedAction[];
  tool_calls: ToolCallResult[];
}

export interface AskCompleteResponse {
  reply: string;
  session_id?: string;
  warning?: string;
  requires_approval: false;
  tool_calls: ToolCallResult[];
}

export type AskResponse = AskCompleteResponse | ApprovalRequiredResponse;

export type ApproveResponse =
  | (AskCompleteResponse & { approved: boolean })
  | ApprovalRequiredResponse;

export interface PublicClientSummary {
  brand: { display_name?: string };
  allowed_scenarios: string[];
  approval_threshold: number;
}

export interface MessengerApiClient {
  ask(
    client: string,
    messages: SessionMessage[],
    attachment?: MessengerAttachmentPayload,
    sessionId?: string,
  ): Promise<AskResponse>;
  approve(approvalId: string, approved: boolean): Promise<ApproveResponse>;
  getPublicClient(client: string): Promise<PublicClientSummary>;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type Fetcher = typeof fetch;

export function createApiClient(
  apiBaseUrl: string,
  fetcher: Fetcher = globalThis.fetch,
): MessengerApiClient {
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  return {
    async ask(client, messages, attachment, sessionId) {
      const body: Record<string, unknown> = {
        client,
        messages,
      };
      if (attachment !== undefined) body.attachment = attachment;
      if (sessionId !== undefined) body.session_id = sessionId;
      const response = await fetcher(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readResponse(response);
      if (response.status === 200) return parseAskComplete(data);
      if (response.status === 202) return parseApprovalRequired(data);
      throw apiError(response.status, data);
    },

    async approve(approvalId, approved) {
      const response = await fetcher(`${baseUrl}/api/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, approved }),
      });
      const data = await readResponse(response);
      if (response.status === 200) {
        if (!isRecord(data) || typeof data.approved !== 'boolean') {
          throw new ApiClientError(200, 'API returned an invalid approval response.');
        }
        return { ...parseAskComplete(data), approved: data.approved };
      }
      if (response.status === 202) return parseApprovalRequired(data);
      throw apiError(response.status, data);
    },

    async getPublicClient(client) {
      const response = await fetcher(
        `${baseUrl}/api/clients/${encodeURIComponent(client)}/public`,
        { method: 'GET', headers: { accept: 'application/json' } },
      );
      const data = await readResponse(response);
      if (response.status !== 200) throw apiError(response.status, data);
      if (
        !isRecord(data) ||
        !isRecord(data.brand) ||
        (data.brand.display_name !== undefined &&
          typeof data.brand.display_name !== 'string') ||
        !isStringArray(data.allowed_scenarios) ||
        typeof data.approval_threshold !== 'number'
      ) {
        throw new ApiClientError(200, 'API returned an invalid public client config.');
      }
      const brand: PublicClientSummary['brand'] = {};
      if (typeof data.brand.display_name === 'string') {
        brand.display_name = data.brand.display_name;
      }
      return {
        brand,
        allowed_scenarios: data.allowed_scenarios,
        approval_threshold: data.approval_threshold,
      };
    },
  };
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    const data: unknown = await response.json();
    return data;
  } catch {
    return undefined;
  }
}

function parseAskComplete(value: unknown): AskCompleteResponse {
  if (
    !isRecord(value) ||
    typeof value.reply !== 'string' ||
    value.requires_approval !== false ||
    (value.session_id !== undefined && typeof value.session_id !== 'string') ||
    (value.warning !== undefined && typeof value.warning !== 'string') ||
    !isToolCallArray(value.tool_calls)
  ) {
    throw new ApiClientError(200, 'API returned an invalid ask response.');
  }
  return {
    reply: value.reply,
    ...(typeof value.session_id === 'string'
      ? { session_id: value.session_id }
      : {}),
    ...(typeof value.warning === 'string' ? { warning: value.warning } : {}),
    requires_approval: false,
    tool_calls: value.tool_calls,
  };
}

function parseApprovalRequired(value: unknown): ApprovalRequiredResponse {
  if (
    !isRecord(value) ||
    typeof value.reply !== 'string' ||
    value.requires_approval !== true ||
    (value.session_id !== undefined && typeof value.session_id !== 'string') ||
    (value.warning !== undefined && typeof value.warning !== 'string') ||
    typeof value.approval_id !== 'string' ||
    value.approval_id.length === 0 ||
    !isProposedAction(value.proposed_action) ||
    !isProposedActionArray(value.proposed_actions) ||
    value.proposed_actions.length === 0 ||
    !isToolCallArray(value.tool_calls)
  ) {
    throw new ApiClientError(202, 'API returned an invalid approval response.');
  }
  return {
    reply: value.reply,
    ...(typeof value.session_id === 'string'
      ? { session_id: value.session_id }
      : {}),
    ...(typeof value.warning === 'string' ? { warning: value.warning } : {}),
    requires_approval: true,
    approval_id: value.approval_id,
    proposed_action: value.proposed_action,
    proposed_actions: value.proposed_actions,
    tool_calls: value.tool_calls,
  };
}

function apiError(status: number, value: unknown): ApiClientError {
  const message =
    isRecord(value) && typeof value.error === 'string'
      ? value.error
      : `API request failed with status ${status}.`;
  return new ApiClientError(status, message);
}

function isToolCallArray(value: unknown): value is ToolCallResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        (item.result === undefined || typeof item.result === 'string') &&
        (item.error === undefined || typeof item.error === 'string') &&
        (item.args === undefined || isRecord(item.args)),
    )
  );
}

function isProposedAction(value: unknown): value is ProposedAction {
  return (
    isRecord(value) &&
    typeof value.tool === 'string' &&
    isRecord(value.args) &&
    typeof value.requires_confirmation === 'boolean'
  );
}

function isProposedActionArray(value: unknown): value is ProposedAction[] {
  return Array.isArray(value) && value.every(isProposedAction);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
