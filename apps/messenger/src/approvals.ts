import type { MessengerPlatform } from './types.js';

const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;

export interface ApprovalRegistration {
  approvalId: string;
  client: string;
  platform: MessengerPlatform;
  chatId: string;
  messageId: string;
  userId: string;
}

export interface PendingApproval extends ApprovalRegistration {
  expiresAt: number;
}

export interface ApprovalContext {
  client: string;
  platform: MessengerPlatform;
  chatId: string;
  userId: string;
}

export type TakeApprovalResult =
  | { status: 'ok'; approval: PendingApproval }
  | { status: 'expired' | 'missing' | 'unauthorized' };

export class ApprovalRegistry {
  private readonly approvals = new Map<string, PendingApproval>();

  constructor(
    private readonly ttlMs: number = DEFAULT_APPROVAL_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('ttlMs must be a positive number.');
    }
  }

  register(registration: ApprovalRegistration): PendingApproval {
    if (!registration.approvalId) {
      throw new Error('approvalId must not be empty.');
    }
    this.clearExpired();
    if (this.approvals.has(registration.approvalId)) {
      throw new Error('approvalId is already registered.');
    }
    const approval: PendingApproval = {
      ...registration,
      expiresAt: this.now() + this.ttlMs,
    };
    this.approvals.set(approval.approvalId, approval);
    return { ...approval };
  }

  take(approvalId: string, context: ApprovalContext): TakeApprovalResult {
    const result = this.inspect(approvalId, context);
    if (result.status !== 'ok') return result;
    this.approvals.delete(approvalId);
    return { status: 'ok', approval: { ...result.approval } };
  }

  inspect(approvalId: string, context: ApprovalContext): TakeApprovalResult {
    const approval = this.approvals.get(approvalId);
    if (approval === undefined) return { status: 'missing' };
    if (approval.expiresAt <= this.now()) {
      this.approvals.delete(approvalId);
      return { status: 'expired' };
    }
    if (
      approval.client !== context.client ||
      approval.platform !== context.platform ||
      approval.chatId !== context.chatId ||
      approval.userId !== context.userId
    ) {
      return { status: 'unauthorized' };
    }
    return { status: 'ok', approval: { ...approval } };
  }

  clearExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [approvalId, approval] of this.approvals) {
      if (approval.expiresAt <= now) {
        this.approvals.delete(approvalId);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.approvals.size;
  }
}
