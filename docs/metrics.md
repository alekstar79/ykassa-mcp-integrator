# Demo metrics

## Before / after

| Metric | Manual (estimate) | Agent / onboarding script | Configurator (estimate) | Delta / comment |
|---|---:|---:|---:|---|
| Create one payment link | ~45 s | 2.3 s | n/a | 42.7 s saved (~94.9%); manual time is an assumed average for the YooKassa dashboard, agent time is from the earlier single-request run. |
| Create five payment links | ~4 min | 11.05 s | n/a | 3 min 48.95 s saved (~95.4%); manual estimate for five separate links, agent result is the earlier 5-row `gpt-4o` run. |
| Onboard a client | ~3–5 min | ~10 s (`onboard-client.ts`) | ~1–2 min | Manual setup edits `config.yaml` and `.env`; the script creates and validates client files; the configurator flow is fill the form, download the zip, and copy it to `clients/<name>/`. |

## Measurement note

> Ручной замер — оценочный. Замер с агентом — фактический прогон gpt-4o, 2026-11-13.

The payment-link timings are single-run observations, not medians or a
controlled benchmark. The five-link run used a test shop and requested
100 RUB per row. It returned 5 of 5 links in 11.05 seconds; the resulting
payments remained pending and none was completed.

The manual figures are estimates, not timed dashboard trials. The onboarding
script and configurator are two different automation paths: `onboard-client.ts`
is for operators already in a terminal, while the configurator is for service
owners using a web UI. Both reduce manual setup from about 3–5 minutes to
10–120 seconds. The script's ~10 s is an approximate run, and the
configurator's ~1–2 min is an estimate, not a timed result. The API reads
client configuration per request, so restarting the API is not required by
the current implementation.
