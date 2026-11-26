# Contributing

## Prerequisites

- Node.js 18 or newer.
- npm 9 or newer.

## Getting started

```sh
git clone https://github.com/alekstar79/ykassa-mcp-integrator.git ykassa-mcp-integrator
cd ykassa-mcp-integrator
npm install
npm run setup
cp .env.example .env
```

Configure LLM settings in a client's `clients/<name>/.env`. These values
override matching values in the root `.env`; unset values fall back to the
root file. This lets the root `.env` contain only `PORT` when each client has
its own LLM settings.

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
npm start
npm run start:messenger
npm run start:web
npm run dev:configurator
```

Run services in separate terminals. The API listens on port 3000, the
reference UI on port 5173, and the configurator on port 5174. Open the
reference UI at `http://localhost:5173/`; it loads a single configured client
or asks you to choose when several are available. The Messenger command starts
enabled Telegram and MAX clients. See
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

The configurator is the recommended option:

```sh
npm run start:configurator
```

Download and extract the client archive into `clients/`. Alternatively, use
the CLI to create a client and enter YooKassa credentials:

```sh
npm run client:init -- my-client
```

Add LLM settings to `clients/my-client/.env` if they are not set in the root
`.env`. Edit `clients/my-client/config.yaml`, then open

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
