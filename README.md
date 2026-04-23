# seip — Schema Evolution Intent Protocol

**Stop shipping surprise breaking schema changes.**

SEIP is a Git-native protocol and reference CLI for coordinating schema changes across producer and consumer teams. It makes breaking changes explicit, reviewable, enforceable in CI, and auditable over time.

The canonical state lives in `.seip/declarations/*.json`. Git is the source of truth. CI reads those declarations. GitHub pull requests, Actions, subscriptions, Slack channels, dashboards, and agents can surface the same state through pluggable adapters.

SEIP is not a notification platform. The reference CLI can emit GitHub Markdown or Slack Block Kit payloads, but delivery remains the job of GitHub, Slack, CI, or your internal tooling.

## What You Get

- **Lossy type detection:** CI can distinguish safe additions or widening retypes from lossy type changes.
- **Git-native declarations:** Breaking intent, timelines, consumers, responses, and audit events live in version control.
- **Policy enforcement:** `seip validate` fails undeclared breaking changes before merge.
- **Consumer responses:** Downstream teams can acknowledge, object, or request extensions through a shared lifecycle.
- **Pluggable notifications:** `seip notify` renders GitHub PR/Actions Markdown or Slack payloads from the same declaration.

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
npx seip validate-consumer seip_retype_value --against ./src/queries/
npx seip respond seip_retype_value \
  --team payments-api \
  --status ACKNOWLEDGED \
  --message "Compatible."
```

### 4. Consumer B Objects

```bash
npx seip validate-consumer seip_retype_value --against ./models/
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

## Protocol Docs

- The protocol spec lives in `SPEC.md`.
- The canonical declaration schema lives in `seip.schema.json`.
- The whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.md`.
- A Word export of the whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.docx`.
- Reusable D2, PNG, and SVG diagrams live in `docs/diagrams/`.

## Current Limits

- Diffing is intentionally generic and not source-system-specific.
- Rename detection is heuristic unless explicit rename mappings are supplied.
- Notification adapters emit payloads; the GitHub adapter does not call the GitHub API.
- Cross-repository authorization and state synchronization are organization-specific.

## License

Apache-2.0
