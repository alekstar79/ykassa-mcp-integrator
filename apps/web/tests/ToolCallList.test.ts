import { createApp, defineComponent, h } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import ToolCallList from '../src/components/ToolCallList.vue';
import { translations } from '../src/i18n';
import type { ToolCall } from '../src/types';

const mountedApps: Array<{ unmount: () => void }> = [];

function renderToolCalls(calls: ToolCall[]): HTMLElement {
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(ToolCallList, {
            calls,
            messages: translations.ru,
          });
      },
    }),
  );
  app.mount(container);
  mountedApps.push(app);
  return container;
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe('ToolCallList', () => {
  it('shows only a safe payment link and hides internal names and JSON', () => {
    const container = renderToolCalls([
      {
        id: 'call-1',
        name: 'create_payment',
        args: {
          amount: { value: '100.00', currency: 'RUB' },
          secret: 'private-value',
        },
        result: JSON.stringify({
          id: 'payment-1',
          confirmation_url:
            'https://yoomoney.ru/checkout/payments/v2/contract?orderId=payment-1',
        }),
      },
    ]);

    expect(container.textContent).toContain('Платёжная ссылка готова.');
    expect(container.textContent).toContain('Перейти к оплате');
    expect(container.textContent).not.toContain('create_payment');
    expect(container.textContent).not.toContain('private-value');
    expect(container.textContent).not.toContain('payment-1');
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://yoomoney.ru/checkout/payments/v2/contract?orderId=payment-1',
    );
    expect(container.querySelector('a')?.getAttribute('rel')).toBe(
      'noopener noreferrer',
    );
  });

  it('does not render a link or internal details from an unsafe result', () => {
    const container = renderToolCalls([
      {
        id: 'call-2',
        name: 'create_payment',
        args: { amount: { value: '100.00', currency: 'RUB' } },
        result: JSON.stringify({
          confirmation_url: 'https://attacker.example/checkout',
        }),
      },
    ]);

    expect(container.textContent).toBe('');
    expect(container.querySelector('a')).toBeNull();
  });
});
