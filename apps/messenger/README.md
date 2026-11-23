# @alekstar79/ykassa-messenger

The standalone Telegram and MAX gateway sends client requests to the headless
API. Payment policy, LLM orchestration, MCP calls, and approvals remain in
`apps/api`.

## Run

```bash
npx @alekstar79/ykassa-mcp messenger
```

For local development from the repository root:

```bash
npm run build --workspace=@alekstar79/ykassa-messenger
npm run start --workspace=@alekstar79/ykassa-messenger
```

The API must be running separately. The gateway starts only transports enabled
in a client's `config.yaml` that also have a corresponding bot token in
`clients/<name>/.env`. Keep bot tokens out of YAML and source control.

## Access and approvals

Configure `allowed_user_ids` for each enabled transport. Requests from other
senders are denied. Approve or reject a pending operation with the buttons on
its Telegram or MAX approval card; a chat message such as “yes” does not
approve it.

Available chat commands:

- `/start` sends the welcome message.
- `/help` shows command and request guidance.
- `/status` shows the client name and allowed MCP scenarios.
- `/reset` clears the current waiting file request. It does not cancel a
  pending approval.

MAX uses long polling, which its API documents for development and testing.
Webhook delivery is not implemented.
