# Contributing

## Prerequisites

- Node.js 18 or newer.
- npm 9 or newer.

## Getting started

```sh
git clone https://github.com/alekstar79/ykassa-mcp-integrator.git ykassa-mcp-integrator
cd ykassa-mcp-integrator
npm install
cp .env.example .env
```

Set `LLM_PROVIDER`, `LLM_MODEL`, and the provider's `LLM_API_KEY` in the root
`.env`. `LLM_BASE_URL` is optional for OpenAI-compatible endpoints.

Create a client and its secret file:

```sh
cp -r clients/example clients/my-client
cp clients/my-client/.env.example clients/my-client/.env
```

Fill `YOOKASSA_SHOP_ID` and `YOOKASSA_MCP_TOKEN` in
`clients/my-client/.env`. Do not commit credentials.

## Project structure

- `apps/api`: headless Express API, MCP client, LLM providers, and approvals.
- `apps/web`: Vue 3 reference UI.
- `apps/messenger`: independent Telegram and MAX gateway that calls the API over HTTP.
- `apps/configurator`: client configuration and zip export UI.
- `apps/cli`: command-line package and bundled UI assets.
- `packages/contracts`: shared types, schemas, and UI values.
- `clients/`: per-client configuration and secrets.
- `docs/`: product and integration documentation.
- `logs/`: local API audit log output.

## Development

Run each service in a separate terminal:

```sh
npm run start:api
npm run dev
npm run dev:configurator
npm run start --workspace=@alekstar79/ykassa-messenger
```

Run services in separate terminals. The API listens on port 3000, the
reference UI on port 5173, and the configurator on port 5174. The Messenger
workspace starts enabled Telegram and MAX clients. For a built install, use
`npx @alekstar79/ykassa-mcp messenger`. See
`apps/messenger/README.md` for bot setup and chat commands.

**Local LLM development.** If you don't have an API key from OpenAI, Anthropic, or Google, you can run a local OpenAI-compatible proxy to GitHub Copilot. See `docs/copilot-proxy.md` for setup and risks. This is a development-only option, not for production.

## Testing

Run the complete suite or use the watch and coverage scripts:

```sh
npm test
npm run test:watch
npm run test:coverage
```

The suite includes API, Messenger, Configurator, Web, and Contracts tests.
Run `npm test` from the repository root to execute all workspace suites.

## Building packages

```sh
npm run build:packages
```

This builds contracts, API, Messenger, reference UI, and configurator, then
copies the UI assets and client template into `apps/cli/` using
`scripts/sync-templates.mjs`.

## Adding a client

Copy the example and fill its secret file:

```sh
cp -r clients/example clients/my-client
cp clients/my-client/.env.example clients/my-client/.env
```

Edit `clients/my-client/config.yaml`, set the shop ID and MCP token in
`clients/my-client/.env`, then open
`http://localhost:5173/?client=my-client`.

To connect a Telegram bot, configure the client's `messengers.telegram`
settings and `TELEGRAM_BOT_TOKEN`, then follow
`apps/messenger/README.md`. The gateway is started separately from the API.

## Code style

- Use strict TypeScript and ES modules.
- The API uses NodeNext; the Vue applications use Bundler module resolution.
- Include `.js` extensions on local imports in API TypeScript.
- Do not use `any`, `@ts-ignore`, or `@ts-expect-error`.

## Test conventions

Application tests belong in `tests/**/*.test.ts` and use Vitest. Vue
component tests use `@vue/test-utils`. The contracts workspace currently
keeps its schema test beside the schema source.
