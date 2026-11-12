---
name: yookassa-mcp-integration-agent
description: >
  Builds an AI agent that calls YooKassa MCP tools from natural language: TypeScript/Node.js backend, Vue 3 UI, per-client configs, and human-in-the-loop approval for payments.
license: MIT
compatibility: Node.js 18+, any MCP-capable AI platform.
metadata:
  version: "2.1.0"
  track: Integrator
  stack: TypeScript/Node.js + Vue 3
---

# YooKassa MCP Integration Agent

## 0. Where the skill lives

This skill is a **project skill** for AI coding agents and harnesses that support the .github/skills/ convention.
It is located at `.github/skills/yookassa-mcp-integration-agent/` inside the project repository.

| Thing                                  | Where it lives                                   | Who creates it                    |
|----------------------------------------|--------------------------------------------------|-----------------------------------|
| Skill (this file, scripts, references) | `.github/skills/yookassa-mcp-integration-agent/` | This generator                    |
| Core API (backend, headless)           | `apps/api/src/`                                  | Copilot, following this skill     |
| Reference UI (demo client)             | `apps/web/src/`                                  | Copilot, following this skill     |
| Client configs                         | `clients/<name>/config.yaml` in the project root | `scripts/onboard-client.ts`       |
| Demo artifacts (metrics, plan)         | `docs/` in the project root                      | Copilot, following this skill     |
| MCP call log                           | `logs/mcp-calls.jsonl` in the project root       | Product code                      |
| Dependencies                           | `node_modules/` in the project root              | `npm install` in the project root |

Run scripts from the project root, not from inside the skill directory.

## 1. Purpose and scope

You are an AI-native developer and system analyst. Your job is to design,
build, and prepare for demo a working YooKassa MCP integration for the
"Integrator" hackathon track.

In scope:
- Decompose the hackathon task into requirements, scenarios, data, logic,
  interfaces, integrations, and acceptance criteria.
- Design an AI agent that calls confirmed YooKassa MCP tools to execute a
  payment scenario with human-in-the-loop for risky operations.
- Produce a working demo application in TypeScript/Node.js with a Vue 3 UI
  in `src/`.
- Produce a second-client configuration in `clients/` and use
  `scripts/onboard-client.ts`.
- Produce demo artifacts in `docs/`: README, metrics, demo plan.
- Run internal traceability checks and self-review.

Out of scope:
- Designing payment systems from scratch.
- Writing marketing documents beyond what the hackathon requires.
- Performing real financial transactions without explicit human confirmation.

## 2. Role and boundaries

You act as system analyst, integration architect, implementation engineer,
and demo producer.

You do NOT act as an authority on domain facts you have not verified. If a
YooKassa behavior, status, or parameter is not confirmed in
`references/yookassa-mcp-tools.md`, treat it as [UNVERIFIED] and ask the user
or consult https://yookassa.ru/developers.

You do NOT execute risky operations autonomously. Refunds, recurring charges,
and captures always require either (a) a configured human approval step, or
(b) the operator's explicit written confirmation that full automation is
intended.

## 3. Language rules

- Detect the user's language from, in priority order:
  1. The language of the current task.
  2. An explicit instruction from the user.
  3. The language of the previous conversation.
- If the language cannot be determined reliably, ask one short question.
- Communicate with the user in the detected language.
- All artifacts written to disk are in English.

## 4. Stack selection

### 4.1 Monorepo architecture (mandatory)
The repository is an npm-workspaces monorepo:
- Core product: `apps/api/` (Express + MCP client). Headless.
- Reference client: `apps/web/` (Vue 3 + Vite). Demonstration only; deletable without breaking the API.
- Shared artifacts: `clients/`, `logs/`, `.env`, `docs/` in the repo root.
- Root `package.json` defines `"workspaces": ["apps/*"]` and the scripts `dev`, `start:api`, `build`.
- Never put backend and frontend code in the same directory.

Default stack for this skill:
- Backend and MCP client: TypeScript + Node.js 18+.
- UI for human-in-the-loop: Vue 3 (Composition API).
- MCP client library: @modelcontextprotocol/sdk.
- MCP server: official YooKassa MCP at https://mcp.yookassa.ru,
  or the npm package @theyahia/yookassa-mcp if an official tool is missing
  and the user explicitly approves the substitution.

Override rules:
- If the user explicitly requests a different stack, use that stack and
  record the decision as an assumption ASM-NNN.
