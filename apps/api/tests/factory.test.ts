import { describe, expect, it } from 'vitest';
import { createProviderFromEnv } from '../src/factory.js';

describe('createProviderFromEnv', () => {
  it.each([
    ['openai', 'openai'],
    ['ANTHROPIC', 'anthropic'],
    ['google', 'google'],
    ['ollama', 'ollama'],
  ])('selects the %s provider', (providerName, expectedId) => {
    const config = createProviderFromEnv({
      LLM_PROVIDER: providerName,
      LLM_API_KEY: providerName === 'ollama' ? undefined : 'test-key',
      LLM_MODEL: 'test-model',
    });

    expect(config.provider.id).toBe(expectedId);
    expect(config.model).toBe('test-model');
  });

  it('uses OpenAI by default and requires a model', () => {
    expect(() =>
      createProviderFromEnv({ LLM_API_KEY: 'test-key' }),
    ).toThrow('LLM_MODEL is required');

    expect(() => createProviderFromEnv({ LLM_MODEL: 'test-model' })).toThrow(
      'LLM_API_KEY is required when LLM_PROVIDER=openai',
    );

    expect(
      createProviderFromEnv({
        LLM_API_KEY: 'test-key',
        LLM_MODEL: 'test-model',
      }).provider.id,
    ).toBe('openai');
  });

  it('does not require a key for Ollama and accepts a custom base URL', () => {
    const config = createProviderFromEnv({
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'local-model',
      LLM_BASE_URL: 'http://127.0.0.1:11434',
    });

    expect(config.provider.id).toBe('ollama');
    expect(() =>
      createProviderFromEnv({
        LLM_PROVIDER: 'ollama',
        LLM_API_KEY: '',
      }),
    ).toThrow('LLM_MODEL is required');
  });

  it('rejects unknown provider names', () => {
    expect(() =>
      createProviderFromEnv({
        LLM_PROVIDER: 'unknown',
        LLM_API_KEY: 'test-key',
        LLM_MODEL: 'test-model',
      }),
    ).toThrow('Unknown LLM_PROVIDER: unknown');
  });
});
