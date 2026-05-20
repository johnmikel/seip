# seip — Schema Evolution Intent Protocol

**Stop shipping surprise breaking schema changes.**

SEIP is a Git-native protocol and reference CLI for coordinating schema changes across producer and consumer teams. It makes breaking changes explicit, reviewable, enforceable in CI, and auditable over time.

The canonical state lives in `.seip/declarations/*.json`. Git is the source of truth. CI reads those declarations. GitHub pull requests, Actions, subscriptions, Slack channels, dashboards, and agents can surface the same state through pluggable adapters.

SEIP is not a notification platform. The reference CLI can emit GitHub Markdown or Slack Block Kit payloads, but delivery remains the job of GitHub, Slack, CI, or your internal tooling.

## What You Get

- **Compatibility-risk detection:** CI can distinguish safe additions or widening retypes from lossy type changes, requiredness tightening, nullability tightening, enum narrowing, and format changes.
- **JSON Schema support:** The reference diff accepts SEIP object/table fixtures and common JSON Schema object inputs, including local `$ref`, `$defs`, nested object fields, array item fields, and simple `allOf` composition.
- **Git-native declarations:** Breaking intent, timelines, consumers, responses, and audit events live in version control.
- **Policy enforcement:** `seip validate` fails undeclared breaking changes before merge.
- **Consumer responses:** Downstream teams can acknowledge, object, or request extensions through a shared lifecycle.
- **Pluggable notifications:** `seip notify` renders GitHub PR/Actions Markdown or Slack payloads from the same declaration.

## Adoption Path

For platform and data engineering teams, the smallest useful rollout is:

1. Run the full workflow demo with `npm run demo`.
2. Run the enterprise stress demo with `npm run demo:enterprise` when you need to show API, data, analytics, and ML consumers in one rollout.
3. Add `seip validate` as a CI gate for schema changes.
4. Require a SEIP declaration for breaking changes.
5. Surface declarations in GitHub or Slack using `seip notify`.
6. Require affected consumers to acknowledge, object, or request more time before enforcement.

The canonical quick demo script is `examples/full-workflow.mjs`, the enterprise demo script is `examples/enterprise-workflow.mjs`, presenter guides live in `docs/DEMO_RUNBOOK.md` and `docs/ENTERPRISE_DEMO_RUNBOOK.md`, and a starter GitHub Actions workflow lives in `examples/github-actions-template.yml`.

## 30-Second Start

```bash
npx seip init
npx seip diff schema-v1.json schema-v2.json --strict
npx seip create \
  --id seip_retype_value \
  --summary "Convert transaction.value from float to integer" \
  --type retype \
  --breaking \
  --strategy dual_write \
  --from-diff schema-v1.json schema-v2.json \
  --consumer payments-api \
  --consumer risk-service
npx seip propose seip_retype_value
npx seip notify seip_retype_value --adapter github --repo-url https://github.com/acme/ledger-api
npx seip validate schema-v1.json schema-v2.json --strict
```

When working from a local clone before publishing or installing the package, replace `npx seip` with `node ./bin/seip.mjs`.

## Example Two-Consumer Workflow

### 1. Producer Proposes

The producer creates a declaration for a breaking type change and proposes it:

```bash
npx seip propose seip_retype_value --actor ledger-api
```

### 2. GitHub Or Slack Surfaces It

Generate Markdown for a PR comment or GitHub Actions summary:

```bash
npx seip notify seip_retype_value \
  --adapter github \
  --repo-url https://github.com/acme/ledger-api
```

Generate a Slack payload:

```bash
npx seip notify seip_retype_value \
  --adapter slack \
  --webhook "$SLACK_SCHEMA_WEBHOOK" \
  --repo-url https://github.com/acme/ledger-api
```

### 3. Consumer A Acknowledges

```bash
npx seip validate-consumer seip_retype_value \
  --against ./src/queries/ \
  --command "npm test -- --schema-change"
npx seip respond seip_retype_value \
  --team payments-api \
  --status ACKNOWLEDGED \
  --message "Compatible."
```

### 4. Consumer B Objects

```bash
npx seip validate-consumer seip_retype_value \
  --against ./models/ \
  --command "npm test -- --schema-change"
npx seip respond seip_retype_value \
  --team risk-service \
  --status OBJECTED \
  --message "Precision loss breaks fraud model."
```

