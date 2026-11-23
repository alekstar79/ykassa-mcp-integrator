# Online demo plan (4–5 minutes)

The same five-minute run-of-show works for a recorded video or a live Zoom
screen-share. Use the test shop only. Keep every requested payment at 100 RUB,
review approval prompts explicitly, and never complete checkout or enter
payment credentials.

This run-of-show covers the Reference UI. For Telegram setup, bot commands,
and messenger-specific E2E scenarios, use
[`apps/messenger/README.md`](../apps/messenger/README.md).

## Run of show

| Time      | Segment                   | Presenter notes                                                                                                                                                                                  | Screen                                        |
|-----------|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| 0:00–0:30 | Problem and solution      | Introduce the Integrator track. Explain that the product combines a headless API and a reference UI, and that tenant settings support two clients.                                               | Opening slide or README architecture          |
| 0:30–1:30 | Demo 1: one payment       | Enter a request for one 100 RUB payment link. Review and explicitly approve it if prompted. Show the returned test link and the matching entry in `logs/mcp-calls.jsonl`; do not open checkout.  | `online-school` UI, then audit log            |
| 1:30–2:30 | Demo 2: approval          | Show a proposal containing safe and risky actions. Explain that read-only work can proceed while `create_payment` waits for explicit human approval. Review the 100 RUB amount before approving. | Approval card                                 |
| 2:30–3:30 | Demo 3: batch from a file | Upload `docs/demo-students.csv`, which contains five synthetic names with 100 RUB per row. Show the five resulting test links and the corresponding tool-call log entries.                       | UI, then `logs/mcp-calls.jsonl`               |
| 3:30–4:00 | Tenant variation          | Open `?client=delivery-service`. Point out its different brand and 2,000 RUB approval threshold.                                                                                                 | UI and `clients/delivery-service/config.yaml` |
| 4:00–5:00 | Metrics and close         | Show the before/after table in `docs/metrics.md`. Call out which values are estimates and which came from the recorded `gpt-4o` run.                                                             | `docs/metrics.md`                             |

## Recording checklist

- Set browser zoom to 125% and increase the terminal font so labels, tool calls,
  and log entries remain readable in the video.
- Close unrelated tabs and notifications. Keep `.env` files, API keys, and
  tokens off-screen.
- Start the API, UI, MCP connection, and LLM proxy before recording. Verify
  both clients load and the test shop is selected.
- Rehearse the request text and CSV upload once. Keep the 100 RUB test amount
  visible before any approval.
- Record a local copy of the finished video and verify playback before the
  event.

## Live Zoom checklist

- Share the application window rather than the whole desktop where possible.
- Confirm microphone, screen share, browser zoom (125%), terminal font size,
  and the local recording fallback before admitting the jury.
- Keep the API, MCP server, proxy, and test-shop session ready. Do not expose
  credentials while switching to the audit log or client configuration.
- Leave time for questions after the five-minute run; do not extend the live
  payment flow to answer them.

## Fallback

If internet access, the Copilot proxy, or MCP becomes unavailable during the
live jury call, stop live requests and play the locally stored recording at
`docs/demo-recording.mp4`. Say: «Из-за ограничений соединения показываю запись
работы системы, сделанную сегодня».

The `.gitignore` rule for `docs/demo-recording.mp4` is already present. The
recording itself is not currently in the repository; record and verify it
before the event rather than treating this fallback as ready now.
