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

After global installation, run `ykassa-mcp <command>` directly:

```sh
ykassa-mcp --help
ykassa-mcp init my-client
ykassa-mcp start:api
ykassa-mcp start:messenger
```

## Commands

```sh
ykassa-mcp init <name>
ykassa-mcp start | start:api
ykassa-mcp messenger | start:messenger
ykassa-mcp web | start:web
ykassa-mcp configurator | start:configurator
ykassa-mcp --help
ykassa-mcp --version
```

- `init <name>` copies the bundled example client into `clients/<name>/` and prompts for the YooKassa shop ID and MCP token, which it writes to `.env`.
- `start` runs the API server.
- `web` serves the reference UI on port 5173.
- `configurator` serves the client configurator on port 5174.
- `messenger` starts the configured Telegram and MAX clients. Run it from the
  project directory containing `clients/` and `.env`, separately from `start`.
  It adds the bundled Russian Ministry of Digital Development root CA to the
  Messenger process trust store so MAX TLS works on systems that do not include
  this CA. The bundled certificate is verified against the fingerprint from
  the [official distribution](https://gu-st.ru/content/Other/doc/russian_trusted_root_ca.cer).
  Certificate verification remains enabled.

Run project commands from the project directory containing `clients/` and `.env`.
