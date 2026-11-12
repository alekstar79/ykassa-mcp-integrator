import {
  LLMAPIError,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatStreamResult,
  type FinishReason,
  type GeminiPart,
  type GeminiStreamChunk,
  type GoogleConfig,
  type LLMProvider,
  type SSEEvent,
} from '../types.js';
import { readErrorBody, SSEParserStream, tryParseJSON } from '../sse-parser.js';

// Google Gemini provider
// ---------------------------------------------------------------------------
export function createGoogle(config: GoogleConfig): LLMProvider {
  return {
    id: 'google',

    async chat(request: ChatRequest): Promise<ChatStreamResult> {
      const baseURL = config.baseURL ?? 'https://generativelanguage.googleapis.com/v1beta';
      const url = `${baseURL}/models/${request.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

      const body: Record<string, unknown> = {
        contents: toGeminiContents(request.messages),
      };

      const systemMessage = request.messages.find((message) => message.role === 'system');
      if (systemMessage !== undefined && typeof systemMessage.content === 'string') {
        body.systemInstruction = { parts: [{ text: systemMessage.content }] };
      }

      if (request.tools && request.tools.length > 0) {
        body.tools = [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ];
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
          message: `Google API responded with ${httpResponse.status}: ${errorBody}`,
          status: httpResponse.status,
          provider: 'google',
          body: errorBody,
        });
      }

      if (httpResponse.body === null) {
        throw new Error('Google response has no body');
      }

      let resolveResponse!: (value: ChatResponse) => void;
      const responsePromise = new Promise<ChatResponse>((resolve) => {
        resolveResponse = resolve;
      });

      let toolCallCounter = 0;
      let sawFunctionCall = false;

      const stream = httpResponse.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new SSEParserStream())
        .pipeThrough(
          new TransformStream<SSEEvent, ChatStreamChunk>({
            transform(
              sseEvent: SSEEvent,
              controller: TransformStreamDefaultController<ChatStreamChunk>,
            ): void {
              const parsed = tryParseJSON(sseEvent.data) as GeminiStreamChunk | undefined;
              if (parsed === undefined) {
                return;
              }

              const candidate = parsed.candidates?.[0];
              if (candidate === undefined) {
                return;
              }

              const parts = candidate.content?.parts;
              if (parts !== undefined) {
                for (const part of parts) {
                  if (typeof part.text === 'string') {
                    controller.enqueue({ type: 'text-delta', text: part.text });
                  }
                  if (part.functionCall !== undefined) {
                    toolCallCounter += 1;
                    const toolCallId = `gemini-tool-call-${toolCallCounter}`;
                    sawFunctionCall = true;
                    controller.enqueue({
                      type: 'tool-call-start',
                      toolCallId,
                      toolName: part.functionCall.name,
                    });
                    controller.enqueue({
                      type: 'tool-call-delta',
                      toolCallId,
                      args: JSON.stringify(part.functionCall.args ?? {}),
                    });
                    controller.enqueue({ type: 'tool-call-end', toolCallId });
                  }
                }
              }

              if (candidate.finishReason !== undefined) {
                let reason: FinishReason = 'stop';
                if (sawFunctionCall) {
                  reason = 'tool-calls';
                } else if (candidate.finishReason === 'MAX_TOKENS') {
                  reason = 'length';
                }

                const usage = parsed.usageMetadata;
                controller.enqueue({ type: 'finish', finishReason: reason });
                resolveResponse({
                  finishReason: reason,
                  usage:
                    usage !== undefined
                      ? {
                          promptTokens: usage.promptTokenCount ?? 0,
                          completionTokens: usage.candidatesTokenCount ?? 0,
                          totalTokens: usage.totalTokenCount ?? 0,
                        }
                      : undefined,
                });
              }
            },
          }),
        );

      return { stream, response: responsePromise };
    },
  };
}

function toGeminiContents(messages: ChatMessage[]): unknown[] {
  const contents: unknown[] = [];
  const toolNames = new Map<string, string>();

  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }

    if (message.role === 'tool') {
      const toolName = toolNames.get(message.toolCallId ?? '') ?? message.toolCallId ?? '';
      const parsedContent = tryParseJSON(message.content);
      const part = {
        functionResponse: {
          name: toolName,
          response: { result: parsedContent ?? message.content },
        },
      };

      const lastEntry = contents[contents.length - 1] as
        | { role: string; parts: unknown[] }
        | undefined;
      if (lastEntry !== undefined && lastEntry.role === 'user') {
        lastEntry.parts.push(part);
      } else {
        contents.push({ role: 'user', parts: [part] });
      }
      continue;
    }

    for (const toolCall of message.toolCalls ?? []) {
      toolNames.set(toolCall.id, toolCall.name);
    }

    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts: unknown[] = [];

    if (message.content.length > 0) {
      parts.push({ text: message.content });
    }

    for (const toolCall of message.toolCalls ?? []) {
      parts.push({
        functionCall: {
          name: toolCall.name,
          args: typeof toolCall.args === 'string' ? tryParseJSON(toolCall.args) ?? {} : toolCall.args,
        },
      });
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return contents;
}

// ---------------------------------------------------------------------------
