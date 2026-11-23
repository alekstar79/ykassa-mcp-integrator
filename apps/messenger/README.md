# YooKassa Messenger Gateway

The gateway is an independent HTTP client of the headless API. It contains no
LLM or MCP logic; API policy and payment execution remain in `apps/api`.

Run tests with `npm test --workspace=@alekstar79/ykassa-messenger`. From the
client project directory, start the Messenger gateway with
`npx @alekstar79/ykassa-mcp messenger`. In this repository, first build it with
`npm run build --workspace=@alekstar79/ykassa-messenger`, then use
`npm run start --workspace=@alekstar79/ykassa-messenger` for local development.
It starts each enabled Telegram or MAX transport whose client token is
configured.

## Chat commands

Commands work in an authorized private chat. Send `/help` to the bot for this
list:

- `/start` sends the welcome message. A sender who is not allowlisted is still
  denied.
- `/help` explains the available commands and how to send a request.
- `/status` shows the configured client name and its allowed MCP scenarios.
- `/reset` clears a waiting file request. It does not cancel a pending
  approval; use the approval card's buttons to approve or reject it.

Each request is sent to the API independently; earlier user messages are not
replayed into later asks. If MAX sends request text and its file as separate
messages, mention the file or list in the text. The gateway waits for the next
valid attachment before calling the API, and discards that waiting request if a
different text request arrives first. MAX can deliver the text and attachment
as separate events even when they were sent together. When a request is waiting
for a file, the gateway delays its "send the file" prompt for 3 seconds; a file
that arrives during that window is processed with the request without the
premature prompt.

Risky operations are decided with the buttons on the approval card. Typing
“yes”, “approve”, or a similar chat message does not submit an approval.
If the model replies to an explicit payment/invoice creation request by asking
for text confirmation, the API retries once with only that creation tool
required. A prepared proposal appears as an approval card, without a separate
confirmation-text reply; the user does not need to send an extra message.
Recovered proposals always require explicit approval, even below the configured
threshold. This recovery requires an OpenAI-compatible provider that supports
required tool choice. If recovery fails, the bot reports that the operation
was not executed.

## Telegram manual E2E

Live E2E uses a test Telegram bot and the operator's YooKassa test environment.
Do not commit bot or YooKassa tokens.

1. Create a test bot with `@BotFather` and keep its token outside source control.
2. In `clients/<name>/config.yaml`, enable Telegram with an empty allowlist.
   This denies all senders during the initial identity check:

   ```yaml
   messengers:
     telegram:
       enabled: true
       allowed_user_ids: []
       locale: ru
   ```

3. In `clients/<name>/.env`, set `TELEGRAM_BOT_TOKEN`. Keep the existing
   `YOOKASSA_SHOP_ID` and `YOOKASSA_MCP_TOKEN` values there as well. Never put
   the bot token in YAML or commit it.
4. In a separate terminal, start the local Copilot proxy and complete OAuth
   if prompted:

   ```sh
   HOST=127.0.0.1 npx copilot-api@latest start
   ```

   Keep it running and bound to loopback. Verify the model list with
   `curl http://127.0.0.1:4141/v1/models`.
5. Merge these LLM settings into the root `.env`, preserving `PORT` and other
   unrelated values. `gpt-4o` is available in the model list shown in this
   runbook's setup; choose another exact ID from `/v1/models` if needed:

   ```dotenv
   LLM_PROVIDER=openai
   LLM_MODEL=gpt-4o
   LLM_BASE_URL=http://127.0.0.1:4141/v1
   LLM_API_KEY=dummy-token-for-proxy
   ```

   The API key here is a local placeholder, not a GitHub credential. Keep
   YooKassa credentials in the client `.env`, then start the API with
   `npm run start:api`. See [copilot-proxy.md](../../docs/copilot-proxy.md)
   for details and the proxy's security limitations.
6. Start the gateway with
   `npx @alekstar79/ykassa-mcp messenger` (or the workspace command during local
   development). The gateway scans
   `CLIENTS_DIR` (default `./clients`) and starts one bot per enabled client
   with a valid token. Before allowing any sender, send `/start` to the bot
   once. The request is denied and recorded without its message body; read your
   `user_id` from the corresponding `message_denied` record in
   `logs/messenger-actions.jsonl`. Add that ID as a quoted string to
   `allowed_user_ids`, then restart the gateway.
7. In the bot's private chat, verify:
   - A request for a 100 RUB payment produces a `Pay` URL button when permitted
     by the client's API policy.
   - A 5000 RUB request that crosses the configured approval threshold displays
     approval buttons immediately, without a separate “Подтверждаю” message;
     approve it and verify the resulting payment link.
   - A CSV attachment within `limits.max_attachment_kb` is handled by the API.
   - For a split MAX upload, send a prompt mentioning the file or list, confirm
     the bot waits without calling the API, then send the CSV/TXT file.
   - A sender ID not in `allowed_user_ids` is denied.
8. Check `logs/messenger-actions.jsonl` for gateway events and
   `logs/mcp-calls.jsonl` for API-side MCP audit records. Neither log should
   contain bot tokens or message bodies.

The gateway keeps waiting file requests and approval correlation in memory.
Restarting it clears that state; this is an MVP limitation, not a durability
guarantee.
Telegram's Bot API file-download limit also applies. The gateway rejects
downloads above that transport limit; accepted files are subsequently checked
by the core against the configured file size and CSV/TXT policy.

## MAX setup and manual E2E

The MAX adapter uses the official Bot API with long polling. MAX documents
long polling for development and testing only and recommends webhooks for
production; webhook delivery is not implemented by this gateway.

1. Create a MAX bot and keep its access token outside source control.
2. In `clients/<name>/config.yaml`, enable MAX with an empty allowlist:

   ```yaml
   messengers:
     max:
       enabled: true
       allowed_user_ids: []
       locale: ru
   ```

3. Add `MAX_BOT_TOKEN` to `clients/<name>/.env`. The same client can keep
   Telegram enabled; each transport starts independently when its own token
   is present.
4. Start the API and local LLM proxy as described in the Telegram E2E steps,
   then start the Messenger gateway. Send `/start` to the MAX bot once. The
   request is denied until the sender is allowlisted. Read the sender's
   `user_id` from the `message_denied` entry in
   `logs/messenger-actions.jsonl`, add that ID as a quoted string to
   `allowed_user_ids`, and restart the gateway.
5. In the bot's private chat, verify `/help`, `/status`, a permitted payment
   request with a payment-link button, and a request above the approval
   threshold with working approve/reject buttons.
6. Ask the bot to process a CSV/TXT file and attach one file within the
   client's configured size limit in the same composer. Verify that no
   premature "send the file" prompt appears if MAX delivers the text and file
   as separate events. Also test a split upload with the file sent after the
   3-second grace period: the bot should ask for the file and process it when
   it arrives. MAX image, audio, video, multiple-file, and non-CSV/TXT
   attachments are not passed to the API.

The MAX adapter and gateway wiring are covered by the Messenger workspace test
suite. Live MAX E2E requires an operator-provided bot token and an approved MAX
bot; no live MAX requests are made by automated tests.
