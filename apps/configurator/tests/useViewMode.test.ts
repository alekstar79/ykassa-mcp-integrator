import { describe, expect, it } from 'vitest';
import { useViewMode } from '../src/composables/useViewMode.js';

describe('useViewMode', () => {
  it('toggles between settings and preview for the reference UI', () => {
    const { viewMode, toggleViewMode } = useViewMode();

    expect(viewMode.value).toBe('settings');
    toggleViewMode('reference-ui');
    expect(viewMode.value).toBe('preview');
    toggleViewMode('reference-ui');
    expect(viewMode.value).toBe('settings');
  });

  it('blocks entry to preview for custom UI but allows returning to settings', () => {
    const { viewMode, toggleViewMode } = useViewMode();

    toggleViewMode('custom-ui');
    expect(viewMode.value).toBe('settings');

    toggleViewMode('reference-ui');
    toggleViewMode('custom-ui');
    expect(viewMode.value).toBe('settings');
  });
});
