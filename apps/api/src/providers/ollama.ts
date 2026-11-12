import {
  LLMAPIError,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatStreamResult,
  type FinishReason,
  type LLMProvider,
  type OllamaChunk,
  type OllamaConfig,
  type OllamaStreamState,
} from '../types.js';
import { readErrorBody, tryParseJSON } from '../sse-parser.js';

// Ollama provider (local models, no API key)
// ---------------------------------------------------------------------------
function processOllamaRecord(
  parsed: OllamaChunk,
  controller: TransformStreamDefaultController<ChatStreamChunk>,
  state: OllamaStreamState,
): void {
  if (typeof parsed.message?.content === 'string' && parsed.message.content.length > 0) {
    controller.enqueue({ type: 'text-delta', text: parsed.message.content });
  }

  for (const toolCall of parsed.message?.tool_calls ?? []) {
    state.sawToolCall = true;
    const toolCallId = `ollama-tool-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    controller.enqueue({
      type: 'tool-call-start',
      toolCallId,
      toolName: toolCall.function.name,
    });
    controller.enqueue({
      type: 'tool-call-delta',
      toolCallId,
      args: JSON.stringify(toolCall.function.arguments),
    });
    controller.enqueue({ type: 'tool-call-end', toolCallId });
  }

  if (parsed.done === true) {
    const finishReason: FinishReason = state.sawToolCall ? 'tool-calls' : 'stop';
    controller.enqueue({ type: 'finish', finishReason });
    state.resolveOnce({
      finishReason,
      usage:
        parsed.eval_count !== undefined
          ? {
              promptTokens: parsed.prompt_eval_count ?? 0,
              completionTokens: parsed.eval_count,
              totalTokens: (parsed.prompt_eval_count ?? 0) + parsed.eval_count,
            }
          : undefined,
    });
  }
}

export function createOllama(config: OllamaConfig = {}): LLMProvider {
  const baseURL = config.baseURL ?? 'http://localhost:11434';

  return {
    id: 'ollama',

    async chat(request: ChatRequest): Promise<ChatStreamResult> {
      const url = baseURL + '/api/chat';

      const body: Record<string, unknown> = {
        model: request.model,
        messages: toOllamaMessages(request.messages),
        stream: true,
      };

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
      }

      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!httpResponse.ok) {
        const errorBody = await readErrorBody(httpResponse);
        throw new LLMAPIError({
          message: `Ollama responded with ${httpResponse.status}: ${errorBody}`,
          status: httpResponse.status,
          provider: 'ollama',
          body: errorBody,
        });
      }

      if (httpResponse.body === null) {
        throw new Error('Ollama response has no body');
      }

      let resolveResponse!: (value: ChatResponse) => void;
      const responsePromise = new Promise<ChatResponse>((resolve) => {
        resolveResponse = resolve;
      });
      const state: OllamaStreamState = {
        sawToolCall: false,
        responseResolved: false,
        resolveOnce(value): void {
          if (state.responseResolved) {
            return;
          }
          state.responseResolved = true;
          resolveResponse(value);
        },
      };

      // Ollama streams NDJSON, not SSE, so we split on newlines instead.
      let buffer = '';

      const stream = httpResponse.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(
          new TransformStream<string, ChatStreamChunk>({
            transform(
              textChunk: string,
              controller: TransformStreamDefaultController<ChatStreamChunk>,
            ): void {
              buffer += textChunk;
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                if (line.trim() === '') {
                  continue;
                }

                const parsed = tryParseJSON(line) as OllamaChunk | undefined;
                if (parsed === undefined) {
                  continue;
                }
                processOllamaRecord(parsed, controller, state);
              }
            },

            flush(controller: TransformStreamDefaultController<ChatStreamChunk>): void {
              if (buffer.trim() !== '') {
                const parsed = tryParseJSON(buffer) as OllamaChunk | undefined;
                if (parsed !== undefined) {
                  processOllamaRecord(parsed, controller, state);
                }
              }
              if (!state.responseResolved) {
                const finishReason: FinishReason = state.sawToolCall
                  ? 'tool-calls'
                  : 'stop';
                controller.enqueue({ type: 'finish', finishReason });
                state.resolveOnce({ finishReason });
              }
            },
          }),
        );

      return { stream, response: responsePromise };
    },
  };
}

function toOllamaMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_name: message.toolCallId,
      };
    }

    if (message.role === 'assistant' && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls.map((toolCall) => ({
          function: {
            name: toolCall.name,
            arguments:
              typeof toolCall.args === 'string'
                ? tryParseJSON(toolCall.args) ?? {}
                : toolCall.args,
          },
        })),
      };
    }

    return { role: message.role, content: message.content };
  });
}

// ---------------------------------------------------------------------------
