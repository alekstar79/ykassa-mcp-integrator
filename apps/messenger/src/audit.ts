import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MessengerPlatform } from './types.js';

export type MessengerAuditEvent =
  | 'message_received'
  | 'message_denied'
  | 'command'
  | 'ask_requested'
  | 'approval_requested'
  | 'approval_accepted'
  | 'approval_rejected'
  | 'callback_denied'
  | 'api_error'
  | 'config_error';

export interface MessengerAuditEntry {
  platform: MessengerPlatform;
  client: string;
  userId: string;
  event: MessengerAuditEvent;
  approvalId?: string;
}

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
function defaultLogPath(): string {
  return path.join(
    process.env.MESSENGER_AUDIT_LOG_DIR ?? PROJECT_ROOT,
    'logs',
    'messenger-actions.jsonl',
  );
}

export class MessengerAuditLogger {
  constructor(
    private readonly logPath: string = defaultLogPath(),
    private readonly now: () => number = Date.now,
  ) {}

  async append(entry: MessengerAuditEntry): Promise<void> {
    const record: {
      timestamp: string;
      platform: MessengerPlatform;
      client: string;
      user_id: string;
      event: MessengerAuditEvent;
      approval_id?: string;
    } = {
      timestamp: new Date(this.now()).toISOString(),
      platform: entry.platform,
      client: entry.client,
      user_id: entry.userId,
      event: entry.event,
    };
    if (entry.approvalId !== undefined) {
      record.approval_id = entry.approvalId;
    }
    await mkdir(path.dirname(this.logPath), { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
