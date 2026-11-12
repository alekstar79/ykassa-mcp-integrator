# YooKassa MCP Tools — Confirmed Reference

This file is the SINGLE SOURCE OF TRUTH for MCP tools in this skill.
If a tool, parameter, or status is not listed here, treat it as [UNVERIFIED]
and ask the user or consult https://yookassa.ru/developers before using it.

## How to check availability

Call `tools/list` on the MCP server. If a tool is not in the response,
it is NOT available through that server, even if it appears in this file.
This file lists what the official YooKassa MCP server documents, but the
runtime `tools/list` response is authoritative.

## Official YooKassa MCP tools

### create_payment
- Purpose: create a one-step payment, return confirmation URL.
- Inputs: amount (value, currency), description, gateway_id (optional).
- Outputs: id, status, amount, confirmation_url, description, created_at.
- Errors: invalid amount, invalid currency, network error.

### get_payment
- Purpose: retrieve payment status and details.
- Inputs: id.
- Outputs: id, status, amount, confirmation_url, description, created_at.
- Errors: not found, network error.

### get_payments
- Purpose: list payments with filters.
- Inputs: created_at_gte, created_at_lte, payment_method, status, limit,
  next_cursor.
- Outputs: items[], next_cursor.
- Errors: invalid date, network error.

### get_refund
- Purpose: retrieve refund details.
- Inputs: id.
- Outputs: id, payment_id, status, amount, created_at, description.
- Errors: not found, network error.

### get_refunds
- Purpose: list refunds with filters.
- Inputs: created_at_gte, created_at_lte, payment_id, status, limit,
  next_cursor.
- Outputs: items[], next_cursor.
- Errors: invalid date, network error.

### create_invoice
- Purpose: create an invoice with cart and expiry.
- Inputs: amount, expires_at, cart[], description, gateway_id.
- Outputs: id, status, confirmation_url, amount, expires_at.
- Errors: invalid amount, invalid cart, expiry too long, network error.

## Tools explicitly NOT available through the official MCP server

- Creating a refund. The official docs state: "Создать возврат через
  MCP-сервер нельзя. Сделать возврат можно только в личном кабинете ЮKassa
  или по API." Use the dashboard or API for refund creation.

## Tools available only in the npm package @theyahia/yookassa-mcp

These are NOT part of the official MCP server. Use them only if the user
explicitly approves and you record ASM-NNN.

- capture_payment — confirm a two-step payment (partial capture supported).
- cancel_payment — cancel a pending or waiting_for_capture payment.
- save_payment_method — save a payment method for recurring charges.
- create_recurring_payment — charge a saved payment method without user
  interaction.
- create_sbp_payment — create a payment via SBP.
- create_split_payment — split payment for marketplaces.
- create_refund — full or partial refund (moves real money, irreversible).
- create_receipt / list_receipts — fiscal receipts (54-FZ).
- create_payout / get_payout — payouts.
- create_webhook / list_webhooks / delete_webhook — webhooks.
- get_shop_balance — shop info.

## Confirmed statuses

### Payment
- pending — created, awaiting payment.
- waiting_for_capture — authorized, awaiting capture.
- succeeded — paid.
- canceled — canceled.

### Refund
- pending — created, awaiting processing.
- succeeded — processed.
- canceled — canceled.

## Confirmed limitations

- The official MCP server does not validate product data or check amounts
  against an internal catalog.
- The official MCP server does not store state beyond what YooKassa stores.
- Payment links expire according to YooKassa's default policy.
