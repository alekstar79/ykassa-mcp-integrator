# AGENTS.md

Guidance for AI coding agents working with this repository.

## Project overview

The root workspace `@alekstar79/ykassa-workspace` is a YooKassa MCP integrator: it turns natural-language manager requests into real YooKassa payments through the official MCP server, with human-in-the-loop for risky operations.

Five workspaces:

| Path                 | Package                           | Purpose                                                                |
|----------------------|-----------------------------------|------------------------------------------------------------------------|
| `apps/api`           | `@alekstar79/ykassa-api`          | Headless API: MCP client, LLM orchestration, approvals, audit          |
| `apps/web`           | `@alekstar79/ykassa-web`          | Vue 3 reference UI                                                     |
| `apps/configurator`  | `@alekstar79/ykassa-configurator` | Web configurator that generates `config.yaml` + `.env` as a zip        |
| `apps/cli`           | `@alekstar79/ykassa-mcp`          | CLI umbrella: `npx @alekstar79/ykassa-mcp init/start/web/configurator` |
| `packages/contracts` | `@alekstar79/ykassa-contracts`    | Shared types, Zod schema, enum values, palette                         |

`apps/api`, `apps/web`, `apps/configurator` are independent: no code imports across them. They communicate via HTTP contract (`docs/api-contract.md`) and `config.yaml`.

## Code style

- TypeScript strict. No `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- ES modules only (`"type": "module"`). NodeNext in `apps/api`, Bundler in `apps/web` and `apps/configurator`.
- Local imports in `apps/api` include `.js` extension (`import { x } from './x.js'`).
- No CommonJS (`require`, `module.exports`).

## Testing

- `npm test` runs all workspaces. Use `npm run test:coverage` for per-workspace coverage.
- Vitest. Vue tests use `@vue/test-utils` + `jsdom`.
- Tests live in `tests/**/*.test.ts` per workspace. Do not move them into `src/`.

## Do not

- Do not publish to npm, push to git, or create commits — release is manual.
- Do not alter `docs/screenshots/` unless the current task explicitly requests screenshot changes.
- Do not delete or rewrite existing tests to make a change pass.
- Do not silence TypeScript errors by adding `any`, `@ts-ignore`, `@ts-expect-error`.

## UI conventions

- `apps/web` and `apps/configurator` share the visual language: Manrope (body) + JetBrains Mono (code, IDs, amounts), light/dark via `[data-theme]`, RU/EN i18n.
- Colors, radius, shadow, font pair, form style, heading size are driven by `@alekstar79/ykassa-contracts` and CSS variables (`--accent`, `--radius`, `--micro-shadow`, `--h1-size`, `--font-body`).
- No gradients, glassmorphism, heavy shadows, decorative icons. Text contrast ≥ 4.5:1.
- When adding UI, mirror existing components rather than inventing new patterns.

## Documentation

- `README.md` / `README.en.md` — for product users. Keep free of internal notes, `TODO`, "demo" language, troubleshooting hacks.
- `CONTRIBUTING.md` — for contributors.
- `docs/architecture.md` — how the pieces fit together.
- `docs/api-contract.md` — HTTP contract for custom UI authors.
- `docs/copilot-proxy.md` — optional local LLM proxy (development only).

Before adding a new field to `config.yaml` or a new setting to the UI, read
`docs/decisions.md`. If a feature was cancelled, do not reintroduce it without
discussion. When adding a replacement, remove its obsolete related fields
instead of keeping them "just in case".
