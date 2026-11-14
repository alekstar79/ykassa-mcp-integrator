# Example client template

Copy this directory to `clients/<name>`, fill in `.env`, start the API and
reference UI, then open the UI with `?client=<name>`.

`config.yaml` contains non-secret client settings. Keep credentials only in
`.env`; copy `.env.example` to `.env` and set `YOOKASSA_SHOP_ID` and
`YOOKASSA_MCP_TOKEN`.

For `mode: custom-ui`, build the client UI against `/api/ask`,
`/api/approve`, and `/api/clients/:name/public`. See
[`docs/api-contract.md`](../../docs/api-contract.md).
