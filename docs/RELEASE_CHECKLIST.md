# SEIP Operational Release Checklist

Use this checklist before presenting SEIP as an adoption-ready paper and demo package.

## Release Scope

This release is optimized for platform and data engineering teams evaluating SEIP as a Git-native workflow for coordinating breaking schema changes.

The canonical use case is:

`ledger-api` changes `transaction.value` from decimal major units to integer minor units. SEIP detects the lossy retype, requires a declaration, surfaces the declaration through GitHub and Slack adapters, records consumer responses, handles a `risk-service` objection, extends the timeline, reaches acceptance, moves into enforcement, closes as completed, and preserves the audit trail in Git.

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Verification |
| --- | --- | --- |
| Releasable paper | `docs/SEIP_WHITEPAPER_FINAL.md`, `docs/SEIP_WHITEPAPER_FINAL.docx` | Inspect paper and confirm claims match the reference CLI boundaries. |
| Full demonstration | `examples/full-workflow.mjs` | Run `npm run demo`. |
| Full use case | `docs/DEMO_RUNBOOK.md` | Confirm the runbook covers producer, CI, declaration, GitHub, Slack, consumers, objection, negotiation, enforcement, closure, and audit. |
| Adoption entry point | `README.md` | Confirm the README has an adoption path, quick start, demo link, CI link, and limitations. |
| CI adoption starting point | `examples/github-actions-template.yml` | Confirm the workflow uses `seip`, not a hypothetical package name, and explains local/vendored usage. |
| Protocol contract | `SPEC.md`, `seip.schema.json` | Confirm lifecycle, declaration model, validation rules, adapters, and non-goals are documented. |
| Executable regression evidence | `test/*.mjs`, `test/demo.test.mjs` | Run `npm test`. |
| Demo run safety | `docs/DEMO_RUNBOOK.md`, `examples/full-workflow.mjs` | Confirm the demo writes to `/tmp/seip-full-blown-demo` by default, supports `SEIP_DEMO_DIR` for isolation, and uses Slack dry-run/mock delivery. |
| Local artifact hygiene | `.gitignore`, `git status --short` | Confirm generated `.seip/` and `.seip-demo/` state is ignored in this tool repo. |

## Release Gates

Run from the repository root:

```bash
npm test
npm run demo
SEIP_DEMO_DIR=/tmp/seip-demo-isolated npm run demo
git status --short
```

Expected evidence:

- `npm test` reports all tests passing.
- `npm run demo` exits `0`.
- `SEIP_DEMO_DIR=/tmp/seip-demo-isolated npm run demo` exits `0` when an isolated workspace is needed.
- Demo output includes `SEIP Full-Blown Demo`, `UNDER_REVIEW`, `ACCEPTED`, `COMPLETED`, and `No SEIP server, database, or notification state store required.`
- `git status --short` contains only intentional release files and known local experimental files.

## Known Non-Goals For This Release

- Publishing to npm.
- Sending real Slack messages during the demo.
- Calling the GitHub API directly from the GitHub adapter.
- Providing a universal consumer validation engine.
- Providing a universal cross-repository authorization or state synchronization service.

## Claim Boundaries

Use these exact boundaries in presentations and adoption conversations:

- SEIP stores canonical declaration state in Git.
- SEIP can render notification payloads, but delivery belongs to GitHub, Slack, CI, or internal tooling.
- `validate-consumer` is a reference hook that teams wire to their own checks.
- The reference diff is intentionally generic and does not replace domain-specific contract tests.
- The operational adoption wedge is CI first, then declarations, reviews, notifications, and stricter policy.
