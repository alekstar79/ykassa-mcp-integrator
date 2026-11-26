# HTTP API contract

The reference UI, Messenger gateway, and independently built clients communicate
with the API over HTTP. Set the API base URL to the deployment origin. JSON requests use
`Content-Type: application/json`.

## `GET /api/clients`

List configured clients for the Reference UI. A client is listed only when its
directory contains both `config.yaml` and `.env`. The response contains public
labels only; credentials are never returned.

```json
{
  "clients": [
    { "name": "online-school", "display_name": "Online School" }
  ]
}
```

The Reference UI opens the sole listed client automatically. When multiple
clients are listed, it waits for an explicit selection. The selection is kept
in the UI state and is not placed in the browser URL.

## `POST /api/ask`

Submit a manager request for a client. `client` is the client slug.

### Request

Preferred form:

```json
{
  "client": "online-school",
  "session_id": "123e4567-e89b-42d3-a456-426614174000",
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

`session_id` is optional on the first request. The API creates one and returns
it in the response. Clients should persist it and send it with every later
request in the same conversation. Each client/session pair has a separate
server-side transcript. The transcript is not added to model context by
default; the agent retrieves relevant earlier turns on demand.

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
  "session_id": "123e4567-e89b-42d3-a456-426614174000",
  "tool_calls": [],
  "requires_approval": false
}
```

`202 Accepted` means an operation is waiting for explicit approval:

```json
{
  "reply": "Please review this operation.",
  "session_id": "123e4567-e89b-42d3-a456-426614174000",
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

For payment and invoice creation, the API requests a structured `prepare_operation`
tool call rather than exposing the real MCP creation tools to the model. The API
validates the extracted plan against the client's scenario and field policies,
applies configured defaults, and validates against the current MCP schema.
Missing or unsupported data stops before MCP. A follow-up can provide the
missing data in the same session; the API uses the recent transcript to resume
extraction. If approval is required, the validated proposal is returned as
`202` without executing the operation. On approval, the API revalidates and
executes the saved arguments without another model request.

Errors use a JSON object with an `error` string. `400` indicates an invalid
request, `404` a missing client configuration, `413` a request exceeding the
HTTP body size limit, `500` a configuration or server failure, and `502` an
invalid or unstructured operation plan. Providers that cannot force tool
selection may return text instead; the API rejects it and executes no
financial MCP operation.

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
  "session_id": "123e4567-e89b-42d3-a456-426614174000",
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

## `GET /api/history`

Read the complete transcript for a client session. The Reference UI uses this
to restore earlier messages after a reload; it does not add the transcript to
each LLM request.

### Query parameters

- `client`: client slug.
- `session_id`: UUID returned by `/api/ask`.

### Response

```json
{
  "session_id": "123e4567-e89b-42d3-a456-426614174000",
  "messages": [
    {
      "id": "message-id",
      "turn_id": "turn-id",
      "created_at": "2026-03-19T10:00:00.000Z",
      "role": "user",
      "content": "Create a payment link"
    },
    {
      "id": "assistant-message-id",
      "turn_id": "turn-id",
      "created_at": "2026-03-19T10:00:03.000Z",
      "role": "assistant",
      "content": "The payment link is ready.",
      "tool_calls": [
        {
          "name": "create_payment",
          "args": {},
          "result": "{\"id\":\"payment-id\"}"
        }
      ]
    }
  ]
}
```

An unknown but valid client/session pair returns `200 OK` with an empty
`messages` array. The response is marked `Cache-Control: no-store`. The API
does not yet authenticate users; deploy it only in a trusted environment and
add authentication and tenant authorization before production use.

### Example

```sh
curl 'http://localhost:3000/api/history?client=online-school&session_id=123e4567-e89b-42d3-a456-426614174000'
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

A custom client can use these endpoints:

1. `GET /api/clients` to discover configured client names and display labels.
2. `GET /api/clients/:name/public` to load the public brand, UI settings,
   scenario allowlist, approval threshold, and limits.
3. `POST /api/ask` to submit a user request and display either a completed
   response (`200`) or the pending approval details (`202`).
4. `POST /api/approve` to submit an explicit approval or rejection.
5. `GET /api/history` to restore the transcript for a persisted `session_id`.

Treat the public client response as display and client-side configuration, not
as authorization. The API remains responsible for enforcing the configured
limits and operation policy. Client secrets are never returned by the public
endpoint and must remain in the client's server-side `.env` file. No UI
component or application code is shared between the API and clients.