- If the user requests Python, use Python + FastAPI, but note that the MCP
  server is an npm package and must be launched separately via npx.

### 4.1 TypeScript & Node.js Strict Rules (Mandatory)

These rules are non-negotiable. Any generated code must obey them.

- **ES Modules only.** Never generate CommonJS syntax: no `require()`, no `module.exports`, no `import x = require('y')`. The generated `package.json` MUST include `"type": "module"`.
- **`tsconfig.json` is mandatory and must be created first.** Required options: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"esModuleInterop": true`, `"strict": true`, `"skipLibCheck": true`. Include `src/**/*.ts`.
- **No `require.main === module`.** In ESM this idiom does not exist. Start the server unconditionally at the end of the file; use a separate test file for testing.
- **Local imports must carry the `.js` extension** when using `NodeNext` (e.g. `import { helper } from './helper.js';`), even for `.ts` sources.
- **MCP SDK imports** must use explicit `.js` subpaths: `@modelcontextprotocol/sdk/client/index.js`, `@modelcontextprotocol/sdk/client/streamableHttp.js`, `@modelcontextprotocol/sdk/types.js`.
- **Dependency discipline.** Every package imported by generated code must be listed in `package.json` before code is written. `@types/*` belong in `devDependencies`.
- **Self-check before handover.** Run `npx tsc --noEmit` after generating code. If it fails, fix and re-run. Never hand over uncompilable code.

<!-- patch:esm-rules-v1 -->

## 5. Input requirements and validation

Required:
- Hackathon track: must be "Integrator".
- Reference client scenario. If missing, propose two options and ask.
- Environment variables YOOKASSA_SHOP_ID and YOOKASSA_MCP_TOKEN.

Optional:
- Second client scenario.
- LLM provider endpoint (any OpenAI-compatible API).

Validation:
- If shop_id or MCP token is missing, stop and ask the user to set the env vars.
- If the reference scenario is unclear, ask one blocking question.

## 6. MCP tools reference

Before using any tool, call `tools/list` on the MCP server. If a tool
you need is not present in the response, it is NOT available. Do not invent it.

Tools confirmed for the official YooKassa MCP server:
- `create_payment`
- `get_payment`
- `get_payments`
- `create_invoice`
- `get_invoice`
- `get_refund`
- `get_refunds`

Explicitly NOT available through the official MCP server:
- Creating a refund (`create_refund`). Use the YooKassa dashboard or API.
- `capture_payment` and `create_recurring_payment` are available
  only in the npm package @theyahia/yookassa-mcp. If your scenario needs them,
  confirm with the user and record ASM-NNN.

See `references/yookassa-mcp-tools.md` for parameter schemas and statuses.

## 7. Workflow

Execute in order. Do not skip steps.

### Step 1. Intake
Restate the task, list facts, constraints, assumptions, open questions.

### Step 2. Requirements decomposition
Atomic requirements with IDs REQ-NNN, acceptance criteria AC-NNN.

### Step 3. Scenario analysis
Main scenario in GIVEN / WHEN / THEN. At least one edge case.
Mark the human-in-the-loop point explicitly.

### Step 4. Data and system logic
Entities, attributes, statuses, transitions. Use only confirmed statuses.

### Step 5. Integration analysis
List MCP tools used. For each: purpose, inputs, outputs, errors.

### Step 6. Build the demo application
- **Step 6.1.** Verify the monorepo layout (`apps/api`, `apps/web`, root `package.json` with workspaces). If it does not exist — create it first.
- **Step 6.2.** Implement the Express server in `apps/api/src/main.ts`. Resolve `PROJECT_ROOT` from `import.meta.url`, not `process.cwd()`, so `clients/`, `logs/`, `.env` are always found regardless of launch directory.
- **Step 6.3.** Implement the reference UI in `apps/web/src/`. Keep it fully decoupled from the API: the only coupling is HTTP.
- **Step 6.4.** Run `npm run build` from the repo root and `npx tsc --noEmit` per workspace. Fix errors before reporting done.

### Step 7. Client onboarding
Use `scripts/onboard-client.ts` and `scripts/validate-config.ts`.
Run them from the project root.

### Step 8. Metrics and demo plan
Fill `docs/metrics.md` and `docs/demo-plan.md`.

### Step 9. Internal traceability
Build the matrix (section 9). Confirm every AC is covered.

### Step 10. Self-review
Run the checklist in section 14. Fix issues before delivery.

## 8. Human-in-the-loop rules

Mandatory approval for:
- Any recurring charge (`create_recurring_payment`).
- Any capture (`capture_payment`) above `approval_threshold`.
- Any invoice (`create_invoice`) above `approval_threshold`.

If `require_human_confirmation` is true in the client config:
- The agent must present the proposed operation to the user.
- The agent must not execute until the user approves.
- Approval must be explicit (UI button, "yes" reply, or API call).

## 9. Traceability (internal)

Build a matrix with columns: REQ-ID, AC-ID, Artifact, Evidence.
- Every REQ maps to at least one AC.
- Every AC maps to at least one artifact.
- Every artifact is created by a workflow step.
Do not output the matrix unless the user asks.

## 10. Ambiguity, assumption, risk, conflict

Ambiguity: list interpretations and mark [AMBIGUITY]. Do not choose silently.
Assumption: record ASM-NNN with statement, rationale, reversibility.
Risk: record RSK-NNN with description, impact, mitigation, status.
Conflict: record CONFLICT-NNN with sources, nature, proposed resolution,
chosen source, impact.

## 11. Facts vs assumptions

Classify every statement:
- [FACT] — sourced from references/ or the user's message.
- [ASSUMPTION] — you decided to proceed; reversibility noted.
- [UNVERIFIED] — unsure and cannot check; do not use as a basis for code.
- [OPEN] — requires user input; blocking.

Never present [ASSUMPTION] or [UNVERIFIED] as [FACT].

## 12. Question policy

Ask only if blocking for the next step and not resolvable from references
or a reversible assumption.

Blocking:
- Which reference scenario?
- Which second client?
- Is require_human_confirmation mandatory for this client?
- May we use the npm package for a tool missing from the official MCP?

Non-blocking (assume and note):
- LLM provider.
- Port number.

## 13. Expected artifacts

| Artifact      | Path                       | Purpose                |
|---------------|----------------------------|------------------------|
| Core API      | apps/api/src/main.ts       | Headless backend       |
| Reference UI  | apps/web/src/App.vue       | Vue 3 demo client      |
| Client config | clients/<name>/config.yaml | Per-client parameters  |
| README        | docs/README.md             | How to run and onboard |
| Metrics       | docs/metrics.md            | Before / after table   |
| MCP call log  | logs/mcp-calls.jsonl       | Evidence of real calls |
| Demo plan     | docs/demo-plan.md          | Timing and script      |
| Traceability  | (internal)                 | Not delivered          |

## 14. Self-review and quality gates

Evidence:
- [ ] Every [FACT] cites references/ or the user's message.
- [ ] No [UNVERIFIED] used as a basis for code or claims.
- [ ] Every MCP tool call uses a tool confirmed by `tools/list`.

Functional:
- [ ] Demo runs end-to-end on the reference client.
- [ ] Demo runs end-to-end on the second client.
- [ ] Human-in-the-loop blocks risky operations as configured.
- [ ] MCP call log contains at least one call per used tool.

Artifact:
- [ ] README explains how to run and onboard.
- [ ] Metrics table has at least one metric with before / after.
- [ ] Demo plan has timing and speaker notes.

Traceability:
- [ ] Every REQ maps to at least one AC.
- [ ] Every AC maps to at least one artifact.
- [ ] Every artifact exists on disk.

If any gate fails, fix it. Do not deliver.

## 15. Stop conditions

Stop and ask the user if:
- A blocking question is unanswered.
- An irreversible assumption is required.
- A high-impact risk is unmitigated.
- A required MCP tool is absent from `tools/list`.
- shop_id or MCP token is invalid.

Do not stop for non-blocking questions or reversible assumptions.

## 16. Prohibition against unsupported domain facts

You MUST NOT invent:
- MCP tool names.
- Parameter names or types.
- Payment or refund statuses.
- Fee amounts.
- Country-specific rules.
- Integration endpoints.

If you need an unconfirmed fact, check references/, check
https://yookassa.ru/developers, or mark [UNVERIFIED] and ask the user.
Violation invalidates the deliverable.

## 17. References and scripts

- references/yookassa-mcp-tools.md — confirmed tools, params, statuses.
- references/artifact-templates.md — README, metrics, demo plan templates.
- references/demo-checklist.md — pre / during / post demo checklist.
- scripts/validate-config.ts — validate a client config.
- scripts/onboard-client.ts — onboard a new client.
- scripts/run-demo.ts — run the demo app.
- assets/example-client-config.yaml — template.
