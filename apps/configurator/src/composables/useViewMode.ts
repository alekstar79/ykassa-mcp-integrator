import { ref } from 'vue';
import type { ClientUiConfig } from '@alekstar79/ykassa-contracts';
import type { ViewMode } from '../types';

export function useViewMode() {
  const viewMode = ref<ViewMode>('settings');

  function toggleViewMode(uiMode: ClientUiConfig['mode']): void {
    if (uiMode === 'custom-ui' && viewMode.value === 'settings') {
      return;
    }

    viewMode.value = viewMode.value === 'settings' ? 'preview' : 'settings';
  }

  return { viewMode, toggleViewMode };
}
