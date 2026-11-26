import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import ChatHistoryNav from '../src/components/ChatHistoryNav.vue';
import { translations } from '../src/i18n';
import type { ChatTurn } from '../src/types';

const mountedApps: Array<{ unmount: () => void }> = [];
const mountedContainers: HTMLElement[] = [];

function renderNavigation(onSelect: (turnId: string) => void): HTMLElement {
  const turns: ChatTurn[] = [
    {
      id: 'turn-1',
      createdAt: '2026-03-19T10:00:00.000Z',
      request: 'Первый запрос',
      reply: 'Ответ',
      warning: '',
      toolCalls: [],
    },
    {
      id: 'turn-2',
      createdAt: '2026-03-19T10:01:00.000Z',
      request: 'а'.repeat(60),
      reply: 'Ответ',
      warning: '',
      toolCalls: [],
    },
  ];
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(ChatHistoryNav, {
            turns,
            activeTurnId: 'turn-1',
            messages: translations.ru,
            onSelect,
          });
      },
    }),
  );
  app.mount(container);
  mountedApps.push(app);
  mountedContainers.push(container);
  return container;
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  for (const container of mountedContainers.splice(0)) container.remove();
});

describe('ChatHistoryNav', () => {
  it('truncates prompt labels and selects a turn from the dot or request list', () => {
    const selected: string[] = [];
    const container = renderNavigation((turnId) => selected.push(turnId));
    const labels = container.querySelectorAll(
      '.chat-history-popover button',
    );
    const dots = container.querySelectorAll('.chat-history-dot');

    expect(labels[1]?.textContent?.trim()).toBe(`${'а'.repeat(48)}…`);
    dots[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    labels[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selected).toEqual(['turn-2', 'turn-1']);
  });

  it('opens the request list on touch and closes it after selecting a request', async () => {
    const selected: string[] = [];
    const container = renderNavigation((turnId) => selected.push(turnId));
    const nav = container.querySelector('.chat-history-nav');
    const dot = container.querySelectorAll<HTMLButtonElement>(
      '.chat-history-dot',
    )[1];
    const request = container.querySelector<HTMLButtonElement>(
      '.chat-history-popover button',
    );
    if (!nav || !dot || !request) throw new Error('Navigation is incomplete');

    const touchPointerUp = new Event('pointerup', { bubbles: true });
    Object.defineProperty(touchPointerUp, 'pointerType', { value: 'touch' });
    dot.dispatchEvent(touchPointerUp);
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(nav.classList).toContain('is-open');
    expect(selected).toEqual(['turn-2']);

    request.focus();
    request.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(nav.classList).not.toContain('is-open');
    expect(selected).toEqual(['turn-2', 'turn-1']);
  });

  it('closes the request list on Escape and on outside pointer interaction', async () => {
    const container = renderNavigation(() => undefined);
    const nav = container.querySelector('.chat-history-nav');
    const dot = container.querySelector<HTMLButtonElement>('.chat-history-dot');
    if (!nav || !dot) throw new Error('Navigation is incomplete');

    const touchPointerUp = new Event('pointerup', { bubbles: true });
    Object.defineProperty(touchPointerUp, 'pointerType', { value: 'touch' });
    dot.dispatchEvent(touchPointerUp);
    dot.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await nextTick();
    expect(nav.classList).not.toContain('is-open');

    dot.dispatchEvent(touchPointerUp);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();
    expect(nav.classList).not.toContain('is-open');
  });

  it('opens on mouse hover and closes when the pointer leaves', async () => {
    const container = renderNavigation(() => undefined);
    const nav = container.querySelector('.chat-history-nav');
    if (!nav) throw new Error('Navigation is incomplete');

    const pointerEnter = new Event('pointerenter', { bubbles: true });
    Object.defineProperty(pointerEnter, 'pointerType', { value: 'mouse' });
    nav.dispatchEvent(pointerEnter);
    await nextTick();
    expect(nav.classList).toContain('is-open');

    const pointerLeave = new Event('pointerleave', { bubbles: true });
    Object.defineProperty(pointerLeave, 'pointerType', { value: 'mouse' });
    nav.dispatchEvent(pointerLeave);
    await nextTick();
    expect(nav.classList).not.toContain('is-open');
  });
});
