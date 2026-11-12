/**
 * LLM provider layer.
 */

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type FinishReason = 'stop' | 'tool-calls' | 'length' | 'error';

export type ChatStreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string }
  | { type: 'tool-call-delta'; toolCallId: string; args: string }
  | { type: 'tool-call-end'; toolCallId: string }
  | { type: 'finish'; finishReason: FinishReason }
  | { type: 'error'; error: Error };

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  finishReason: FinishReason;
  usage?: ChatUsage;
}

export interface ChatStreamResult {
  stream: ReadableStream<ChatStreamChunk>;
  response: Promise<ChatResponse>;
}

export interface LLMProvider {
  readonly id: string;
  chat(request: ChatRequest): Promise<ChatStreamResult>;
}

export class LLMAPIError extends Error {
  readonly status: number;
  readonly provider: string;
  readonly body: string;

  constructor(options: { message: string; status: number; provider: string; body: string }) {
    super(options.message);
    this.name = 'LLMAPIError';
    this.status = options.status;
    this.provider = options.provider;
    this.body = options.body;
  }
}

// ---------------------------------------------------------------------------

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
}

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
}

export interface GoogleConfig {
  apiKey: string;
  baseURL?: string;
}

export interface OllamaConfig {
  baseURL?: string;
}

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ProviderConfig {
  provider: LLMProvider;
  model: string;
}

export interface SSEEvent {
  event?: string;
  data: string;
}

export interface OpenAIDelta {
  content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

export interface OpenAIChunk {
  choices?: Array<{
    delta: OpenAIDelta;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AnthropicEvent {
  type: string;
  index?: number;
  content_block?: { type: string; id?: string; name?: string };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: { output_tokens?: number };
  error?: { message?: string };
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

export interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface OllamaChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done?: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
}

export interface OllamaStreamState {
  sawToolCall: boolean;
  responseResolved: boolean;
  resolveOnce: (value: ChatResponse) => void;
}
