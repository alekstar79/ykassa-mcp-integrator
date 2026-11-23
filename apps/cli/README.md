# @alekstar79/ykassa-mcp

CLI umbrella for setting up a YooKassa MCP client, starting the headless API, and serving the reference UI or client configurator.

## Install

```sh
npm install --global @alekstar79/ykassa-mcp
```

You can also run commands without a global install:

```sh
npx @alekstar79/ykassa-mcp <command>
```

## Commands

```sh
ykassa-mcp init <name>
ykassa-mcp start
ykassa-mcp web
ykassa-mcp configurator
ykassa-mcp messenger
ykassa-mcp --help
ykassa-mcp --version
```

- `init <name>` copies the bundled example client into `clients/<name>/` and prompts for the YooKassa shop ID and MCP token, which it writes to `.env`.
- `start` runs the API server.
- `web` serves the reference UI on port 5173.
- `configurator` serves the client configurator on port 5174.
- `messenger` starts the configured Telegram and MAX clients. Run it from the
  project directory containing `clients/` and `.env`, separately from `start`.

Run project commands from the project directory containing `clients/` and `.env`.
