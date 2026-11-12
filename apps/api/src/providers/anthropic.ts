import {
  LLMAPIError,
  type AnthropicConfig,
  type AnthropicEvent,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatStreamResult,
  type FinishReason,
  type LLMProvider,
  type SSEEvent,
} from '../types.js';
import { readErrorBody, SSEParserStream, tryParseJSON } from '../sse-parser.js';

// Anthropic provider
// ---------------------------------------------------------------------------
export function createAnthropic(config: AnthropicConfig): LLMProvider {
  return {
    id: 'anthropic',

    async chat(request: ChatRequest): Promise<ChatStreamResult> {
      const url = (config.baseURL ?? 'https://api.anthropic.com') + '/v1/messages';

      const systemMessage = request.messages.find((message) => message.role === 'system');
      const conversationMessages = request.messages.filter((message) => message.role !== 'system');

      const body: Record<string, unknown> = {
        model: request.model,
        messages: toAnthropicMessages(conversationMessages),
        max_tokens: 4096,
        stream: true,
      };

      if (systemMessage !== undefined && typeof systemMessage.content === 'string') {
        body.system = systemMessage.content;
      }

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        }));
      }

      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!httpResponse.ok) {
        const errorBody = await readErrorBody(httpResponse);
        throw new LLMAPIError({
          message: `Anthropic API responded with ${httpResponse.status}: ${errorBody}`,
          status: httpResponse.status,
          provider: 'anthropic',
          body: errorBody,
        });
      }

      if (httpResponse.body === null) {
        throw new Error('Anthropic response has no body');
      }

      let resolveResponse!: (value: ChatResponse) => void;
      const responsePromise = new Promise<ChatResponse>((resolve) => {
        resolveResponse = resolve;
      });

      let currentToolCallId = '';

      const stream = httpResponse.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new SSEParserStream())
        .pipeThrough(
          new TransformStream<SSEEvent, ChatStreamChunk>({
            transform(
              sseEvent: SSEEvent,
              controller: TransformStreamDefaultController<ChatStreamChunk>,
            ): void {
              const parsed = tryParseJSON(sseEvent.data) as AnthropicEvent | undefined;
              if (parsed === undefined) {
                return;
              }

              const eventType = sseEvent.event ?? parsed.type;

              if (eventType === 'content_block_start' && parsed.content_block !== undefined) {
                if (parsed.content_block.type === 'tool_use' && parsed.content_block.id !== undefined) {
                  currentToolCallId = parsed.content_block.id;
                  controller.enqueue({
                    type: 'tool-call-start',
                    toolCallId: currentToolCallId,
                    toolName: parsed.content_block.name ?? '',
                  });
                }
                return;
              }

              if (eventType === 'content_block_delta' && parsed.delta !== undefined) {
                if (parsed.delta.type === 'text_delta' && parsed.delta.text !== undefined) {
                  controller.enqueue({ type: 'text-delta', text: parsed.delta.text });
                }
                if (parsed.delta.type === 'input_json_delta' && parsed.delta.partial_json !== undefined) {
                  controller.enqueue({
                    type: 'tool-call-delta',
                    toolCallId: currentToolCallId,
                    args: parsed.delta.partial_json,
                  });
                }
                return;
              }

              if (eventType === 'content_block_stop') {
                if (currentToolCallId !== '') {
                  controller.enqueue({ type: 'tool-call-end', toolCallId: currentToolCallId });
                  currentToolCallId = '';
                }
                return;
              }

              if (eventType === 'message_delta' && parsed.delta !== undefined) {
                let reason: FinishReason = 'stop';
                if (parsed.delta.stop_reason === 'tool_use') {
                  reason = 'tool-calls';
                } else if (parsed.delta.stop_reason === 'max_tokens') {
                  reason = 'length';
                }

                controller.enqueue({ type: 'finish', finishReason: reason });
                resolveResponse({
                  finishReason: reason,
                  usage:
                    parsed.usage?.output_tokens !== undefined
                      ? {
                          promptTokens: 0,
                          completionTokens: parsed.usage.output_tokens,
                          totalTokens: parsed.usage.output_tokens,
                        }
                      : undefined,
                });
                return;
              }

              if (eventType === 'error' && parsed.error?.message !== undefined) {
                controller.enqueue({
                  type: 'error',
                  error: new Error(`Anthropic stream error: ${parsed.error.message}`),
                });
              }
            },
          }),
        );

      return { stream, response: responsePromise };
    },
  };
}

function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content,
          },
        ],
      };
    }

    if (message.role === 'assistant' && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      const content: unknown[] = [];
      if (message.content.length > 0) {
        content.push({ type: 'text', text: message.content });
      }
      for (const toolCall of message.toolCalls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.args,
        });
      }
      return { role: 'assistant', content };
    }

    return { role: message.role, content: message.content };
  });
}

// ---------------------------------------------------------------------------
