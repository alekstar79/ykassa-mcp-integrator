import type { ContinuationState } from './agentTypes.js';

export interface PendingApproval {
  client: string;
  continuation: ContinuationState;
  createdAt: number;
}

// TODO: Redis in production
export const pendingApprovals = new Map<string, PendingApproval>();
