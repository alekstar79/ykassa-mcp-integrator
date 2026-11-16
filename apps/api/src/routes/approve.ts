import { Router, type Request, type Response } from 'express';
import { createProviderFromEnv } from '../llm.js';
import { runAgent } from '../agent.js';
import {
  CLIENTS_DIR,
  loadClientConfig,
  loadClientSecrets,
  MCP_SERVER_URL,
} from '../config.js';
import { appendCallLog } from '../audit.js';
import { HttpError, isRecord } from '../http.js';
import { pendingApprovals } from '../pendingApprovals.js';

interface ApproveRouterOptions {
  clientsDir?: string;
  mcpUrl?: string;
}

export function createApproveRouter(options: ApproveRouterOptions = {}) {
  const router = Router();
  const clientsDir = options.clientsDir ?? CLIENTS_DIR;
  const mcpUrl = options.mcpUrl ?? MCP_SERVER_URL;
  router.post('/approve', (req, res) =>
    handleApprove(req, res, clientsDir, mcpUrl),
  );
  return router;
}

async function handleApprove(
  req: Request,
  res: Response,
  clientsDir: string,
  mcpUrl: string,
): Promise<void> {
  if (
    !isRecord(req.body) ||
    typeof req.body.approval_id !== 'string' ||
    typeof req.body.approved !== 'boolean'
  ) {
    throw new HttpError(
      400,
      'approval_id (string) and approved (boolean) are required.',
    );
  }

  const pending = pendingApprovals.get(req.body.approval_id);
  if (pending === undefined) {
    throw new HttpError(
      404,
      'Approval request was not found or was already resolved.',
    );
  }
  if (Date.now() - pending.createdAt > 15 * 60 * 1000) {
    pendingApprovals.delete(req.body.approval_id);
    throw new HttpError(410, 'Approval expired');
  }
  pendingApprovals.delete(req.body.approval_id);

  const config = await loadClientConfig(pending.client, clientsDir);
  const secrets = await loadClientSecrets(pending.client, clientsDir);
  const { provider, model } = createProviderFromEnv();
  const result = await runAgent(
    [],
    {
      mcpToken: secrets.mcpToken,
      mcpUrl,
      approvalThreshold: config.approval_threshold,
      requireHumanConfirmation: config.require_human_confirmation,
      allowedScenarios: config.allowed_scenarios,
      defaults: config.defaults,
      clientConfig: config,
    },
    {
      provider,
      model,
      logToolCall: async (entry) => appendCallLog(secrets.shopId, entry),
    },
    { ...pending.continuation, rejected: !req.body.approved },
  );

  if (result.requiresApproval !== undefined) {
    const primaryAction = result.requiresApproval.proposedActions.find(
      (action) => action.requires_confirmation,
    );
    if (primaryAction === undefined) {
      throw new Error(
        'Approval response did not include a confirmation-required action.',
      );
    }
    pendingApprovals.set(result.requiresApproval.approvalId, {
      client: pending.client,
      continuation: result.requiresApproval.continuation,
      createdAt: Date.now(),
    });
    res.status(202).json({
      reply: result.reply,
      requires_approval: true,
      approval_id: result.requiresApproval.approvalId,
      proposed_action: {
        tool: primaryAction.tool,
        args: primaryAction.args,
        requires_confirmation: primaryAction.requires_confirmation,
      },
      proposed_actions: result.requiresApproval.proposedActions,
      tool_calls: result.toolCalls,
    });
    return;
  }

  res.status(200).json({
    reply: result.reply,
    approved: req.body.approved,
    tool_calls: result.toolCalls,
    requires_approval: false,
  });
}

export const approveRouter = createApproveRouter();
