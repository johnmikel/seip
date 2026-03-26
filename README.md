# seip — Schema Evolution Intent Protocol

**Stop shipping surprise breaking schema changes.**

SEIP is a Git-native protocol and reference CLI for coordinating schema changes across teams. It makes breaking changes explicit, reviewable, enforceable in CI, and auditable over time.

The canonical state lives in `.seip/declarations/*.json`. Git is the source of truth. CI reads those declarations. Teams and automation can consume the same state through the repo or machine-readable CLI output.

No SEIP-owned server required. No central SEIP database required. The reference implementation assumes the Git and CI infrastructure teams already have.

## What You Get

- CI can distinguish an approved breaking change from an undeclared one.
- Producer and consumer teams get a shared lifecycle instead of scattered messages and tribal knowledge.
- Automation can participate through JSON files and `--json` CLI output.

## Why It Matters

Schema coordination usually already exists. The problem is that it is fragmented across pull requests, tickets, chat, and release notes. SEIP adds one shared artifact for the change itself: a declaration that humans, CI, and automation can all inspect.

That makes three useful things possible:

- a CI gate can fail undeclared breaking changes before merge
- downstream consumers get a clear review and response flow
- audit history survives beyond transient coordination threads

## How It Works

1. Detect a schema diff with `seip diff`.
2. Create a declaration with `seip create`.
3. Propose it for review with `seip propose`.
4. Let CI enforce coverage with `seip validate`.
5. Record consumer responses and audit history with `seip respond` and `seip log`.

The lifecycle diagram source lives in `docs/diagrams/lifecycle.d2`, and the canonical model diagram source lives in `docs/diagrams/canonical-model.d2`.

## Where SEIP Fits

SEIP itself is not a webhook platform. It defines the declaration and lifecycle. Notifications, dashboards, and cross-repository coordination can be built around that canonical state.

The current reference CLI is repo-local: it reads and writes declarations where the canonical file is available. Cross-repository synchronization is adapter or workflow territory, not hidden protocol magic.

## 30-Second Start

```bash
npx seip init
npx seip diff schema-v1.json schema-v2.json
npx seip create \
  --id seip_rename_institution \
  --summary "Rename institution field" \
  --breaking \
  --strategy dual_write \
  --from-diff schema-v1.json schema-v2.json \
  --consumer analytics \
  --consumer risk
npx seip propose seip_rename_institution
npx seip validate schema-v1.json schema-v2.json
```

The smallest useful adoption wedge is the CI gate. Add `seip validate` first, then introduce declarations and responses once teams see value.

## Who It Helps

SEIP is most useful when:

- one producer schema affects multiple downstream teams
- breaking impact is not always visible to the producer alone
- coordination currently depends on scattered conversation
- teams want stronger governance without introducing a heavyweight platform

## Example Declaration

```json
{
  "seip_version": "0.1.0",
  "declaration_id": "seip_rename_institution",
  "status": "PROPOSED",
  "producer": {
    "team": "ledger-api"
  },
  "change": {
    "type": "rename",
    "breaking": true,
    "summary": "Rename institution to primary_financial_institution",
    "affected_objects": [
      { "object": "account_record", "property": "institution" }
    ],
    "renames": [
      {
        "object": "account_record",
        "from": "institution",
        "to": "primary_financial_institution"
      }
    ]
  },
  "migration": {
    "strategy": "dual_write"
  },
  "timeline": {
    "review_deadline": "2026-04-01T00:00:00.000Z",
    "deprecation_date": "2026-04-24T00:00:00.000Z",
    "removal_date": "2026-05-24T00:00:00.000Z"
  },
  "consumers": [
    { "team": "analytics", "status": "PENDING" },
    { "team": "risk", "status": "PENDING" }
  ],
  "responses": [],
  "events": [
    {
      "type": "CREATED",
      "at": "2026-03-25T00:00:00.000Z",
      "actor": "ledger-api",
      "to_status": "DRAFT"
    }
  ]
}
```

## Developer Experience

Humans and tools use the same model:

- humans review declarations in Git and respond through the CLI
- CI enforces policy with `seip validate`
- automation can use `--json` on commands like `diff`, `create`, `status`, `log`, `validate`, and `lint`
- audit history is available through `seip log <id>`
- invalid declaration enums and timestamps are treated as lint errors rather than silently accepted

Example:

```bash
npx seip diff schema-before.json schema-after.json --json
npx seip validate schema-before.json schema-after.json --json
npx seip status seip_rename_institution --json
```

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
| `seip lint` | Validate declaration files |
| `seip config` | Show effective config |
| `seip enforce <id>` | Mark a declaration as `ENFORCING` |
| `seip close <id>` | Close a declaration as `COMPLETED`, `WITHDRAWN`, or `REJECTED` |

## Adoption Path

1. Add `seip validate` to CI.
2. Start creating declarations for breaking changes.
3. Ask downstream teams to respond through the shared lifecycle.
4. Add dashboards or notification adapters if needed.

## Protocol Docs

- The protocol spec lives in `SPEC.md`.
- The canonical declaration schema lives in `seip.schema.json`.
- The whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.md`.
- A Word export of the whitepaper lives in `docs/SEIP_WHITEPAPER_FINAL.docx`.
- Reusable D2, PNG, and SVG diagrams live in `docs/diagrams/`.

## Run The Demo

```bash
git clone https://github.com/johnmikel/seip.git
cd seip
node examples/full-workflow.mjs
```

This runs the Aster Bank end-to-end example.

## Current Limits

- Diffing is intentionally generic and not source-system-specific.
- Rename detection is still heuristic unless explicit rename mappings are supplied.
- Notification adapters are outside the core protocol today.
- Cross-repository authorization and state synchronization are not solved automatically by the v0.1 reference CLI.

## License

Apache-2.0
