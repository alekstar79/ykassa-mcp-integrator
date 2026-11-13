import { computed, onMounted, ref } from 'vue';
import { API_URL, defaultClientName } from '../environment';
import { translate, type Locale } from '../i18n';
import type { PublicClientConfig } from '../types';
import type { Ref } from 'vue';

export function usePublicClient(locale: Ref<Locale> = ref('ru')) {
  const clientName = ref(
    new URLSearchParams(window.location.search).get('client')?.trim() ||
      defaultClientName ||
      'online-school',
  );
  const publicClient = ref<PublicClientConfig | null>(null);
  const hasClientError = ref(false);
  const clientError = computed(() =>
    hasClientError.value ? translate(locale.value, 'clientNotFound') : '',
  );
  const isClientLoading = ref(true);

  async function loadPublicClient(): Promise<void> {
    isClientLoading.value = true;
    hasClientError.value = false;
    publicClient.value = null;

    try {
      const response = await fetch(
        `${API_URL}/api/clients/${encodeURIComponent(clientName.value)}/public`,
      );
      if (!response.ok) {
        throw new Error('Client configuration request failed.');
      }
      publicClient.value = (await response.json()) as PublicClientConfig;
    } catch {
      hasClientError.value = true;
    } finally {
      isClientLoading.value = false;
    }
  }

  onMounted(loadPublicClient);

  return {
    clientName,
    publicClient,
    clientError,
    isClientLoading,
  };
}
