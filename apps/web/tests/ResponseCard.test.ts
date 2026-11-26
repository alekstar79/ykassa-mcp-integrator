import { createApp, defineComponent, h } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import ResponseCard from '../src/components/ResponseCard.vue';
import { translations } from '../src/i18n';

const mountedApps: Array<{ unmount: () => void }> = [];

function renderResponse(reply: string): HTMLElement {
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(ResponseCard, {
            reply,
            warning: '',
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

describe('ResponseCard Markdown rendering', () => {
  it('renders formatted text, lists, and readable links as HTML', () => {
    const container = renderResponse(
      '**Платёж подготовлен**\n\n' +
        '[Ссылка](https://example.com/path/?q=vgxgh&ref=1)\n\n' +
        '- **Сумма:** 400 RUB\n' +
        '- Статус: `pending`',
    );

    expect(container.querySelector('.response-content strong')?.textContent).toBe(
      'Платёж подготовлен',
    );
    expect(container.querySelector('.response-content ul li strong')?.textContent)
      .toBe('Сумма:');
    expect(container.querySelector('.response-content code')?.textContent).toBe(
      'pending',
    );
    expect(container.querySelector('.response-content a')?.getAttribute('href'))
      .toBe('https://example.com/path/?q=vgxgh&ref=1');
    expect(container.querySelector('.response-content a')?.getAttribute('target'))
      .toBe('_blank');
    expect(container.querySelector('.response-content a')?.getAttribute('rel'))
      .toBe('noopener noreferrer');
    expect(container.querySelector('.response-content')?.textContent).not.toContain(
      '**',
    );
  });

  it('keeps raw HTML inert and removes unsafe link protocols', () => {
    const container = renderResponse(
      '<img src=x onerror=alert(1)> [опасная](javascript:alert(1))',
    );
    const content = container.querySelector('.response-content');

    expect(content?.querySelector('img')).toBeNull();
    expect(content?.querySelector('[onerror]')).toBeNull();
    expect(content?.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(content?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
