# Local Copilot proxy

The community `copilot-api` proxy is an optional tool for local development
and demos. It is unofficial and reverse-engineered, not a GitHub product.
Check the applicable account terms and limits before using it. Production
deployments should use a standard OpenAI-compatible API provider instead.
The application code does not depend on `copilot-api`.

## Scenario 1: Direct connection

Use this when the machine can reach GitHub without a system proxy. This works
for most standard network setups. Start the proxy in a separate terminal and
leave it running:

```sh
HOST=127.0.0.1 npx copilot-api@latest start
```

The proxy listens on port `4141` by default. On first use, complete the OAuth
device flow shown by the CLI.

## Scenario 2: Connection through a system proxy

If a corporate network, VPN, or other network policy blocks direct GitHub
access, set `HTTPS_PROXY` to the address of a working HTTP proxy and enable
`--proxy-env`. Replace `<port>` with the proxy's configured listener port:

```sh
export HTTPS_PROXY="http://127.0.0.1:<port>" && HOST=127.0.0.1 npx copilot-api@latest start --proxy-env
```

With `--proxy-env`, `copilot-api` reads proxy settings from the environment,
including `HTTPS_PROXY`. Keep the proxy bound to loopback; do not expose it to
a public network.

## Verify the proxy and configure the API

Before starting the API, check that the proxy is listening and returns its
model list:

```sh
curl http://127.0.0.1:4141/v1/models
```

When using the local proxy, configure the root `.env` and restart the API:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_BASE_URL=http://127.0.0.1:4141/v1
LLM_API_KEY=dummy-token-for-proxy
```

The API key above is a local placeholder for the OpenAI-compatible client. It
is not a GitHub credential. Keep the proxy and API running in separate
terminals.

## Troubleshooting

### OAuth does not finish

- Confirm that the proxy command includes `--proxy-env`.
- Check that `HTTPS_PROXY` points to a running proxy and uses its actual
  listener port.
- Complete the verification URL and one-time code printed by the CLI.
- Review the proxy terminal output for connection or authorization errors.

### Port 4141 is already in use

Start the proxy on another port. If using the system proxy, keep
`--proxy-env` in the command:

```sh
HOST=127.0.0.1 npx copilot-api@latest start --port 4142
```

For a system-proxy network, use:

```sh
export HTTPS_PROXY="http://127.0.0.1:<port>" && HOST=127.0.0.1 npx copilot-api@latest start --proxy-env --port 4142
```

Then update the root `.env` to match and restart the API:

```dotenv
LLM_BASE_URL=http://127.0.0.1:4142/v1
```

### The model-list check fails

Make sure the proxy process is still running and listening on the port in the
URL. If you selected another port, use it in the check as well, for example
`curl http://127.0.0.1:4142/v1/models`. For a proxy-related OAuth failure,
verify `HTTPS_PROXY` and retry with `--proxy-env`.

## Production connection

For production, configure a standard OpenAI-compatible API provider in the
root `.env` with that provider's model name, base URL, and API key:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=<provider-model>
LLM_BASE_URL=<provider-openai-compatible-base-url>
LLM_API_KEY=<provider-api-key>
```

Keep the API key private and follow the provider's usage and billing terms.

## Risks

- `copilot-api` is an unofficial, reverse-engineered integration, not a GitHub
  product. Its behavior and compatibility can change; review the
  [upstream project](https://github.com/ericc-ch/copilot-api) and applicable
  account and organization policies before use.
- The [upstream HTTP API documentation](https://github.com/ericc-ch/copilot-api/blob/master/_autodocs/endpoints.md)
  states that incoming requests are not authenticated. Keep the proxy bound
  to `127.0.0.1`; do not expose port `4141` to a LAN, public network, or
  shared machine. Anyone who can reach it may be able to submit requests
  through the authenticated Copilot session.
- The [upstream token setup documentation](https://github.com/ericc-ch/copilot-api/blob/master/_autodocs/api-reference/lib-token.md)
  states that the GitHub token is stored on disk and in memory. Protect the
  local account and token storage, and never share tokens or diagnostic
  output that could contain credentials.
- Prompts and code sent through the proxy are sent to GitHub Copilot. Do not
  submit confidential or customer data unless your account and organization
  policies permit it.
- Treat this as a development-only workflow. Do not use the proxy as a
  production dependency or expose it as a production service.
