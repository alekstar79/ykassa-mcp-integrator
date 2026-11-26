import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PROJECT_ROOT, validateClientName } from './config.js';
import { HttpError, isRecord } from './http.js';

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_HISTORY_LIMIT = 4;
const MAX_HISTORY_LIMIT = 8;
const MAX_MESSAGE_CHARS = 6000;

export const CHAT_HISTORY_DIR = path.join(
  PROJECT_ROOT,
  'logs',
  'chat-history',
);

export interface ChatHistoryToolCall {
  name: string;
  args: unknown;
  result?: string;
  error?: string;
}

export interface ChatHistoryMessage {
  id: string;
  turnId: string;
  createdAt: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatHistoryToolCall[];
}

export interface ChatHistoryInput {
  turnId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatHistoryToolCall[];
}

export function resolveSessionId(value: unknown): string {
  if (value === undefined) return randomUUID();
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    throw new HttpError(400, '"session_id" must be a valid UUID.');
  }
  return value.toLowerCase();
}

export async function appendChatHistory(
  clientName: string,
  sessionId: string,
  messages: readonly ChatHistoryInput[],
  historyDir: string = CHAT_HISTORY_DIR,
): Promise<void> {
  if (messages.length === 0) return;
  const filePath = historyFilePath(clientName, sessionId, historyDir);
  await mkdir(path.dirname(filePath), { recursive: true });

  const records = messages.map((message): ChatHistoryMessage => ({
    id: randomUUID(),
    turnId: message.turnId,
    createdAt: new Date().toISOString(),
    role: message.role,
    content: message.content,
    ...(message.toolCalls === undefined
      ? {}
      : { toolCalls: message.toolCalls }),
  }));
  await appendFile(
    filePath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  );
}

export async function readRelevantChatHistory(
  clientName: string,
  sessionId: string,
  query: string,
  requestedLimit: number = DEFAULT_HISTORY_LIMIT,
  excludedTurnId?: string,
  historyDir: string = CHAT_HISTORY_DIR,
): Promise<ChatHistoryMessage[]> {
  const filePath = historyFilePath(clientName, sessionId, historyDir);
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return [];
    throw error;
  }

  const records = contents
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseHistoryMessage);
  const eligible = records.filter(
    (record) => record.turnId !== excludedTurnId,
  );
  if (eligible.length === 0) return [];

  const limit = normalizeHistoryLimit(requestedLimit);
  const turns = groupByTurn(eligible);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return turns.slice(-limit).flatMap((turn) => turn);
  }

  const recentTurns = turns.slice(-Math.min(limit, 1));
  const selected = new Set(recentTurns.map((turn) => turn[0]?.turnId));
  const relevantTurns = turns
    .map((turn, index) => ({
      turn,
      index,
      score: scoreTurn(turn, queryTokens),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || right.index - left.index,
    );

  for (const candidate of relevantTurns) {
    if (selected.size >= limit) break;
    selected.add(candidate.turn[0]?.turnId);
  }
  for (let index = turns.length - 1; selected.size < limit && index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn !== undefined) selected.add(turn[0]?.turnId);
  }

  return eligible.filter((message) => selected.has(message.turnId));
}

export function formatChatHistoryForModel(
  messages: readonly ChatHistoryMessage[],
): string {
  if (messages.length === 0) return 'История этой сессии пока пуста.';

  const formatted = messages.map((message) => ({
    role: message.role,
    content: clipText(message.content, MAX_MESSAGE_CHARS),
    created_at: message.createdAt,
    ...(message.toolCalls === undefined || message.toolCalls.length === 0
      ? {}
      : {
          tool_calls: message.toolCalls.map((toolCall) => ({
            name: toolCall.name,
            args: clipJson(toolCall.args, 2000),
            ...(toolCall.result === undefined
              ? {}
              : { result: clipText(toolCall.result, MAX_MESSAGE_CHARS) }),
            ...(toolCall.error === undefined
              ? {}
              : { error: clipText(toolCall.error, 2000) }),
          })),
        }),
  }));
  return JSON.stringify(formatted);
}

function historyFilePath(
  clientName: string,
  sessionId: string,
  historyDir: string,
): string {
  const safeClientName = validateClientName(clientName);
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new HttpError(400, '"session_id" must be a valid UUID.');
  }
  return path.join(path.resolve(historyDir), safeClientName, `${sessionId}.jsonl`);
}

function parseHistoryMessage(line: string): ChatHistoryMessage {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('Chat history contains invalid JSON.');
  }
  if (!isChatHistoryMessage(value)) {
    throw new Error('Chat history contains an invalid record.');
  }
  return value;
}

function isChatHistoryMessage(value: unknown): value is ChatHistoryMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.turnId === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    (value.toolCalls === undefined ||
      (Array.isArray(value.toolCalls) &&
        value.toolCalls.every(isChatHistoryToolCall)))
  );
}

function isChatHistoryToolCall(value: unknown): value is ChatHistoryToolCall {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    'args' in value &&
    (value.result === undefined || typeof value.result === 'string') &&
    (value.error === undefined || typeof value.error === 'string')
  );
}

function normalizeHistoryLimit(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_HISTORY_LIMIT
  ) {
    throw new RangeError(
      `History limit must be an integer from 1 to ${MAX_HISTORY_LIMIT}.`,
    );
  }
  return value;
}

function groupByTurn(
  messages: readonly ChatHistoryMessage[],
): ChatHistoryMessage[][] {
  const turns = new Map<string, ChatHistoryMessage[]>();
  const lastIndexByTurn = new Map<string, number>();
  for (const [index, message] of messages.entries()) {
    const turn = turns.get(message.turnId) ?? [];
    turn.push(message);
    turns.set(message.turnId, turn);
    lastIndexByTurn.set(message.turnId, index);
  }
  return [...turns.entries()]
    .sort(
      ([left], [right]) =>
        (lastIndexByTurn.get(left) ?? 0) - (lastIndexByTurn.get(right) ?? 0),
    )
    .map(([, turn]) => turn);
}

function tokenize(value: string): string[] {
  return (
    value
      .toLocaleLowerCase('ru')
      .replaceAll('ё', 'е')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((token) => token.length >= 3);
}

function scoreTurn(
  messages: readonly ChatHistoryMessage[],
  queryTokens: readonly string[],
): number {
  const turnText = messages
    .map((message) =>
      [
        message.content,
        ...(message.toolCalls ?? []).flatMap((toolCall) => [
          toolCall.name,
          JSON.stringify(toolCall.args),
          toolCall.result ?? '',
          toolCall.error ?? '',
        ]),
      ].join(' '),
    )
    .join(' ')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е');
  const turnTokens = tokenize(turnText);
  return queryTokens.reduce((score, queryToken) => {
    const matched = turnTokens.some(
      (turnToken) =>
        turnToken === queryToken ||
        (queryToken.length >= 5 &&
          turnToken.slice(0, 5) === queryToken.slice(0, 5)),
    );
    return score + (matched ? 1 : 0);
  }, 0);
}

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sideLength = Math.floor((maxLength - 32) / 2);
  return `${value.slice(0, sideLength)}\n[...текст сокращён...]\n${value.slice(-sideLength)}`;
}

function clipJson(value: unknown, maxLength: number): unknown {
  const serialized = JSON.stringify(value) ?? String(value);
  if (serialized.length <= maxLength) return value;
  return clipText(serialized, maxLength);
}
