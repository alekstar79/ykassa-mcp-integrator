# Artifact Templates

All paths are relative to the project root, not to the skill directory.

## README.md

    # <Client Name> — YooKassa MCP Integration

    ## What it does
    One paragraph.

    ## Quick start
        npx @alekstar79/ykassa-mcp init my-client
        npx @alekstar79/ykassa-mcp start
        # In another terminal:
        npx @alekstar79/ykassa-mcp web

    ## Architecture
    - MCP tools used: ...
    - LLM role: orchestration of MCP calls from natural language.
    - Human-in-the-loop: explicit approval in the UI or Telegram/MAX
      approval-card buttons. A free-text "yes" is not an approval.

    ## Onboarding a new client
        npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <new-client-name>

    ## Metrics
    See docs/metrics.md.

    ## Limitations
    - Refund creation is not available through the official MCP server.
      Use the YooKassa dashboard or API for refunds.

## docs/metrics.md

    # Metrics — before / after

    | Metric | Manual | With agent | Delta |
    |---|---|---|---|
    | Create one payment link | X s | Y s | -Z% |
    | Review and approve a high-value payment | X s | Y s | -Z% |
    | Onboard a new client | n/a | Y min | — |

    Notes:
    - Measured on test shop data on <date>.
    - Each value is the median of N runs.

## docs/demo-plan.md

    # Demo plan (10 minutes)

    | Time | Step | Speaker says | Screen shows |
    |---|---|---|---|
    | 0:00-1:30 | Problem | ... | Slide 1 |
    | 1:30-4:30 | Live demo | ... | Terminal + browser |
    | 4:30-6:00 | Complex case | ... | UI or Telegram/MAX approval card |
    | 6:00-7:30 | Onboarding second client | ... | Terminal |
    | 7:30-9:00 | Metrics | ... | docs/metrics.md |
    | 9:00-10:00 | Next steps | ... | Slide N |

    ## Fallback
    If the live demo fails, play docs/demo-recording.mp4.

## Application contract

Use [`docs/api-contract.md`](../../../../docs/api-contract.md) as the source of
truth for the current HTTP routes, request bodies, response fields, and status
codes. Do not copy an older route shape into generated documentation.

The current API exposes:

- `POST /api/ask` with `client` and a `messages` array. It returns `200` for a
  completed response or `202` with approval details when a proposed operation
  requires explicit approval.
- `POST /api/approve` to approve or reject a pending `approval_id`.
- `GET /api/clients/:name/public` for non-secret client display settings.

The Messenger gateway is an independent HTTP client of the API. It does not
call MCP tools or make payment-policy decisions itself.
