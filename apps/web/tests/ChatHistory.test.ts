import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatHistory from '../src/components/ChatHistory.vue';
import { translations } from '../src/i18n';
import type { ChatTurn } from '../src/types';

const mountedApps: Array<{ unmount: () => void }> = [];
const mountedContainers: HTMLElement[] = [];

function renderChatHistory(): HTMLElement {
  const turns: ChatTurn[] = [
    {
      id: 'turn-1',
      createdAt: '2026-03-19T10:00:00.000Z',
      request: 'Первый запрос',
      reply: '',
      warning: '',
      toolCalls: [],
    },
    {
      id: 'turn-2',
      createdAt: '2026-03-19T10:01:00.000Z',
      request: 'Второй запрос',
      reply: '',
      warning: '',
      toolCalls: [],
    },
    {
      id: 'turn-3',
      createdAt: '2026-03-19T10:02:00.000Z',
      request: 'Третий запрос',
      reply: '',
      warning: '',
      toolCalls: [],
    },
  ];
  const activeTurnId = ref('turn-1');
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(ChatHistory, {
            turns,
            loading: true,
            loadFailed: false,
            loadErrorDetail: '',
            activeTurnId: activeTurnId.value,
            pendingApproval: null,
            busy: false,
            messages: translations.ru,
            onSelectTurn: (turnId: string) => {
              activeTurnId.value = turnId;
            },
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ChatHistory scroll navigation', () => {
  it('updates the active request from the visible position and at the list end', async () => {
    const container = renderChatHistory();
    const scrollRegion =
      container.querySelector<HTMLElement>('.chat-history-scroll');
    const articles = container.querySelectorAll<HTMLElement>('.chat-turn');

    expect(scrollRegion).not.toBeNull();
    expect(articles).toHaveLength(3);
    if (!scrollRegion) return;

    Object.defineProperties(scrollRegion, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    });
    vi.spyOn(scrollRegion, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 320, 400),
    );

    const tops = [-200, 10, 500];
    articles.forEach((article, index) => {
      vi.spyOn(article, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(0, tops[index] ?? 0, 320, 100),
      );
    });

    scrollRegion.scrollTop = 450;
    scrollRegion.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(
      container
        .querySelector('.chat-history-dot[aria-current="location"]')
        ?.getAttribute('aria-label'),
    ).toContain('Второй запрос');

    tops.splice(0, tops.length, -500, -200, 300);
    scrollRegion.scrollTop = 800;
    scrollRegion.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(
      container
        .querySelector('.chat-history-dot[aria-current="location"]')
        ?.getAttribute('aria-label'),
    ).toContain('Третий запрос');
  });

  it('uses a touch-sized scrollbar thumb and keeps its position synchronized', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
    }));

    const container = renderChatHistory();
    const scrollRegion =
      container.querySelector<HTMLElement>('.chat-history-scroll');
    expect(scrollRegion).not.toBeNull();
    if (!scrollRegion) return;

    Object.defineProperties(scrollRegion, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 10000 },
    });
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    const thumb = container.querySelector<HTMLElement>(
      '.chat-history-scrollbar-thumb',
    );
    expect(thumb?.style.height).toBe('44px');

    scrollRegion.scrollTop = 5000;
    scrollRegion.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(thumb?.getAttribute('aria-valuenow')).toBe('5000');
  });
});
