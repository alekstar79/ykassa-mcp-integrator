# HTTP API contract

The reference UI, Messenger gateway, and independently built clients communicate
with the API over HTTP. Set the API base URL to the deployment origin. JSON requests use
`Content-Type: application/json`.

## `POST /api/ask`

Submit a manager request for a client. `client` is the client slug.

### Request

Preferred form:

```json
{
  "client": "online-school",
  "messages": [
    { "role": "user", "content": "Create a payment link for 100 RUB" }
  ],
  "overrides": {
    "currency": "RUB",
    "vat_code": 11,
    "capture": true,
    "invoice_expiry_days": 30
  },
  "attachment": {
    "filename": "customers.txt",
    "content": "Anna\nBoris"
  }
}
```

`attachment` is optional. Its UTF-8 content size is limited by the client's
`limits.max_attachment_kb`; the filename may contain at most 255 characters.
The messages array is limited by `limits.max_messages`. Each message currently
requires `role: "user"` and a string `content` of at most 8,000 characters.
`overrides` is optional and contains payment settings selected by the operator
in the Reference UI. Supported fields are `currency`, `vat_code`, `capture`,
`return_url`, and `invoice_expiry_days`. Supplied values take precedence over
the corresponding client defaults for that request only; they are validated
by the API and are not written back to `config.yaml`.

For backwards compatibility, callers may instead send `client`, `amount`, and
`description`:

```json
{
  "client": "online-school",
  "amount": { "value": "100", "currency": "RUB" },
  "description": "Course payment"
}
```

### Responses

`200 OK` means the request completed without a pending approval:

```json
{
  "reply": "Request processed.",
  "tool_calls": [],
  "requires_approval": false
}
```

`202 Accepted` means an operation is waiting for explicit approval:

```json
{
  "reply": "Please review this operation.",
  "requires_approval": true,
  "approval_id": "approval-id",
  "proposed_action": {
    "tool": "create_payment",
    "args": {},
    "requires_confirmation": true
  },
  "proposed_actions": [],
  "tool_calls": []
}
```

For an explicit payment or invoice creation request where the model asks for
text confirmation instead of calling a tool, the API retries once with only
the matching creation tool required. A valid proposal is returned as `202`
without executing the operation, so the approval card is the confirmation
step even when the amount is below the configured threshold.

Errors use a JSON object with an `error` string. `400` indicates an invalid
request, `404` a missing client configuration, `413` a request exceeding the
HTTP body size limit, `500` a configuration or server failure, and `503` a
failed recovery when the API cannot turn a text-only confirmation request into
a valid creation proposal. This can happen when the provider cannot require a
tool call or returns an invalid proposal. No operation is executed.

### Example

```sh
curl -X POST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"client":"online-school","messages":[{"role":"user","content":"Create a payment link for 100 RUB"}]}'
```

## `POST /api/approve`

Approve or reject a pending operation returned by `/api/ask`. An approval ID
can be resolved only once and expires after 15 minutes.

### Request

```json
{
  "approval_id": "approval-id",
  "approved": true
}
```

### Responses

`200 OK` means the decision was processed and no further approval is pending:

```json
{
  "reply": "Payment approved.",
  "approved": true,
  "tool_calls": [],
  "requires_approval": false
}
```

`202 Accepted` uses the same approval response shape as `/api/ask` when the
continued operation requires another explicit approval.

Errors use a JSON object with an `error` string. `400` indicates a malformed
request, `404` an unknown or already resolved approval, `409` an operation no
longer allowed by the current client configuration or MCP tool list, `410` an
expired approval, `413` a request exceeding the HTTP body size limit, and
`500` a configuration or server failure.

### Example

```sh
curl -X POST http://localhost:3000/api/approve \
  -H 'Content-Type: application/json' \
  -d '{"approval_id":"approval-id","approved":true}'
```

## `GET /api/clients/:name/public`

Return the public client settings needed to label and configure a client UI.
Optional `ui` and `limits` settings in YAML are normalized to their defaults
when omitted.

### Response

```json
{
  "brand": {
    "display_name": "Online School"
  },
  "allowed_scenarios": ["create_payment"],
  "approval_threshold": 4000,
  "ui": {
    "mode": "reference-ui",
    "accent": "navy",
    "radius": 2,
    "shadow": "soft",
    "font_pair": "manrope+jetbrains",
    "form_style": "flat",
    "h1_size": "m"
  },
  "limits": {
    "max_messages": 20,
    "max_attachment_kb": 100
  }
}
```

The public response is an explicit projection. It never includes `shop_id`,
`mcp_token`, or any other client secrets. `400` indicates an invalid client
name, `404` an unknown client, and `500` an invalid configuration or server
failure.

### Example

```sh
curl http://localhost:3000/api/clients/online-school/public
```

## Connecting a custom UI

A custom client needs only these three endpoints:

1. `GET /api/clients/:name/public` to load the public brand, UI settings,
   scenario allowlist, approval threshold, and limits.
2. `POST /api/ask` to submit a user request and display either a completed
   response (`200`) or the pending approval details (`202`).
3. `POST /api/approve` to submit an explicit approval or rejection.

Treat the public client response as display and client-side configuration, not
as authorization. The API remains responsible for enforcing the configured
limits and operation policy. Client secrets are never returned by the public
endpoint and must remain in the client's server-side `.env` file. No UI
component or application code is shared between the API and clients.
