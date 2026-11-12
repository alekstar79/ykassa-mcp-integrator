# Artifact Templates

All paths are relative to the project root, not to the skill directory.

## docs/README.md

    # <Client Name> — YooKassa MCP Integration

    ## What it does
    One paragraph.

    ## Quick start
        npm install
        cp .env.example .env
        # fill YOOKASSA_SHOP_ID and YOOKASSA_MCP_TOKEN
        npx tsx .github/skills/yookassa-mcp-integration-agent/scripts/onboard-client.ts <client-name>
        npm run start:api --workspace=api --client <client-name>

    ## Architecture
    - MCP tools used: ...
    - LLM role: orchestration of MCP calls from natural language.
    - Human-in-the-loop: approval queue in Vue 3 UI.

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
    | Prepare 10 recurring charges | X min | Y s | -Z% |
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
    | 4:30-6:00 | Complex case | ... | Approval queue |
    | 6:00-7:30 | Onboarding second client | ... | Terminal |
    | 7:30-9:00 | Metrics | ... | docs/metrics.md |
    | 9:00-10:00 | Next steps | ... | Slide N |

    ## Fallback
    If the live demo fails, play docs/demo-recording.mp4.

## Application contract (apps/api/src/main.ts)

    - Exposes POST /ask with body {"client": "<name>", "text": "<request>"}.
    - Returns {"reply": "...", "requires_approval": bool, "proposed_action": {...}}.
    - Uses the client config from clients/<name>/config.yaml.
    - Calls MCP tools only if they are confirmed by tools/list.
    - Never executes recurring charges or captures without human approval
      when config.require_human_confirmation is true.
