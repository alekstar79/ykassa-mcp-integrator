import { createAnthropic } from './providers/anthropic.js';
import { createGoogle } from './providers/google.js';
import { createOllama } from './providers/ollama.js';
import { createOpenAI } from './providers/openai.js';
import type { LLMProvider, ProviderConfig, ProviderName } from './types.js';

export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const providerName = (env.LLM_PROVIDER ?? 'openai').toLowerCase() as ProviderName;
  const model = env.LLM_MODEL;
  const apiKey = env.LLM_API_KEY;
  const baseURL = env.LLM_BASE_URL;

  if (providerName !== 'ollama' && (apiKey === undefined || apiKey === '')) {
    throw new Error(`LLM_API_KEY is required when LLM_PROVIDER=${providerName}`);
  }
  if (model === undefined || model === '') {
    throw new Error('LLM_MODEL is required (e.g. gpt-4o-mini, claude-3-5-sonnet, llama3)');
  }

  let provider: LLMProvider;
  switch (providerName) {
    case 'openai':
      provider = createOpenAI({ apiKey: apiKey!, baseURL });
      break;
    case 'anthropic':
      provider = createAnthropic({ apiKey: apiKey!, baseURL });
      break;
    case 'google':
      provider = createGoogle({ apiKey: apiKey!, baseURL });
      break;
    case 'ollama':
      provider = createOllama({ baseURL });
      break;
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${providerName}. Expected one of: openai, anthropic, google, ollama`);
  }

  return { provider, model };
}
