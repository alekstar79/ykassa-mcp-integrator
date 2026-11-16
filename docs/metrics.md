# Demo metrics

## Timings

| Scenario                  | Manual estimate | Measured system or script time | Configurator estimate | Note                        |
|---------------------------|----------------:|-------------------------------:|----------------------:|-----------------------------|
| Create one payment link   |           ~45 s |                          2.3 s |                   n/a | One successful agent run    |
| Create five payment links |          ~4 min |                        11.05 s |                   n/a | All five links were created |
| Onboard a client          |        ~3–5 min |    ~10 s (`onboard-client.ts`) |              ~1–2 min | Script time is approximate  |

## How we collected the results

On November 13, 2026, we tested one 100 RUB payment link and a request for
five links at 100 RUB each in the test shop. The `gpt-4o` run went through the
reference UI, API, LLM, YooKassa MCP, and back to the UI. The five-link
request created all five links.

That run used the pipeline as it existed on November 13, before
`enrichToolCall` and Ajv JSON Schema validation were added.

On November 17, a new run with the local `qwen2.5:7b-instruct` model reached
YooKassa MCP, but the store rejected the RUB currency. No link was created,
so that failed run is not included in the timing table.

The manual times are estimates, not stopwatch results. They describe creating
links in the YooKassa dashboard. The Configurator estimate includes filling
in the form, downloading the archive, and copying it to `clients/<name>/`.
The `onboard-client.ts` time is an approximate script run.

The script is for operators who use a terminal. The Configurator is for
service owners who prefer a web interface. The API reads client settings for
each request, so adding a client does not require an API restart.
