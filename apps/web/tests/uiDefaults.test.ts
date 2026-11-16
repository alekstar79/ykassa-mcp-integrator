import { afterEach, describe, expect, it } from 'vitest';
import {
  readUiDefaults,
  readUiOverrides,
  saveUiDefaults,
  UI_DEFAULTS_STORAGE_KEY,
} from '../src/composables/uiDefaults.js';

afterEach(() => {
  window.localStorage.clear();
});

describe('UI defaults storage', () => {
  it('returns no API overrides before the user saves settings', () => {
    expect(readUiOverrides()).toBeUndefined();
    expect(readUiDefaults()).toEqual({
      currency: 'RUB',
      vat_code: 1,
      capture: true,
      return_url: '',
      invoice_expiry_days: 30,
    });
  });

  it('loads saved values for the settings form and API request', () => {
    saveUiDefaults({
      currency: 'USD',
      vat_code: 12,
      capture: false,
      return_url: 'https://example.test/return',
      invoice_expiry_days: 12,
    });

    expect(window.localStorage.getItem(UI_DEFAULTS_STORAGE_KEY)).not.toBeNull();
    expect(readUiDefaults()).toEqual({
      currency: 'USD',
      vat_code: 12,
      capture: false,
      return_url: 'https://example.test/return',
      invoice_expiry_days: 12,
    });
    expect(readUiOverrides()).toEqual({
      currency: 'USD',
      vat_code: 12,
      capture: false,
      return_url: 'https://example.test/return',
      invoice_expiry_days: 12,
    });
  });

  it('ignores malformed stored JSON', () => {
    window.localStorage.setItem(UI_DEFAULTS_STORAGE_KEY, '{not-json');

    expect(readUiOverrides()).toBeUndefined();
  });

  it('ignores unsupported stored VAT codes', () => {
    window.localStorage.setItem(
      UI_DEFAULTS_STORAGE_KEY,
      JSON.stringify({ currency: 'USD', vat_code: 13 }),
    );

    expect(readUiOverrides()).toEqual({ currency: 'USD' });
  });
});
