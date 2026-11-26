import { describe, expect, it } from 'vitest';
import {
  chunkText,
  confirmationUrlFromResult,
  escapeHtml,
  renderApiError,
  renderApprovalCard,
  renderAskResponse,
} from '../src/render.js';

const CONFIRMATION_RESULT =
  '{"id":"328cced3-000f-5000-b000-1c3c6e443b7b","status":"pending","amount":{"value":"100.00","currency":"RUB"},"confirmation_url":"https://yoomoney.ru/checkout/payments/v2/contract?orderId=328cced3-000f-5000-b000-1c3c6e443b7b","description":"Счёт за тест","created_at":"2026-11-16T08:13:07.101Z"}';

describe('messenger rendering', () => {
  it('extracts confirmation_url from the operator-provided audit fixture', () => {
    expect(confirmationUrlFromResult(CONFIRMATION_RESULT)).toBe(
      'https://yoomoney.ru/checkout/payments/v2/contract?orderId=328cced3-000f-5000-b000-1c3c6e443b7b',
    );
  });

  it('falls back to escaped result text when parsing or URL validation fails', () => {
    const result = renderAskResponse(
      {
        reply: 'Payment result',
        requires_approval: false,
        tool_calls: [
          { name: 'create_payment', result: 'Payment <created> & ready' },
        ],
      },
      'telegram',
      'en',
    );

    expect(result.buttons).toEqual([]);
    expect(result.chunks.join('')).toContain(
      'Payment &lt;created&gt; &amp; ready',
    );
    expect(confirmationUrlFromResult('{"confirmation_url":"javascript:alert(1)"}'))
      .toBeUndefined();
  });

  it('adds a Pay URL button while preserving other result text', () => {
    const rendered = renderAskResponse(
      {
        reply: 'Payment is ready.',
        requires_approval: false,
        tool_calls: [
          { name: 'create_payment', result: CONFIRMATION_RESULT },
          { name: 'get_payment', result: 'Status: pending' },
        ],
      },
      'telegram',
      'ru',
    );

    expect(rendered.buttons).toEqual([
      {
        kind: 'url',
        label: 'Оплатить',
        url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=328cced3-000f-5000-b000-1c3c6e443b7b',
      },
    ]);
    expect(rendered.chunks.join('')).toContain('Status: pending');
  });

  it('chunks Telegram and MAX messages by their platform limits', () => {
    const telegramChunks = chunkText('x'.repeat(4097), 'telegram');
    const maxChunks = chunkText('y'.repeat(4001), 'max');

    expect(telegramChunks.map((chunk) => Array.from(chunk).length)).toEqual([
      4096,
      1,
    ]);
    expect(maxChunks.map((chunk) => Array.from(chunk).length)).toEqual([
      4000,
      1,
    ]);
    expect(chunkText('🙂'.repeat(4097), 'telegram')).toHaveLength(2);
  });

  it('escapes HTML and builds approval callback buttons from proposed actions', () => {
    const rendered = renderApprovalCard(
      {
        reply: 'Please confirm.',
        requires_approval: true,
        approval_id: 'approval-1',
        proposed_action: {
          tool: 'create_payment',
          args: { description: '<unsafe>' },
          requires_confirmation: true,
        },
        proposed_actions: [
          {
            tool: 'create_payment',
            args: { description: '<unsafe>' },
            requires_confirmation: true,
          },
        ],
        tool_calls: [],
      },
      'telegram',
      'en',
    );

    expect(escapeHtml(`<>&"'\n`)).toBe('&lt;&gt;&amp;&quot;&#39;\n');
    expect(rendered.chunks.join('')).toContain('&lt;unsafe&gt;');
    expect(rendered.buttons).toEqual([
      { kind: 'callback', label: 'Approve', data: 'apr:approval-1:y' },
      { kind: 'callback', label: 'Reject', data: 'apr:approval-1:n' },
    ]);
  });

  it('explains that an unstructured financial plan was not executed', () => {
    expect(renderApiError(502, 'ru', 'ask')).toContain(
      'операция не выполнялась',
    );
    expect(renderApiError(502, 'en', 'ask')).toContain(
      'no operation was executed',
    );
  });

  it('explains that an approval card could not be prepared', () => {
    expect(renderApiError(503, 'ru', 'ask')).toContain(
      'операция не выполнялась',
    );
    expect(renderApiError(503, 'en', 'ask')).toContain(
      'operation was not executed',
    );
  });
});
