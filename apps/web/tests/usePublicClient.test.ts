import { createApp, defineComponent, h, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, defaultClientName } from '../src/environment.js';
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

describe('usePublicClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('loads the selected client configuration', async () => {
    window.history.replaceState({}, '', '/?client=test-school');
    fetchMock.mockResolvedValue(
      jsonResponse({
        brand: { display_name: 'Test School' },
        allowed_scenarios: ['create_payment'],
        approval_threshold: 1000,
      }),
    );

    const { app, state } = await mountClient();
    try {
      expect(state.clientName.value).toBe('test-school');
      expect(state.publicClient.value?.brand.display_name).toBe('Test School');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/clients/test-school/public',
      );
    } finally {
      app.unmount();
    }
  });

  it('reports a missing client on HTTP 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not found' }, 404));
    const locale = ref<'ru' | 'en'>('ru');

    const { app, state } = await mountClient(locale);
    try {
      expect(state.publicClient.value).toBeNull();
      expect(state.clientError.value).toBe('Не удалось загрузить настройки клиента.');
      locale.value = 'en';
      expect(state.clientError.value).toBe('Could not load client settings.');
      expect(state.isClientLoading.value).toBe(false);
    } finally {
      app.unmount();
    }
  });

  it('localizes a missing-client error in English', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not found' }, 404));

    const { app, state } = await mountClient(ref('en'));
    try {
      expect(state.clientError.value).toBe('Could not load client settings.');
    } finally {
      app.unmount();
    }
  });

  it('uses the configured default client when the query parameter is blank', async () => {
    window.history.replaceState({}, '', '/?client=%20%20');
    fetchMock.mockResolvedValue(
      jsonResponse({
        brand: { display_name: 'Light School' },
        allowed_scenarios: ['create_payment'],
        approval_threshold: 1000,
      }),
    );

    const { app, state } = await mountClient();
    try {
      const selectedClient = defaultClientName || 'online-school';
      expect(state.clientName.value).toBe(selectedClient);
      expect(state.publicClient.value?.brand.display_name).toBe('Light School');
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_URL}/api/clients/${encodeURIComponent(selectedClient)}/public`,
      );
    } finally {
      app.unmount();
    }
  });

});
