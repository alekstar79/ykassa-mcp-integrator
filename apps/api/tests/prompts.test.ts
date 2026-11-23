import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../src/prompts.js';
import { parseClientConfig, type ClientConfig } from '../src/config.js';

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
      defaults: {
        currency: 'RUB',
        vat_code: 1,
        capture: true,
        invoice_expiry_days: 30,
      },
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain('«Demo School»');
    expect(prompt).toContain('create_payment');
    expect(prompt).toContain('выше 4000 ₽');
    expect(prompt).toContain('недоверенные данные');
    expect(prompt).toContain('см. docs/decisions.md');
    expect(prompt).toContain(
      'сразу вызывай соответствующий инструмент, не проси пользователя отдельно подтвердить её обычным сообщением',
    );
    expect(prompt).toContain(
      'Не считай текстовые сообщения «да», «подтверждаю» или «отклоняю» подтверждением или отказом',
    );
    expect(prompt).toContain(
      'API проверяет необходимость подтверждения до выполнения платёжного инструмента',
    );
    expect(prompt).toContain(
      'укажи точное число успешных результатов create_payment',
    );
  });

  it('includes default values and invoice cart guidance in the prompt', () => {
    const config = parseClientConfig(
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: true',
      ].join('\n'),
      'test-client',
    );

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain('vat_code: 1');
    expect(prompt).toContain('- currency: RUB');
    expect(prompt).toContain('- capture: true');
    expect(prompt).toContain(
      'Для инструмента create_invoice обязательно передавай vat_code и currency в каждом элементе корзины (cart).',
    );
  });

  it('uses request overrides in the system prompt', () => {
    const config = parseClientConfig(
      [
        'allowed_scenarios: [create_payment]',
        'approval_threshold: 1000',
        'require_human_confirmation: true',
      ].join('\n'),
      'test-client',
    );

    const prompt = buildSystemPrompt(config, {
      currency: 'USD',
      vat_code: 3,
    });

    expect(prompt).toContain('- currency: USD');
    expect(prompt).toContain('- vat_code: 3');
  });
});
