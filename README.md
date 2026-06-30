# SEIP — Schema Evolution Intent Protocol

> A Git-native protocol and zero-dependency Node CLI / GitHub Action that makes breaking schema changes explicit, reviewable in pull requests, and enforceable as a CI gate.

[![CI](https://github.com/your-org/seip/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/seip/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)

> **Status:** v0.2.0 — reference implementation, not yet published to npm. See [Project status](#project-status) before adopting. Run the CLI from a clone with `node ./bin/seip.mjs …`; the `npx seip …` form will work once the package is published.

---

## The problem

A schema is a contract. The moment another team reads your data, your `events.json`, your API
response, or your warehouse table, a column rename or a `float → integer` retype on your side
can silently break theirs. The breakage usually surfaces *after* merge — in a downstream
pipeline, a failed model run, or a 3 a.m. page — far from the pull request that caused it.

The information needed to prevent this almost always exists at PR time. The producer knows the
change is breaking. The consumers are knowable. What's missing is a shared, machine-checkable
place to declare the intent and a gate that refuses to merge an *undeclared* breaking change.

**SEIP is that place and that gate.** It turns "surprise breaking change" into a blocking,
auditable, reviewable PR check.

## Why this exists

SEIP separates the **protocol** from the **implementation**:

- The **protocol** ([`SPEC.md`](SPEC.md), [`seip.schema.json`](seip.schema.json)) defines a
  JSON *Schema Change Declaration* stored in-repo at `.seip/declarations/*.json`. Git is the
  source of truth — declarations live next to your code, move through normal PR review, and
  carry their own append-only audit trail.
- The **reference implementation** is a single ~860-line ESM engine ([`src/index.mjs`](src/index.mjs))
  with **zero runtime dependencies**, exposed as both a Node CLI ([`bin/seip.mjs`](bin/seip.mjs))
  and a composite GitHub Action ([`action.yml`](action.yml)). A small companion module
  ([`src/notify.js`](src/notify.js)) renders notification payloads.

State and delivery are deliberately decoupled. SEIP builds the canonical declaration and renders
it as GitHub Markdown or Slack Block Kit payloads, but it makes no GitHub API calls and only
posts to Slack if you explicitly pass a webhook. Delivery otherwise stays the job of your CI,
bot, or internal tooling — SEIP is a protocol, not a notification platform.

## What it does

1. **Diffs two schemas** and classifies every change as safe or breaking.
2. **Captures intent** as a declaration: who is affected, the migration strategy, the timeline,
   and the breaking changes it covers.
3. **Coordinates** producers and consumers through an 8-state lifecycle with consumer
   acknowledgements, objections, and extension requests.
4. **Enforces** the result in CI: `seip validate` fails a PR whose breaking changes lack a
   matching, valid, sufficiently-advanced declaration.

## Install

No published package exists yet, so the supported path is a clone:

```bash
git clone https://github.com/your-org/seip.git
cd seip
node ./bin/seip.mjs --help
```

Requires Node.js 20+ (CI runs on Node 20). No `npm install` step is needed — the engine has no
runtime dependencies. The commands below use `node ./bin/seip.mjs`; once the package is
published they will also work as `npx seip`.

## Quick start

```bash
# 1. Set up .seip/ in your repo
node ./bin/seip.mjs init

# 2. See what changed between two schema files
node ./bin/seip.mjs diff schema-v1.json schema-v2.json --strict

# 3. Declare the breaking change, seeded from the diff
node ./bin/seip.mjs create \
  --id seip_retype_value \
  --summary "Convert transaction.value from float to integer" \
  --type retype \
  --breaking \
  --strategy dual_write \
  --from-diff schema-v1.json schema-v2.json \
  --consumer payments-api \
  --consumer risk-service

# 4. Propose it for review
node ./bin/seip.mjs propose seip_retype_value

# 5. Render a PR comment / Actions summary (payload only — not posted)
node ./bin/seip.mjs notify seip_retype_value \
  --adapter github --repo-url https://github.com/acme/ledger-api

# 6. The CI gate: fails because a declared breaking change is in flight
node ./bin/seip.mjs validate schema-v1.json schema-v2.json --strict
```

## A two-consumer workflow

**Producer proposes** a declaration for the breaking retype:

```bash
node ./bin/seip.mjs propose seip_retype_value --actor ledger-api
```

**Consumer A validates and acknowledges.** `validate-consumer` confirms the target exists and
runs a team-owned command (parsers, queries, dbt models, contract or model tests). With
`--record --team`, a passing or failing run is captured as a `CONSUMER_VALIDATED` audit event on
the declaration; without those flags it runs the check but records nothing.

```bash
node ./bin/seip.mjs validate-consumer seip_retype_value \
  --against ./src/queries/ \
  --command "npm test -- --schema-change" \
  --record --team payments-api
node ./bin/seip.mjs respond seip_retype_value \
  --team payments-api --status ACKNOWLEDGED --message "Compatible."
```

**Consumer B objects:**

```bash
node ./bin/seip.mjs respond seip_retype_value \
  --team risk-service --status OBJECTED --message "Precision loss breaks the fraud model."
```

Because a consumer objected, the declaration moves to `UNDER_REVIEW`. CI can keep blocking the
producer's PR until the declaration reaches the required status and the required consumers have
acknowledged.

## How it works

### Diff and breaking-change classification

`diffSchemas()` performs a structural diff over two schema JSON inputs and labels each change.
The change types it emits:

| Type | Breaking? |
|------|-----------|
| `add` | safe |
| `add_required` | breaking (only under `--strict`) |
| `remove` | breaking |
| `rename` | breaking |
| `retype` | breaking **only if lossy** (e.g. `float → integer`, `string → boolean`); otherwise safe |
| `make_required` | breaking |
| `make_non_nullable` | breaking |
| `enum_narrow` | breaking |
| `enum_widen` | safe |
| `format_change` | breaking |

The retype logic is the interesting part: it distinguishes a *widening* retype (safe) from a
*lossy* one (breaking) using a fixed table of known-lossy transitions
(`float→integer`, `number→integer`, `string→boolean`, `string→integer`, `object→string`).
A type change outside that table is recorded as a non-breaking `retype`.

Inputs can be SEIP object/table fixtures (`{ objects: [...] }` / `{ tables: [...] }`) **or** real
JSON Schema. The JSON Schema path resolves local `$ref` into `$defs`/`definitions`, flattens
nested object fields and array item fields, and handles simple `allOf` composition with a cycle
guard (`resolveJsonSchema` / `flattenJsonSchemaProperties`).

### The enforcement gate

`validate()` re-runs the diff, isolates the breaking changes, and looks for a covering
declaration. It fails when a breaking change has no matching declaration, or when the matching
declaration is not yet valid/advanced enough under policy. A declaration only counts as coverage
if it is itself structurally valid, marked breaking, not withdrawn/rejected, and matches the
change by object/property (or rename mapping) and a compatible change type. Policy knobs include
a minimum declaration status (`min_status`) and a `required_consumers` list that must have
acknowledged.

### The declaration lifecycle

Each declaration moves through an 8-state machine with enforced transition guards:

```
DRAFT → PROPOSED → UNDER_REVIEW → ACCEPTED → ENFORCING → COMPLETED
                      (objection)              (plus WITHDRAWN / REJECTED terminal states)
```

- A consumer **objection** or **extension request** drives the declaration to `UNDER_REVIEW`.
- When **all** declared consumers have acknowledged, it auto-advances to `ACCEPTED`.
- The producer then `enforce`s (requires `ACCEPTED`) and `close`s it.
- Every transition appends a timestamped audit event, queryable via `seip log`.

### State vs. delivery

`runNotificationAdapter()` ([`src/notify.js`](src/notify.js)) builds one canonical model from a
declaration and renders it through pluggable adapters:

- `--adapter github` → Markdown for a PR comment or `$GITHUB_STEP_SUMMARY` (returned as a
  payload; never posted)
- `--adapter slack` → Slack Block Kit payload; posted via `fetch` **only** if a real `--webhook`
  is supplied and `--dry-run` is not set
- `--dry-run` builds the payload without any network call
- `--json` emits the adapter result as machine-readable JSON for automation

## Commands

| Command | What it does |
|---------|--------------|
| `seip init` | Set up `.seip/` and a default config in your repo |
| `seip diff <before> <after>` | Compare two schema JSON files |
| `seip create [opts]` | Create a declaration (optionally `--from-diff`) |
| `seip propose <id>` | Move a declaration to `PROPOSED` |
| `seip respond <id> --team <t>` | Record a consumer response |
| `seip status [id]` | Show declaration status |
| `seip log <id>` | Show audit history |
| `seip validate <before> <after>` | **CI gate:** exit 1 on undeclared breaking changes |
| `seip validate-consumer <id> --against <path>` | Run a consumer-side validation hook |
| `seip notify <id>` | Emit GitHub/Slack notification payloads |
| `seip lint` | Check declaration files against the engine's built-in structural rules |
| `seip config` | Show effective config |
| `seip enforce <id>` | Mark an `ACCEPTED` declaration as `ENFORCING` |
| `seip close <id>` | Close as `COMPLETED`, `WITHDRAWN`, or `REJECTED` |

## GitHub Action

When SEIP is checked out as a repository action, the bundled composite action runs the CLI by
path (`node $GITHUB_ACTION_PATH/bin/seip.mjs validate …`):

```yaml
- uses: johnmikel/seip@v0.2.0
  with:
    before-schema: schemas/schema-before.json
    after-schema: schemas/schema-after.json
    seip-args: --strict
```

A starter workflow lives in [`examples/github-actions-template.yml`](examples/github-actions-template.yml).
> Pin to a released tag (e.g. `@v0.2.0`). You can also vendor the action or call the CLI directly, as the template shows.

## Demos

Three example scripts each run a SEIP scenario in a disposable repo under `/tmp`, isolated per
process via a PID-suffixed path. They are the fastest way to see the lifecycle end to end.

```bash
npm run demo            # full single-producer lifecycle: CI failure → enforcement → closure
npm run demo:enterprise # CheckoutCompleted.v3 rollout with API, data, analytics, and ML consumers
npm run demo:repos      # generates a multi-repo workspace and runs a scenario across it
```

`demo` and `demo:enterprise` delete their `/tmp` workspace when they finish. `demo:repos`
intentionally leaves its generated workspace in place for inspection (it prints the path); it
clears any prior run of the same workspace on start.

Presenter notes and expected output: [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md),
[`docs/ENTERPRISE_DEMO_RUNBOOK.md`](docs/ENTERPRISE_DEMO_RUNBOOK.md),
[`docs/DEMO_REPOS_RUNBOOK.md`](docs/DEMO_REPOS_RUNBOOK.md).

## Testing

```bash
npm test    # node --test
```

45 tests pass via the Node built-in test runner, covering the diff engine, the validate gate,
lifecycle transitions, declaration validation, the notify adapters, and a real (~1 s) enterprise
integration test. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm test` on
every push and pull request against Node 20.

## Project status

This is a working v0.2.0 reference implementation, written and tested but candid about its edges:

- **Not on npm.** The package is not published, so `npx seip` does not work yet. Use
  `node ./bin/seip.mjs …` from a clone.
- **Diffing is intentionally generic.** It handles SEIP fixtures and common JSON Schema object
  inputs — it is **not** a dialect-specific compatibility engine for Protobuf, Avro, or SQL DDL.
  SEIP is the protocol and reference impl; a production deployment would plug in its own
  format-specific diff.
- **Rename detection is heuristic** — a removed field is treated as a rename only when exactly
  one added field has a matching type (and requiredness, when both are booleans).
- **Lint uses built-in rules.** `seip lint` validates declarations against the engine's
  hand-written structural checks (`validateDeclaration()`), not by loading `seip.schema.json` at
  runtime. The JSON Schema is published for external tools and documentation.
- **Notifications emit payloads.** The GitHub adapter never calls the GitHub API; the Slack
  adapter only POSTs when given a real webhook. Posting the PR comment and gating the merge is
  the integrator's glue.
- **`validate-consumer` is a reference hook** — it checks the target exists and runs a supplied
  local command, optionally recording the result; it does not ship per-team validators.
- **Cross-repository authorization and state synchronization** are organization-specific and out
  of scope for the reference CLI.

## Protocol & docs

- Protocol spec: [`SPEC.md`](SPEC.md)
- Declaration JSON Schema: [`seip.schema.json`](seip.schema.json)
- Whitepaper: [`docs/SEIP_WHITEPAPER_FINAL.md`](docs/SEIP_WHITEPAPER_FINAL.md)
- Diagrams (D2/PNG/SVG): [`docs/diagrams/`](docs/diagrams/)

## License

Apache-2.0
