import { appendFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { PROJECT_ROOT } from './config.js';
import { errorMessage } from './http.js';

const MCP_CALL_LOG = path.join(PROJECT_ROOT, 'logs', 'mcp-calls.jsonl');

export async function appendCallLog(
  shopId: string,
  entry: Record<string, unknown>,
): Promise<void> {
  try {
    await mkdir(path.dirname(MCP_CALL_LOG), { recursive: true });
    await appendFile(
      MCP_CALL_LOG,
      `${JSON.stringify({ timestamp: new Date().toISOString(), shop_id: shopId, ...entry })}\n`,
      'utf8',
    );
  } catch (error) {
    console.error('Could not write the MCP call log:', errorMessage(error));
  }
}
