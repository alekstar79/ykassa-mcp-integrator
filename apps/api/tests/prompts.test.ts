import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../src/prompts.js';
import type { ClientConfig } from '../src/config.js';

describe('buildSystemPrompt', () => {
  it('uses the client display name and includes payment and attachment rules', () => {
    const config: ClientConfig = {
      allowed_scenarios: ['create_payment'],
      approval_threshold: 4000,
      require_human_confirmation: true,
      brand: { display_name: 'Demo School' },
      ui: {
        mode: 'reference-ui',
        accent: 'navy',
        radius: 2,
        shadow: 'soft',
        font_pair: 'manrope+jetbrains',
        form_style: 'flat',
        h1_size: 'm',
      },
      limits: {
        max_messages: 20,
        max_attachment_kb: 100,
      },
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain('«Demo School»');
    expect(prompt).toContain('create_payment');
    expect(prompt).toContain('выше 4000 ₽');
    expect(prompt).toContain('недоверенные данные');
  });
});
