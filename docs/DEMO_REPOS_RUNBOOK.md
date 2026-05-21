# SEIP Demo Repos Runbook

Guide for generating and presenting a realistic multi-repo SEIP pilot exhibit.

## Purpose

The quick and enterprise demos run inside one script. The demo-repos exhibit creates a small organization on disk: one producer repo and five consumer repos. This lets reviewers inspect actual repo directories, validation scripts, schema files, Git history, GitHub Actions examples, and the SEIP declaration state.

Use this when someone asks:

> "What would this look like across real projects?"

## Generate The Repos

From the SEIP repository root:

```bash
npm run demo:repos
```

For a stable presentation path:

```bash
SEIP_DEMO_REPOS_DIR=/tmp/seip-demo-repos-live npm run demo:repos
```

By default, the generator writes to:

```text
/tmp/seip-demo-repos-<pid>
```

## Generated Layout

```text
/tmp/seip-demo-repos-<pid>/
  commerce-events/
  partner-api/
  payments-ledger/
  warehouse-dbt/
  fraud-models/
  mobile-analytics/
```

Each directory is initialized as its own Git repository and includes a `README.md`.

## Scenario

`commerce-events` owns the `CheckoutCompleted` event contract. It proposes `CheckoutCompleted.v3`, which changes:

- `payment.amount`: JSON Schema `number` to `integer` minor units.
- `customer.email`: removed.
- `customer.email_hash`: added.
- `line_items[].sku`: replaced by `line_items[].product_id`.
- `risk_score`: added as a required field.
- `payment.method`: enum narrowed.

The producer repo owns:

- `schemas/checkout-completed-v2.schema.json`
- `schemas/checkout-completed-v3.schema.json`
- `.github/workflows/seip.yml`
- `.seip/declarations/seip_checkout_completed_v3.json`

## Consumer Repos

| Repo | Role | What happens |
| --- | --- | --- |
| `payments-ledger` | Payments/data consumer | Passes integer minor-unit validation and acknowledges. |
| `partner-api` | API contract consumer | Fails first because public clients still expect `customer.email`, then acknowledges after a readiness marker is added. |
| `fraud-models` | ML consumer | Fails first because replay drift exceeds threshold, then acknowledges after recalibration. |
| `warehouse-dbt` | Data pipeline consumer | Passes current validation but requests an extension for release-train timing. |
| `mobile-analytics` | Analytics consumer | Remains pending until event mapping moves from `sku` to `product_id`. |

## Story Beats

### 1. Show The Repos

Open the generated workspace and point out that each directory has its own Git history.

Say:

> "This is the shape of a real organization: one producer repo, several consumer repos, and no shared SEIP server."

### 2. Show Producer CI

Open `commerce-events/.github/workflows/seip.yml`.

Say:

> "The producer repo can add SEIP as a normal CI check around schema files."

### 3. Show The Schema Diff

The generator runs:

```bash
seip diff schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict
```

Point out that the diff catches multiple breaking classes, not just one retype.

### 4. Show Failed CI Before Declaration

`seip validate` fails before the producer creates a declaration.

Say:

> "A breaking schema change cannot merge silently."

### 5. Show The Declaration

Open:

```text
commerce-events/.seip/declarations/seip_checkout_completed_v3.json
```

Point out:

- affected objects
- rename mapping
- migration plan
- consumers
- responses
- `CONSUMER_VALIDATED` events

### 6. Show Consumer Evidence

Open each consumer repo's `checks/validate.mjs`. These are intentionally simple, but they model the real integration point: each team runs checks it already owns.

Useful examples:

- `partner-api/checks/validate.mjs`
- `fraud-models/checks/validate.mjs`
- `warehouse-dbt/checks/validate.mjs`

Say:

> "SEIP does not need to understand every runtime. It needs a durable place to record the result of each runtime's own checks."

### 7. Show Objection And Extension

In the audit log, show:

- `partner-api` objecting
- `fraud-models` objecting
- `warehouse-dbt` requesting an extension

Then show the later acknowledgements after the generated repos are updated.

### 8. Show Final CI Pass

The final `seip validate` passes only after the declaration reaches `ACCEPTED` and all required consumers acknowledge.

## What This Exhibit Proves

- SEIP can be presented as a multi-repo workflow, not only a single CLI demo.
- Git remains the state store.
- CI remains the enforcement point.
- Consumers keep ownership of their own validation commands.
- Failed validation evidence can be recorded before objections.
- Objections and extension requests block readiness until resolved.

## What It Does Not Prove

- It does not publish real GitHub PR comments.
- It does not push the generated repos to GitHub.
- It does not solve cross-repo write authorization.
- It does not replace schema registries, dbt, API contract tests, or ML validation.

## Cleanup

Remove generated workspaces:

```bash
rm -rf /tmp/seip-demo-repos-*
rm -rf /tmp/seip-demo-repos-live
```
