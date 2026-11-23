# Demo Checklist

## Before the demo (T-1 day)
- [ ] Root `.env` has the API's LLM settings and `PORT`; it contains no
      YooKassa credentials.
- [ ] Each demo client's `clients/<name>/.env` has valid
      `YOOKASSA_SHOP_ID` and `YOOKASSA_MCP_TOKEN`.
- [ ] If Telegram is enabled, `TELEGRAM_BOT_TOKEN` is in that client's `.env`
      and the sender allowlist contains the intended Telegram user ID.
- [ ] tools/list shows the tools you plan to use.
- [ ] API and (if used) Messenger start successfully for each demo client.
- [ ] Demo runs on the reference client end-to-end.
- [ ] Demo runs on the second client end-to-end.
- [ ] MCP call log has at least 5 entries.
- [ ] docs/metrics.md is filled.
- [ ] docs/demo-plan.md is filled and rehearsed.
- [ ] Backup recording exists at docs/demo-recording.mp4.

## Before the demo (T-10 minutes)
- [ ] Terminal font size >= 18.
- [ ] Browser zoom >= 125%.
- [ ] Notifications disabled.
- [ ] API and reference UI are ready; if demonstrating Telegram, the messenger
      gateway is polling with the intended client enabled.
- [ ] Backup recording ready.

## During the demo
- [ ] Announce the scenario before typing.
- [ ] Show the MCP call log live.
- [ ] Show the human-in-the-loop approval prompt.
- [ ] Show second-client onboarding in real time.

## After the demo
- [ ] Leave the terminal in a clean state.
- [ ] Offer to share the repository link.
- [ ] Answer questions with [FACT] / [ASSUMPTION] / [UNVERIFIED] labels.
