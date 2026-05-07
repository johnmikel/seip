# Operational Adoption Release Design

## Context

SEIP already has the core pieces of an adoption-ready package: a protocol specification, a whitepaper, a runnable reference CLI, a full workflow demo, diagrams, notification adapters, and tests. The release should now be optimized for platform and data engineering teams that need to evaluate whether SEIP can be adopted in an existing GitHub/CI workflow.

## Audience

The primary audience is a platform, data platform, or API governance team that owns shared schema-change process across producer and consumer teams.

The secondary audience is a downstream service owner who needs to understand why a SEIP declaration asks them to review, validate, acknowledge, object, or request more time.

## Release Goal

Create a shippable operational adoption package where a team can:

- read the paper to understand the problem, model, boundaries, and lifecycle;
- run the demo locally and see an end-to-end producer/consumer workflow;
- copy a CI template or README path into their own repository;
- understand the full use case through concrete producer, consumer, notification, negotiation, enforcement, and audit steps;
- verify the package with documented commands.

## Package Shape

The release package is an operational adoption package, not a formal standards submission or marketing launch.

The core artifact set is:

- `README.md` as the adoption entry point.
- `SPEC.md` as the protocol contract.
- `docs/SEIP_WHITEPAPER_FINAL.md` and `docs/SEIP_WHITEPAPER_FINAL.docx` as the paper.
- `docs/DEMO_RUNBOOK.md` as the presenter and evaluator guide.
- `examples/full-workflow.mjs` as the canonical full demonstration.
- `examples/github-actions-template.yml` as a copyable CI starting point.
- `docs/RELEASE_CHECKLIST.md` as the release gate and evidence checklist.
- `test/demo.test.mjs` plus the existing test suite as executable regression evidence.

## Required Story

The package should consistently tell one use case:

`ledger-api` wants to change `transaction.value` from decimal major units to integer minor units. SEIP catches the lossy retype in CI, forces a declaration, surfaces the same declaration through GitHub and Slack adapters, records consumer responses, handles an objection from `risk-service`, extends the timeline, accepts the change after acknowledgements, moves into enforcement, closes as completed, and preserves the audit trail in Git.

## Design Constraints

- Git remains the canonical declaration state store.
- Notification adapters render or deliver payloads; they are not alternate state stores.
- The CLI and docs must not claim universal consumer validation. `validate-consumer` is a reference hook that real teams connect to local tests, parsers, dbt models, queries, or contract checks.
- The GitHub adapter emits Markdown; it does not call the GitHub API.
- The demo must be safe to run locally and must not require real Slack, GitHub, database, or network credentials.
- CI examples must avoid hypothetical package names and should reflect the current repository/package state.

## Success Criteria

1. `README.md` gives a clear adopter path from problem to demo to CI adoption.
2. `docs/DEMO_RUNBOOK.md` matches the actual demo output and explains the full use case.
3. `docs/SEIP_WHITEPAPER_FINAL.md` claims match the implemented CLI and demo.
4. `examples/github-actions-template.yml` is practical and does not contain hypothetical install instructions.
5. Local generated demo artifacts are either ignored, removed from release state, or clearly intentional.
6. `docs/RELEASE_CHECKLIST.md` maps release claims to concrete files and commands.
7. `npm test` and `npm run demo` pass from the repository root.

## Verification Plan

The release is not complete until the following evidence exists:

- `npm test` passes.
- `npm run demo` exits successfully.
- `git status --short` contains only intentional release files.
- The README, whitepaper, runbook, and demo all describe the same canonical use case.
- The CI template can be read as a realistic starting point for adopters.

## Open Risks

- The package is not yet a formal npm publishing release unless `package.json` naming, install instructions, and publish workflow are finalized.
- Consumer validation remains a reference hook. The release must be honest about this while showing where teams plug in their own validators.
- The Word export may need regeneration if the markdown whitepaper changes.
