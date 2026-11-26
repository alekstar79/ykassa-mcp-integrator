import { createApp, defineComponent, h, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../src/environment.js';
import { usePublicClient } from '../src/composables/usePublicClient.js';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function mountClient(locale = ref<'ru' | 'en'>('ru')) {
  let state!: ReturnType<typeof usePublicClient>;
  const app = createApp(
    defineComponent({
      setup() {
        state = usePublicClient(locale);
        return () => h('div');
      },
    }),
  );
  app.mount(document.createElement('div'));
  await vi.waitFor(() => expect(state.isClientLoading.value).toBe(false));
  return { app, state };
}

const publicConfig = {
  brand: { display_name: 'Test School' },
  allowed_scenarios: ['create_payment'],
  approval_threshold: 1000,
};

describe('usePublicClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('automatically selects the only configured client without URL parameters', async () => {
    window.history.replaceState({}, '', '/?client=ignored-client');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          clients: [{ name: 'test-school', display_name: 'Test School' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(publicConfig));

    const { app, state } = await mountClient();
    try {
      expect(state.clientName.value).toBe('test-school');
      expect(state.publicClient.value?.brand.display_name).toBe('Test School');
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        `${API_URL}/api/clients`,
        `${API_URL}/api/clients/test-school/public`,
      ]);
      expect(window.location.search).toBe('');
    } finally {
      app.unmount();
    }
  });

  it('waits for explicit selection when several clients are configured', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          clients: [
            { name: 'delivery-service', display_name: 'Delivery Service' },
            { name: 'test-school', display_name: 'Test School' },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(publicConfig));

    const { app, state } = await mountClient();
    try {
      expect(state.requiresClientSelection.value).toBe(true);
      expect(state.clientName.value).toBe('');
      expect(state.publicClient.value).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await state.selectClient('delivery-service');

      expect(state.clientName.value).toBe('delivery-service');
      expect(state.publicClient.value?.brand.display_name).toBe('Test School');
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${API_URL}/api/clients/delivery-service/public`,
      );
      expect(window.location.search).toBe('');
    } finally {
      app.unmount();
    }
  });

  it('shows an empty state when no configured clients are available', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ clients: [] }));

    const { app, state } = await mountClient();
    try {
      expect(state.noConfiguredClients.value).toBe(true);
      expect(state.clientName.value).toBe('');
      expect(state.publicClient.value).toBeNull();
    } finally {
      app.unmount();
    }
  });

  it('reports and localizes client-list failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503));
    const locale = ref<'ru' | 'en'>('ru');

    const { app, state } = await mountClient(locale);
    try {
      expect(state.clientError.value).toBe(
        'Не удалось загрузить список магазинов и сервисов.',
      );
      locale.value = 'en';
      expect(state.clientError.value).toBe(
        'Could not load the list of shops and services.',
      );
      expect(state.isClientLoading.value).toBe(false);
    } finally {
      app.unmount();
    }
  });

  it('rejects malformed client-list responses', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ clients: [{ name: 'bad-client', display_name: 42 }] }),
    );

    const { app, state } = await mountClient();
    try {
      expect(state.clientError.value).toBe(
        'Не удалось загрузить список магазинов и сервисов.',
      );
      expect(state.availableClients.value).toEqual([]);
    } finally {
      app.unmount();
    }
  });
});
