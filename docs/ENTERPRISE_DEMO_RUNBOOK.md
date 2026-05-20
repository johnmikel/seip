# SEIP Enterprise Demo Runbook

Plain-English guide for running and narrating the complex SEIP demo.

## Purpose

The regular demo proves the basic lifecycle. The enterprise demo proves SEIP under cross-runtime pressure: one producer changes an event schema and five different downstream worlds need to coordinate before the change is safe.

Use this demo when someone asks whether SEIP is more than a toy CLI workflow.

## Scenario

`checkout-api` proposes `CheckoutCompleted.v3`, a breaking event contract change driven by privacy, money precision, product catalog normalization, analytics consistency, and ML feature safety.

The schema changes include:

- `payment.amount`: JSON Schema `number` to `integer` minor units.
- `customer.email`: removed.
- `customer.email_hash`: added.
- `line_items[].sku`: replaced by `line_items[].product_id`.
- `risk_score`: added as a required field.
- `payment.method`: enum narrowed from `card | bank | paypal | cash` to `card | bank`.
- Nested JSON Schema with local `$ref`, `$defs`, arrays, object paths, and `allOf`.

## Cast

| Role | Team | What they prove |
| --- | --- | --- |
| Producer | `checkout-api` | Owns the event schema and migration plan. |
| Payments consumer | `payments-ledger` | Passes contract checks for integer minor units. |
| API consumer | `partner-api` | Fails first because public clients still expect `customer.email`. |
| ML consumer | `fraud-models` | Fails replay validation because amount precision changes model thresholds. |
| Data platform consumer | `warehouse-dbt` | Requests more time for dbt lineage and release trains. |
| Analytics consumer | `mobile-analytics` | Stays pending until event mapping is updated from `sku` to `product_id`. |

## Run It

From the repository root:

```bash
npm run demo:enterprise
```

For a named disposable workspace:

```bash
SEIP_ENTERPRISE_DEMO_DIR=/tmp/seip-enterprise-live npm run demo:enterprise
```

Expected result:

- Exit code `0`.
- Output includes `SEIP Enterprise Demo`.
- Output includes `CheckoutCompleted.v3`.
- Output includes `CONSUMER_VALIDATED`, `OBJECTED`, `EXTENSION_REQUESTED`, `ACCEPTED`, and `COMPLETED`.
- Final summary includes `Cross-runtime schema coordination`.

By default, the demo writes to:

```text
/tmp/seip-enterprise-demo-<pid>
```

## Story Beats

### Step 1: Strict Policy Is Turned On

The demo configures SEIP so CI requires:

- `min_status: ACCEPTED`
- acknowledgements from all five consumers
- strict handling of required additions

Say:

> "A placeholder declaration is not enough. CI requires a valid declaration, accepted status, and every required consumer acknowledgement."

### Step 2: Nested JSON Schema Diff

The diff uses common JSON Schema inputs rather than flat demo objects. It demonstrates local refs, `$defs`, arrays, nested paths, and simple `allOf`.

Say:

> "This is closer to a real event schema. The change is not one field. It is privacy, money, product identity, analytics, and ML risk in one rollout."

### Step 3: Undeclared Rollout Is Blocked

`seip validate` fails before the producer creates a declaration.

Say:

> "SEIP's first value is prevention. The surprise breaking change does not merge silently."

### Step 4: One Coordinated Declaration

The producer creates a single `restructure` declaration from the diff and enriches it with:

- affected paths
- explicit rename mapping
- staged migration steps
- SQL
- rollback
- extended timeline

Say:

> "This is the contract for the rollout. It does not replace each team's migration work. It records the shared intent and lifecycle."

### Step 5: GitHub And Slack Surfaces

The same declaration is rendered as GitHub Markdown and Slack dry-run JSON.

Say:

> "GitHub and Slack are not state stores here. They are display surfaces over the same Git-backed declaration."

### Step 6: Consumer Validation Evidence

The demo runs command-based checks with `validate-consumer --record --team`.

Important moments:

- `payments-ledger` passes and acknowledges.
- `partner-api` fails validation, records evidence, then objects.
- `fraud-models` fails replay validation, records evidence, then objects.
- `warehouse-dbt` passes a local check but requests an extension.

Say:

> "This is not blind approval. Consumers can attach evidence from their own checks before responding."

### Step 7: CI Still Blocks

A declaration exists, but it is not accepted and not all consumers have acknowledged.

Say:

> "SEIP distinguishes 'someone wrote a file' from 'the rollout is actually coordinated.'"

### Step 8: Negotiation Resolves Risk

The producer extends the timeline and consumers rerun checks:

- partner migration guide accepted
- fraud replay approved
- warehouse timeline accepted
- mobile analytics mapping updated

The final acknowledgement moves the declaration to `ACCEPTED`.

### Step 9: CI Passes

`seip validate` now passes because the declaration is valid, accepted, and all required consumers have acknowledged.

### Step 10: Audit, Enforcement, Closure

The audit log includes lifecycle events and `CONSUMER_VALIDATED` evidence. The declaration then moves to `ENFORCING` and `COMPLETED`.

Say:

> "The coordination trail survives beyond the PR, chat thread, or meeting."

## What This Demo Proves

- SEIP can coordinate one schema change across API, data, analytics, payments, and ML consumers.
- Common JSON Schema inputs are usable in the reference diff path.
- Consumer validation is a real integration point for team-owned checks.
- Failed validation evidence can be recorded before objections.
- Objections and extension requests keep the declaration in review.
- CI can enforce both declaration coverage and organizational readiness.

## What It Does Not Prove

- It does not make SEIP a full JSON Schema dialect engine.
- It does not send real Slack messages.
- It does not call the GitHub API directly.
- It does not replace dbt, contract tests, model validation, or schema registries.
- It does not define cross-repository write authorization.

## Quick Pitch

For a short version, focus on these four moments:

1. `seip diff` finds multiple breaking changes in `CheckoutCompleted.v3`.
2. `validate-consumer --record` records failed evidence for `partner-api` and `fraud-models`.
3. `OBJECTED` and `EXTENSION_REQUESTED` keep the rollout blocked.
4. CI passes only after every required consumer acknowledges.

## Cleanup

Demo workspaces can be removed at any time:

```bash
rm -rf /tmp/seip-enterprise-demo-*
rm -rf /tmp/seip-enterprise-live
```

No repository files are modified by running the demo.
