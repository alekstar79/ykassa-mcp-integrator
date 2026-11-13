import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { useTheme } from '../src/composables/useTheme.js';
import { useSecretVisibility } from '../src/composables/useSecretVisibility.js';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('useTheme', () => {
  it('loads the stored dark theme and applies it to the document', () => {
    window.localStorage.setItem('ykassa-configurator-theme', 'dark');

    const { theme } = useTheme();

    expect(theme.value).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggles theme and persists the new value', async () => {
    const { theme, toggleTheme } = useTheme();

    expect(theme.value).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    toggleTheme();
    await nextTick();

    expect(theme.value).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(
      window.localStorage.getItem('ykassa-configurator-theme'),
    ).toBe('dark');
  });
});

describe('useSecretVisibility', () => {
  it('toggles MCP token visibility in both directions', () => {
    const { showMcpToken, toggleMcpToken } = useSecretVisibility();

    expect(showMcpToken.value).toBe(false);
    toggleMcpToken();
    expect(showMcpToken.value).toBe(true);
    toggleMcpToken();
    expect(showMcpToken.value).toBe(false);
  });
});
