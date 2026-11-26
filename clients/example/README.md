# Example client template

Copy this directory to `clients/<name>` and fill in `.env`.

`config.yaml` contains non-secret client settings. Keep credentials only in
`.env`; copy `.env.example` to `.env` and set `YOOKASSA_SHOP_ID` and
`YOOKASSA_MCP_TOKEN`. If Telegram or MAX is enabled in `config.yaml`, also set
the corresponding `TELEGRAM_BOT_TOKEN` or `MAX_BOT_TOKEN` in `.env` and add at
least one allowed sender ID to that platform's `allowed_user_ids`.

Set `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, and optionally `LLM_BASE_URL`
in this `.env` when they are not configured in the project root `.env`.
Client values take precedence over root values.

Start the API with `npm run start:api`. Start the Reference UI with
`npm run start:web` and open `http://localhost:5173/?client=<name>`.
If Telegram or MAX is enabled, start the Messenger with
`npm run start:messenger` in another terminal.

For `mode: custom-ui`, build the client UI against `/api/ask`,
`/api/approve`, and `/api/clients/:name/public`. See
[`docs/api-contract.md`](../../docs/api-contract.md).
