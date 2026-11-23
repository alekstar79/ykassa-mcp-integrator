# Demo metrics

## Verified outcomes

| Scenario | Before | With the agent | Evidence |
|---|---|---|---|
| Process a five-row CSV in MAX | No comparable baseline run recorded | One chat request was used to read five student rows | Live MAX E2E, 2026-11-23 |
| Create five payment links | No comparable baseline run recorded | Five `create_payment` calls succeeded at 100 RUB each; links were not opened or paid | Live MAX E2E and `logs/mcp-calls.jsonl`, 2026-11-23 |

These are observed outcomes, not time or conversion-rate measurements. The
manual baseline was not recorded under comparable conditions.

## Timing

No verified timing comparison is available. Earlier timing values were tied to
source notes dated December 5–6, 2026, which are later than the review date,
November 23, 2026. Those values and unmeasured manual/configurator estimates
have been removed rather than presented as results. Collect new timings with
dated source logs and a defined repeat count before making a performance
comparison.
