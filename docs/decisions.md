# Architecture decisions

This log records retired options so future changes do not accidentally restore them.

## Client brand fields

- **What was:** Per-client placeholder customization.
  **Why removed:** client-specific prompt text made the request placeholder inconsistent.
  **Replacement:** localized `requestPlaceholder` copy from `apps/web/src/i18n.ts`.
- **What was:** A client brand-personality label.
  **Why removed:** the UI did not consume it and it duplicated presentation intent.
  **Replacement:** product copy is controlled by i18n; appearance is configured through `ui`.
- **What was:** A separate client-specific color property.
  **Why removed:** it duplicated the existing UI theme configuration.
  **Replacement:** `ui.accent` selects the supported accent palette.

## Configurator defaults

- **What was:** A separate payment-defaults section in the Configurator.
  **Why removed:** runtime payment preferences belong in the Reference UI settings, not the client-generation form.
  **Replacement:** the Configurator writes `DEFAULTS_BLOCK_FALLBACK`; the Reference UI stores operator overrides locally and sends them with requests.

## YooKassa VAT codes

- **What was:** contracts, API overrides, and Reference UI settings accepted only VAT codes 1–6.
  **Why changed:** YooKassa's official VAT reference lists codes 1–12. Its changelog says codes 7 and 8 represent 5% and 7% (January 28, 2025), and codes 11 and 12 represent 22% and 22/122 effective January 1, 2026.
  **Replacement:** `CLIENT_VAT_CODES` is the shared source for contract validation, API overrides, browser-stored settings, and the localized Reference UI selector. Code 11 (22%) is the standard rate from 2026; codes 4 and 6 (20% and 20/120) are retained only for transactions where those rates apply. Code labels follow the official table; 5% and 7% are not labeled as USN-only in the UI.

The official reference is [YooKassa's VAT code table](https://yookassa.ru/developers/payment-acceptance/receipts/54fz/yoomoney/parameters-values?lang=ru) and [API changelog](https://yookassa.ru/developers/using-api/changelog). SDKs are not used as the source of truth for this list: the current PHP `ReceiptItem` model still documents and validates only 1–6, while the Python model accepts `vat_code` as an integer without enumerating the supported codes.
