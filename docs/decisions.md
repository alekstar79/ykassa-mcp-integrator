# Architecture decisions

**This log records decisions so future changes do not accidentally restore retired options or depart from accepted choices.**

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

## Messenger integration decisions

Accepted by the operator on 2026-11-23.

- **MSG-DEC-01: grammY for Telegram transport. Status: accepted.**
  **What was:** no Telegram transport had been selected.
  **Why chosen:** grammY supports the required polling, keyboard, and file workflows.
  **Replacement:** use grammY for Telegram transport; validate with strict compile and tests in Stage 2.
- **MSG-DEC-02: thin typed fetch client for MAX. Status: accepted.**
  **What was:** no MAX client implementation had been selected.
  **Why chosen:** a small typed client keeps requests explicit without adding an unapproved platform SDK.
  **Replacement:** implement a typed fetch client over official MAX endpoints.
- **MSG-DEC-03: MAX long polling for development/demo only. Status: accepted.**
  **What was:** no MAX update-delivery mode had been selected.
  **Why chosen:** official MAX documentation says long polling is not suitable for production.
  **Replacement:** use `GET /updates` for development and demos; production uses the official webhook path.
- **MSG-DEC-04: in-memory messenger session and approval correlation for MVP. Status: accepted.**
  **What was:** no messenger-side session or approval-correlation store had been selected.
  **Why chosen:** keep the MVP limited to transient gateway state.
  **Replacement:** store state in memory, document that it is lost on restart, and make no production-durability claim.
- **MSG-DEC-05: separate sender identity allowlist. Status: accepted.**
  **What was:** no sender authorization model had been selected.
  **Why chosen:** sender identity authorization is distinct from the API's `allowed_scenarios` tool policy.
  **Replacement:** use tenant-scoped sender IDs per platform and default-deny when the list is empty.
- **MSG-DEC-06: Stage-Gate override for messenger integration. Status: accepted.**
  **What was:** the project skill permits reversible assumptions and says not to stop for non-blocking questions in Section 12.
  **Why changed:** the operator requires approval between feature stages.
  **Replacement:** execute only the assigned stage, self-check, record accepted decisions, report, and stop until the operator authorizes the next stage.
- **MSG-DEC-07: MAX MVP excludes incoming file downloads. Status: superseded by MSG-DEC-09.**
  **What was:** MAX incoming file handling had not been scoped.
  **Why chosen:** the initial documentation review missed the file attachment URL in the official MAX API schema.
  **Replacement:** see MSG-DEC-09; MAX accepts one CSV/TXT attachment within the client's configured size limit.
- **MSG-DEC-08: restrict messenger API_BASE_URL to local/private origins in the MVP. Status: accepted.**
  **What was:** API_BASE_URL did not yet have a tenant-configurable trust policy.
  **Why chosen:** restricting the gateway to localhost/private IP origins reduces SSRF exposure; internal DNS names cannot be safely distinguished from public hosts in the MVP.
  **Replacement:** allow localhost and private IP literals only; defer a configurable trusted-host allowlist to Stage 5.
- **MSG-DEC-09: support MAX CSV/TXT attachments. Status: accepted; supersedes MSG-DEC-07.**
  **What was:** the MAX transport rejected all incoming attachments.
  **Why changed:** the operator confirmed that MAX supports attachments; the official MAX API schema defines file attachment metadata and a media URL in its payload.
  **Replacement:** download one CSV/TXT file from the MAX-provided HTTPS URL, enforce the per-client attachment size limit, and reject other media types or multiple files.
