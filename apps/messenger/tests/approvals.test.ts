import { describe, expect, it } from 'vitest';
import { ApprovalRegistry } from '../src/approvals.js';

const registration = {
  approvalId: 'approval-1',
  client: 'online-school',
  platform: 'telegram' as const,
  chatId: 'chat-1',
  messageId: 'message-1',
  userId: 'user-1',
};

const ownerContext = {
  client: 'online-school',
  platform: 'telegram' as const,
  chatId: 'chat-1',
  userId: 'user-1',
};

describe('ApprovalRegistry', () => {
  it('allows only the original client, platform, chat, and user to take an approval', () => {
    const approvals = new ApprovalRegistry();
    approvals.register(registration);

    expect(
      approvals.take('approval-1', { ...ownerContext, userId: 'user-2' }),
    ).toEqual({ status: 'unauthorized' });
    expect(approvals.take('approval-1', ownerContext).status).toBe('ok');
  });

  it('expires approvals at the TTL boundary', () => {
    let now = 0;
    const approvals = new ApprovalRegistry(15_000, () => now);
    approvals.register(registration);
    now = 15_000;

    expect(approvals.take('approval-1', ownerContext)).toEqual({
      status: 'expired',
    });
    expect(approvals.size).toBe(0);
  });

  it('consumes an approval once and rejects repeated presses', () => {
    const approvals = new ApprovalRegistry();
    approvals.register(registration);

    expect(approvals.take('approval-1', ownerContext).status).toBe('ok');
    expect(approvals.take('approval-1', ownerContext)).toEqual({
      status: 'missing',
    });
  });
});
