import { DEFAULTS_BLOCK_FALLBACK } from '@alekstar79/ykassa-contracts/defaults';
import {
  isClientVatCode,
  type ClientDefaults,
} from '@alekstar79/ykassa-contracts';
import type { UiDefaults } from '../types.js';

export const UI_DEFAULTS_STORAGE_KEY = 'ykassa_ui_defaults';

const INITIAL_UI_DEFAULTS: UiDefaults = {
  ...DEFAULTS_BLOCK_FALLBACK,
  return_url: '',
};

export function readUiDefaults(): UiDefaults {
  const stored = readStoredDefaults();
  return stored ? { ...INITIAL_UI_DEFAULTS, ...stored } : { ...INITIAL_UI_DEFAULTS };
}

export function readUiOverrides(): Partial<ClientDefaults> | undefined {
  return readStoredDefaults();
}

export function saveUiDefaults(value: UiDefaults): void {
  window.localStorage.setItem(UI_DEFAULTS_STORAGE_KEY, JSON.stringify(value));
}

function readStoredDefaults(): Partial<UiDefaults> | undefined {
  const serialized = window.localStorage.getItem(UI_DEFAULTS_STORAGE_KEY);
  if (serialized === null) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  const defaults: Partial<UiDefaults> = {};
  if (value.currency === 'RUB' || value.currency === 'USD' || value.currency === 'EUR') {
    defaults.currency = value.currency;
  }
  if (isClientVatCode(value.vat_code)) {
    defaults.vat_code = value.vat_code;
  }
  if (typeof value.capture === 'boolean') defaults.capture = value.capture;
  if (typeof value.return_url === 'string') {
    defaults.return_url = value.return_url;
  }
  if (
    typeof value.invoice_expiry_days === 'number' &&
    Number.isInteger(value.invoice_expiry_days) &&
    value.invoice_expiry_days >= 1 &&
    value.invoice_expiry_days <= 30
  ) {
    defaults.invoice_expiry_days = value.invoice_expiry_days;
  }
  return Object.keys(defaults).length > 0 ? defaults : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
