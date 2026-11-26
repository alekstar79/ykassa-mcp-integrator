import { computed, onMounted, ref } from 'vue';
import { API_URL } from '../environment';
import { translate, type Locale, type MessageKey } from '../i18n';
import type { AvailableClient, PublicClientConfig } from '../types';
import type { Ref } from 'vue';

interface ClientListResponse {
  clients: AvailableClient[];
}

function isAvailableClient(value: unknown): value is AvailableClient {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'display_name' in value &&
    typeof value.display_name === 'string'
  );
}

function isClientListResponse(value: unknown): value is ClientListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'clients' in value &&
    Array.isArray(value.clients) &&
    value.clients.every(isAvailableClient)
  );
}

export function usePublicClient(locale: Ref<Locale> = ref('ru')) {
  const clientName = ref('');
  const availableClients = ref<AvailableClient[]>([]);
  const publicClient = ref<PublicClientConfig | null>(null);
  const clientErrorKey = ref<MessageKey | null>(null);
  const clientError = computed(() =>
    clientErrorKey.value
      ? translate(locale.value, clientErrorKey.value)
      : '',
  );
  const isClientLoading = ref(true);
  const requiresClientSelection = computed(
    () =>
      !isClientLoading.value &&
      !clientError.value &&
      !clientName.value &&
      availableClients.value.length > 1,
  );
  const noConfiguredClients = computed(
    () =>
      !isClientLoading.value &&
      !clientError.value &&
      !clientName.value &&
      availableClients.value.length === 0,
  );

  async function loadPublicClient(name: string): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/clients/${encodeURIComponent(name)}/public`,
    );
    if (!response.ok) {
      throw new Error('Client configuration request failed.');
    }
    publicClient.value = (await response.json()) as PublicClientConfig;
  }

  async function selectClient(name: string): Promise<void> {
    if (!availableClients.value.some((client) => client.name === name)) return;

    isClientLoading.value = true;
    clientErrorKey.value = null;
    clientName.value = name;
    publicClient.value = null;

    try {
      await loadPublicClient(name);
    } catch {
      clientErrorKey.value = 'clientConfigError';
    } finally {
      isClientLoading.value = false;
    }
  }

  async function loadClients(): Promise<void> {
    isClientLoading.value = true;
    clientErrorKey.value = null;
    clientName.value = '';
    publicClient.value = null;
    availableClients.value = [];

    try {
      const response = await fetch(`${API_URL}/api/clients`);
      if (!response.ok) {
        throw new Error('Client list request failed.');
      }
      const payload: unknown = await response.json();
      if (!isClientListResponse(payload)) {
        throw new Error('The API returned an invalid client list.');
      }
      availableClients.value = payload.clients;
      if (payload.clients.length === 1) {
        await selectClient(payload.clients[0].name);
      }
    } catch {
      clientErrorKey.value = 'clientListError';
    } finally {
      isClientLoading.value = false;
    }
  }

  async function retryClientLoad(): Promise<void> {
    if (clientName.value) {
      await selectClient(clientName.value);
      return;
    }
    await loadClients();
  }

  function backToClientSelection(): void {
    clientName.value = '';
    publicClient.value = null;
    clientErrorKey.value = null;
  }

  function removeLegacyClientQuery(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('client')) return;

    url.searchParams.delete('client');
    const search = url.searchParams.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
    );
  }

  onMounted(() => {
    removeLegacyClientQuery();
    void loadClients();
  });

  return {
    clientName,
    availableClients,
    publicClient,
    clientError,
    isClientLoading,
    requiresClientSelection,
    noConfiguredClients,
    selectClient,
    retryClientLoad,
    backToClientSelection,
  };
}
