# Architecture

## Components and request flow

```mermaid
flowchart LR
    Manager[Manager] --> UI[UI (Vue)]
    UI -->|HTTP| API[API (Express)]
    API -->|MCP| YooKassa[YooKassa MCP]
    API --> LLM[LLM provider]
    API --> Audit[logs/mcp-calls.jsonl]
```

The reference UI and independently built client interfaces communicate with
the API over HTTP. The API loads the selected client's configuration and
secrets, requests the current MCP tool list, and sends eligible tools and the
manager request to the configured LLM provider. The API validates proposed
tool calls before executing them and records MCP results in the audit log.

## Application boundaries

- `apps/api` is headless and does not import either Vue application.
- `apps/web` is one replaceable client. Removing it does not affect the API.
- A custom client can implement its own UI using
  [`docs/api-contract.md`](api-contract.md).
- `apps/configurator` creates client configuration files; it does not depend
  on the API or reference UI.
- `apps/cli` packages commands to initialize clients, start the API, and
  serve the built UI applications.
- `packages/contracts` contains shared types, validation schemas, defaults,
  enums, and palette values.

These components are joined by the HTTP contract and the `config.yaml`
format, not by application-level imports between the API and the UIs.

## YooKassa MCP integration

The API uses the YooKassa MCP server as its only payment integration point.
It calls `tools/list` at runtime; the server's current response is the source
of truth for available tools. Client `allowed_scenarios` further narrows the
tools offered to the LLM. The API also excludes `create_invoice` from the
model tool list until the nested `cart` input receives strict validation.

## LLM providers

LLM access is replaceable through the `LLM_PROVIDER` setting. The API
supports `openai`, `anthropic`, `google`, and `ollama`. The OpenAI provider
also accepts an OpenAI-compatible base URL, which allows local development
proxies. The proxy is an optional development dependency; production
deployments should use a supported provider endpoint and API key.

## Human approval

1. The LLM proposes one or more tool calls.
2. The API checks each call against the current MCP tools, the client's
   `allowed_scenarios`, and the operation risk policy.
3. If confirmation is required, the API returns the proposal without
   executing it.
4. A person approves or rejects the proposal through `/api/approve`.
5. On approval, the API reloads the client's configuration and secrets,
   reconnects to MCP, obtains the current tool list, and validates the
   pending calls against the current configuration before execution.

Pending approvals are held in memory and expire after 15 minutes. They are
lost when the API process restarts.

## Client configuration and tenancy

The `?client=<name>` query parameter selects a client in the UI. The UI loads
the public client DTO from `GET /api/clients/<name>/public`. It contains
`brand`, `ui`, `limits`, `allowed_scenarios`, and `approval_threshold`; it
does not contain client secrets.

The API reads the selected client's `config.yaml` and `.env` for each request.
Configuration changes therefore take effect without restarting the API.
Keep `YOOKASSA_SHOP_ID` and `YOOKASSA_MCP_TOKEN` in the client's `.env` file.

## Audit log

Each MCP tool execution is appended to `logs/mcp-calls.jsonl`. Entries
include a timestamp, tenant `shop_id`, tool name, sanitized arguments, and
either a result or an error. The log may contain request data and should be
protected accordingly.

## Client configurator flow

`clients/example/` is the starting template. A client owner edits settings in
the configurator, downloads an archive containing `config.yaml`, `.env`, and
`README.md`, and places it in `clients/<name>/`. The client UI then loads its
public configuration using `?client=<name>`.
