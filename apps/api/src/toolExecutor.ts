import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ChatMessage } from './llm.js';
import type { AgentDeps, ToolCallRecord } from './agentTypes.js';

export async function executeToolCall(
  mcpClient: Client,
  toolCall: { id: string; name: string; args: unknown },
  sanitizedArgs: Record<string, unknown>,
  history: ChatMessage[],
  executedToolCalls: ToolCallRecord[],
  deps: AgentDeps,
): Promise<void> {
  try {
    const toolResponse: unknown = await mcpClient.callTool({
      name: toolCall.name,
      arguments: sanitizedArgs,
    });
    const toolResultText = extractTextFromToolResult(toolResponse);
    const isError =
      typeof toolResponse === 'object' &&
      toolResponse !== null &&
      'isError' in toolResponse &&
      toolResponse.isError === true;

    if (isError) {
      await deps.logToolCall?.({
        tool: toolCall.name,
        args: sanitizedArgs,
        error: toolResultText,
      });
      executedToolCalls.push({
        id: toolCall.id,
        name: toolCall.name,
        args: sanitizedArgs,
        error: toolResultText,
      });
      history.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: toolResultText }),
      });
      return;
    }

    await deps.logToolCall?.({
      tool: toolCall.name,
      args: sanitizedArgs,
      result: toolResultText,
    });
    executedToolCalls.push({
      id: toolCall.id,
      name: toolCall.name,
      args: sanitizedArgs,
      result: toolResultText,
    });
    history.push({
      role: 'tool',
      toolCallId: toolCall.id,
      content: toolResultText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.logToolCall?.({
      tool: toolCall.name,
      args: sanitizedArgs,
      error: message,
    });
    executedToolCalls.push({
      id: toolCall.id,
      name: toolCall.name,
      args: sanitizedArgs,
      error: message,
    });
    history.push({
      role: 'tool',
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: message }),
    });
  }
}

export function extractTextFromToolResult(result: unknown): string {
  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    const content = (result as { content: Array<{ type: string; text?: string }> })
      .content;
    return content
      .filter(
        (item): item is { type: 'text'; text: string } =>
          item.type === 'text' && typeof item.text === 'string',
      )
      .map((item) => item.text)
      .join('\n');
  }
  if (typeof result === 'object' && result !== null && 'toolResult' in result) {
    return JSON.stringify((result as { toolResult: unknown }).toolResult);
  }
  return '';
}
