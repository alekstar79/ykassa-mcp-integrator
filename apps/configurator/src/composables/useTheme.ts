import { ref, watch } from 'vue';
import type { Theme } from '../types';

const THEME_STORAGE_KEY = 'ykassa-configurator-theme';

export function useTheme() {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const theme = ref<Theme>(storedTheme === 'dark' ? 'dark' : 'light');

  watch(
    theme,
    (nextTheme) => {
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    },
    { immediate: true },
  );

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  return { theme, toggleTheme };
}