Because a consumer objected, the declaration enters `UNDER_REVIEW`. CI can block the producer's PR until the declaration reaches the required status.

## Commands

| Command | What it does |
|---------|-------------|
| `seip init` | Set up `.seip/` in your repo |
| `seip diff <before> <after>` | Compare two schema JSON files |
| `seip create [opts]` | Create a declaration |
| `seip propose <id>` | Move a declaration to `PROPOSED` |
| `seip respond <id> --team <t>` | Record a consumer response |
| `seip status [id]` | Show declaration status |
| `seip log <id>` | Show audit history |
| `seip validate <before> <after>` | Fail CI on undeclared breaking changes |
| `seip validate-consumer <id>` | Run a consumer-side validation hook |
| `seip notify <id>` | Emit GitHub/Slack notification payloads |
| `seip lint` | Validate declaration files |
| `seip config` | Show effective config |
| `seip enforce <id>` | Mark a declaration as `ENFORCING` |
| `seip close <id>` | Close a declaration as `COMPLETED`, `WITHDRAWN`, or `REJECTED` |

## Notification Adapters

SEIP separates state from delivery.

- `--adapter github` emits Markdown suitable for a PR comment or `$GITHUB_STEP_SUMMARY`.
- `--adapter slack` emits/posts a Slack Block Kit payload.
- `--dry-run` builds the payload without sending network requests.
- `--json` emits machine-readable adapter output for automation.

Example:

```bash
npx seip notify seip_retype_value \
  --adapter github \
  --repo-url https://github.com/acme/ledger-api \
  --json
```

## GitHub Action

Use the bundled composite action when SEIP is checked out as a repository action:

```yaml
- uses: your-org/seip@v0.2
  with:
    before-schema: schemas/schema-before.json
    after-schema: schemas/schema-after.json
    seip-args: --strict
```

For vendored or unpublished usage, call the CLI directly as shown in `examples/github-actions-template.yml`.

## Protocol Docs

- The protocol spec lives in `SPEC.md`.
- The canonical declaration schema lives in `seip.schema.json`.
- The whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.md`.
- A Word export of the whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.docx`.
- Reusable D2, PNG, and SVG diagrams live in `docs/diagrams/`.

## Run The Full-Blown Demo

```bash
npm run demo
```

The demo creates a process-isolated disposable repo under `/tmp/seip-full-blown-demo-<pid>` and walks through a complete SEIP lifecycle: CI failure on an undeclared lossy retype, declaration creation, GitHub PR/Actions notification output, Slack dry-run output, consumer validation, objection, negotiation, acceptance, enforcement, closure, and audit history. Its CI policy requires an `ACCEPTED` declaration and acknowledgements from the demo consumers before the final validation passes.

For presenter notes, expected output, troubleshooting, and payload reuse examples, see `docs/DEMO_RUNBOOK.md`.

## Run The Enterprise Demo

```bash
npm run demo:enterprise
```

The enterprise demo creates a disposable `CheckoutCompleted.v3` rollout under `/tmp/seip-enterprise-demo-<pid>`. It exercises nested JSON Schema diffing, multiple breaking-change classes, command-based consumer validation evidence, API contract failure, ML replay failure, dbt extension requests, pending analytics consumers, negotiation, acceptance, enforcement, closure, and audit history.

For the complex walkthrough, use `docs/ENTERPRISE_DEMO_RUNBOOK.md`.

## Release Evidence

Use `docs/RELEASE_CHECKLIST.md` to audit the paper, demo, CI template, tests, and known non-goals before presenting or adopting this release.

## Current Limits

- Diffing is intentionally generic. It supports SEIP object/table fixtures and common JSON Schema object inputs, but it is not a full dialect-specific compatibility engine.
- Rename detection is heuristic unless explicit rename mappings are supplied.
- `validate-consumer` is a reference hook; it verifies the consumer target exists, can run a supplied local command for parsers, queries, dbt models, contract tests, model checks, or other team-owned validation, and can record `CONSUMER_VALIDATED` evidence.
- Notification adapters emit payloads; the GitHub adapter does not call the GitHub API.
- Cross-repository authorization and state synchronization are organization-specific.

## License

Apache-2.0
