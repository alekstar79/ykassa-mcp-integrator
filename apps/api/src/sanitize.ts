import { isRecord } from './http.js';

export function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function sanitizeReply(text: string): string {
  const cjkIndex = text.search(/[\u4e00-\u9fff\u3040-\u30ff]/);
  return cjkIndex === -1 ? text : text.slice(0, cjkIndex).trimEnd();
}
