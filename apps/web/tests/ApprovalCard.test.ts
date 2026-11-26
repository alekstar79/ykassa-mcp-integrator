import { createApp, defineComponent, h } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import ApprovalCard from '../src/components/ApprovalCard.vue';
import { translations } from '../src/i18n';

const mountedApps: Array<{ unmount: () => void }> = [];

function renderApproval(): HTMLElement {
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(ApprovalCard, {
            approval: {
              approvalId: 'approval-1',
              actions: [
                {
                  tool: 'create_payment',
                  args: {
                    amount: { value: '1500.00', currency: 'RUB' },
                    description: 'Курс английского',
                  },
                  requires_confirmation: true,
                },
              ],
            },
            busy: false,
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

describe('ApprovalCard', () => {
  it('shows human-readable operation details without tool names or raw JSON', () => {
    const container = renderApproval();

    expect(container.textContent).toContain('Создание платёжной ссылки');
    expect(container.textContent).toContain('500,00 ₽');
    expect(container.textContent).toContain('Курс английского');
    expect(container.textContent).toContain('Одобрить всё');
    expect(container.textContent).not.toContain('create_payment');
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
  });
});
