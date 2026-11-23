import { ref } from 'vue';
import type { ClientMode, ViewMode } from '../types';

export function useViewMode() {
  const viewMode = ref<ViewMode>('settings');

  function toggleViewMode(clientMode: ClientMode): void {
    if (clientMode !== 'reference-ui' && viewMode.value === 'settings') {
      return;
    }

    viewMode.value = viewMode.value === 'settings' ? 'preview' : 'settings';
  }

  return { viewMode, toggleViewMode };
}
