# Example client template

Copy this directory to `clients/<name>`, fill in `.env`, start the API and
reference UI, then open the UI with `?client=<name>`.

`config.yaml` contains non-secret client settings. Keep credentials only in
`.env`; copy `.env.example` to `.env` and set `YOOKASSA_SHOP_ID` and
`YOOKASSA_MCP_TOKEN`. If Telegram or MAX is enabled in `config.yaml`, also set
the corresponding `TELEGRAM_BOT_TOKEN` or `MAX_BOT_TOKEN` in `.env` and add at
least one allowed sender ID to that platform's `allowed_user_ids`.

Start the messenger gateway with
`npm run start --workspace=@alekstar79/ykassa-messenger` when either platform
is enabled.

For `mode: custom-ui`, build the client UI against `/api/ask`,
`/api/approve`, and `/api/clients/:name/public`. See
[`docs/api-contract.md`](../../docs/api-contract.md).
