import {
  LLMAPIError,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatStreamResult,
  type FinishReason,
  type LLMProvider,
  type OpenAIChunk,
  type OpenAIConfig,
  type OpenAIDelta,
  type SSEEvent,
} from '../types.js';
import { readErrorBody, SSEParserStream, tryParseJSON } from '../sse-parser.js';

// OpenAI-compatible provider (also covers LM Studio, vLLM, OpenRouter, etc.)
// ---------------------------------------------------------------------------
export function createOpenAI(config: OpenAIConfig): LLMProvider {
  return {
    id: 'openai',
    supportsRequiredToolChoice: true,

    async chat(request: ChatRequest): Promise<ChatStreamResult> {
      const url = getOpenAIChatCompletionsURL(config.baseURL);

      const body: Record<string, unknown> = {
        model: request.model,
        messages: toOpenAIMessages(request.messages),
        stream: true,
        stream_options: { include_usage: true },
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
      if (request.toolChoice === 'required') {
        body.tool_choice = 'required';
      }

      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!httpResponse.ok) {
        const errorBody = await readErrorBody(httpResponse);
        throw new LLMAPIError({
          message: `OpenAI API responded with ${httpResponse.status}: ${errorBody}`,
          status: httpResponse.status,
          provider: 'openai',
          body: errorBody,
        });
      }

      if (httpResponse.body === null) {
        throw new Error('OpenAI response has no body');
      }

      let resolveResponse!: (value: ChatResponse) => void;
      const responsePromise = new Promise<ChatResponse>((resolve) => {
        resolveResponse = resolve;
      });
      let responseResolved = false;
      const resolveOnce = (value: ChatResponse): void => {
        if (responseResolved) {
          return;
        }
        responseResolved = true;
        resolveResponse(value);
      };

      const pendingToolCalls = new Map<
        number,
        { id?: string; name?: string; started: boolean; queuedArguments: string[] }
      >();

      let sawToolCall = false;

      const stream = httpResponse.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new SSEParserStream())
        .pipeThrough(
          new TransformStream<SSEEvent, ChatStreamChunk>({
            transform(
              event: SSEEvent,
              controller: TransformStreamDefaultController<ChatStreamChunk>,
            ): void {
              if (event.data === '[DONE]') {
                return;
              }

              const parsed = tryParseJSON(event.data) as OpenAIChunk | undefined;
              if (parsed === undefined) {
                return;
              }

              const choice = parsed.choices?.[0];
              if (choice === undefined) {
                if (parsed.usage !== undefined) {
                  resolveOnce({
                    finishReason: sawToolCall ? 'tool-calls' : 'stop',
                    usage: {
                      promptTokens: parsed.usage.prompt_tokens,
                      completionTokens: parsed.usage.completion_tokens,
                      totalTokens: parsed.usage.total_tokens,
                    },
                  });
                }
                return;
              }

              const delta = choice.delta;

              if (typeof delta.content === 'string' && delta.content !== '') {
                controller.enqueue({ type: 'text-delta', text: delta.content });
              }

              if (delta.tool_calls !== undefined) {
                for (const [position, toolCall] of delta.tool_calls.entries()) {
                  const index = toolCall.index ?? position;
                  let entry = pendingToolCalls.get(index);
                  if (entry === undefined) {
                    entry = { started: false, queuedArguments: [] };
                    pendingToolCalls.set(index, entry);
                  }

                  if (toolCall.id !== undefined) {
                    entry.id = toolCall.id;
                  }
                  if (toolCall.function?.name !== undefined) {
                    entry.name = toolCall.function.name;
                  }

                  if (entry.id !== undefined && entry.name !== undefined && !entry.started) {
                    controller.enqueue({
                      type: 'tool-call-start',
                      toolCallId: entry.id,
                      toolName: entry.name,
                    });
                    entry.started = true;

                    for (const queued of entry.queuedArguments) {
                      controller.enqueue({
                        type: 'tool-call-delta',
                        toolCallId: entry.id,
                        args: queued,
                      });
                    }
                    entry.queuedArguments = [];
                  }

                  const argumentFragment = toolCall.function?.arguments;
                  if (argumentFragment !== undefined) {
                    if (entry.started && entry.id !== undefined) {
                      controller.enqueue({
                        type: 'tool-call-delta',
                        toolCallId: entry.id,
                        args: argumentFragment,
                      });
                    } else {
                      entry.queuedArguments.push(argumentFragment);
                    }
                  }
                }
              }

              if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
                for (const entry of pendingToolCalls.values()) {
                  if (entry.started && entry.id !== undefined) {
                    controller.enqueue({ type: 'tool-call-end', toolCallId: entry.id });
                  }
                }
                pendingToolCalls.clear();

                let reason: FinishReason = 'stop';
                if (choice.finish_reason === 'tool_calls') {
                  reason = 'tool-calls';
                } else if (choice.finish_reason === 'length') {
                  reason = 'length';
                }
                sawToolCall = reason === 'tool-calls';
                controller.enqueue({ type: 'finish', finishReason: reason });
                resolveOnce({ finishReason: reason, usage: undefined });
              }
            },

            flush(): void {
              if (!responseResolved) {
                resolveOnce({ finishReason: 'stop', usage: undefined });
                console.error('[llm] openai stream ended without usage chunk');
              }
            },
          }),
        );

      return { stream, response: responsePromise };
    },
  };
}

function getOpenAIChatCompletionsURL(baseURL: string | undefined): string {
  if (baseURL === undefined) {
    return 'https://api.openai.com/v1/chat/completions';
  }

  const url = new URL(baseURL);
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions')) {
    url.pathname += '/chat/completions';
  }
  return url.toString();
}

function toOpenAIMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
      };
    }
    if (message.role === 'assistant' && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: message.content.length > 0 ? message.content : null,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments:
              typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args),
          },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

// ---------------------------------------------------------------------------
