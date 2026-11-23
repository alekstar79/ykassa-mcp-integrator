import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MessengerAuditLogger } from '../src/audit.js';

describe('MessengerAuditLogger', () => {
  let temporaryRoot = '';

  afterEach(async () => {
    if (temporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('writes only allowlisted audit fields and never stores tokens or message bodies', async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ykassa-audit-'));
    const logPath = path.join(temporaryRoot, 'logs', 'messenger-actions.jsonl');
    const logger = new MessengerAuditLogger(
      logPath,
      () => Date.parse('2026-11-23T00:00:00.000Z'),
    );
    const entry = {
      platform: 'telegram' as const,
      client: 'online-school',
      userId: 'user-1',
      event: 'ask_requested' as const,
      approvalId: 'approval-1',
      token: 'secret-token-value',
      message: 'private message body',
    };

    await logger.append(entry);

    const content = await readFile(logPath, 'utf8');
    const record: unknown = JSON.parse(content);
    expect(record).toEqual({
      timestamp: '2026-11-23T00:00:00.000Z',
      platform: 'telegram',
      client: 'online-school',
      user_id: 'user-1',
      event: 'ask_requested',
      approval_id: 'approval-1',
    });
    expect(content).not.toContain('secret-token-value');
    expect(content).not.toContain('private message body');
  });

  it('uses the configured log root for packaged CLI runs', async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ykassa-audit-root-'));
    const previousLogDir = process.env.MESSENGER_AUDIT_LOG_DIR;
    process.env.MESSENGER_AUDIT_LOG_DIR = temporaryRoot;
    try {
      const logger = new MessengerAuditLogger();
      await logger.append({
        platform: 'max',
        client: 'online-school',
        userId: 'user-2',
        event: 'message_received',
      });

      const logPath = path.join(
        temporaryRoot,
        'logs',
        'messenger-actions.jsonl',
      );
      await expect(readFile(logPath, 'utf8')).resolves.toContain('"user_id":"user-2"');
    } finally {
      if (previousLogDir === undefined) {
        delete process.env.MESSENGER_AUDIT_LOG_DIR;
      } else {
        process.env.MESSENGER_AUDIT_LOG_DIR = previousLogDir;
      }
    }
  });
});
