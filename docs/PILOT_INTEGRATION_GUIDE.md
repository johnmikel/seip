# SEIP Pilot Integration Guide

Use this guide when moving from SEIP demos to a real pilot with one producer repository and at least two downstream consumer repositories.

## Pilot Goal

Prove that SEIP can coordinate one real breaking schema change through Git, CI, consumer validation, review, enforcement, and closure without introducing a central service.

The pilot is successful when:

- CI blocks an undeclared breaking schema change.
- The producer creates a valid SEIP declaration for the breaking change.
- At least two consumers run their own validation commands before responding.
- The declaration records `ACKNOWLEDGED`, `OBJECTED`, or `EXTENSION_REQUESTED` responses with evidence.
- The team resolves review state and reaches either `ACCEPTED`, `COMPLETED`, `WITHDRAWN`, or `REJECTED`.
- The final audit history is understandable from Git alone.

## Recommended Pilot Shape

Start with one producer and two to five consumers.

Good producer candidates:

- An event schema repository used by several services.
- A public or partner API contract repository.
- A data warehouse model repository with downstream dashboards or ML jobs.

Good consumer candidates:

- One application or API consumer.
- One analytics, dbt, warehouse, or reporting consumer.
- One batch, ML, fraud, risk, or reconciliation consumer if available.

Avoid the first pilot on a politically sensitive migration, a schema with unclear ownership, or a change already near production release. The goal is to evaluate the operating model under real constraints, not to rescue a late migration.

## Setup

In the producer repository:

```bash
npx seip init
```

Add a CI gate:

```yaml
- name: Validate schema changes
  run: npx seip validate schema-v1.json schema-v2.json --strict
```

For local or vendored usage before package publishing, replace `npx seip` with:

```bash
node ./bin/seip.mjs
```

## Producer Workflow

1. Make the schema change in a branch.
2. Run `seip diff <before> <after> --strict`.
3. If the change is breaking, create a declaration with explicit consumers:

```bash
npx seip create \
  --id seip_checkout_completed_v3 \
  --summary "Coordinate CheckoutCompleted v3 rollout" \
  --type retype \
  --breaking \
  --strategy dual_write \
  --producer commerce-events \
  --consumer partner-api \
  --consumer warehouse-dbt \
  --consumer fraud-models \
  --from-diff schema-v2.json schema-v3.json
```

4. Propose the declaration:

```bash
npx seip propose seip_checkout_completed_v3 --actor commerce-events
```

5. Attach the GitHub notification output to the PR or Actions summary:

```bash
npx seip notify seip_checkout_completed_v3 \
  --adapter github \
  --repo-url https://github.com/acme/commerce-events
```

## Consumer Workflow

Each consumer wires SEIP to a validation command it already owns.

Examples:

```bash
npx seip validate-consumer seip_checkout_completed_v3 \
  --against ./src/contracts \
  --command "npm test -- --contract checkout-completed-v3"
```

```bash
npx seip validate-consumer seip_checkout_completed_v3 \
  --against ./models \
  --command "dbt build --select exposure:checkout_completed"
```

```bash
npx seip validate-consumer seip_checkout_completed_v3 \
  --against ./replay \
  --command "python replay_checkout_fixture.py"
```

Then respond:

```bash
npx seip respond seip_checkout_completed_v3 \
  --team warehouse-dbt \
  --status EXTENSION_REQUESTED \
  --message "dbt exposure passes after the compatibility view lands; requesting two extra weeks."
```

## CI Policy Progression

Begin with visibility, then tighten.

1. Fail undeclared breaking changes.
2. Require a declaration for each breaking change.
3. Require declaration status to be at least `PROPOSED`.
4. Require named consumers to respond before merge.
5. Require `ACCEPTED` before enforcement.
6. Require closure evidence before removing backward-compatible fields or dual-write paths.

## Agentic Actor Boundary

Agents can add value in the pilot if they are treated as evidence-producing actors rather than silent approvers.

Useful agent tasks:

- Run `seip diff --json` and summarize compatibility risk.
- Draft a declaration from diff output.
- Open or update a PR comment with `seip notify --adapter github`.
- Run consumer validation commands in a sandboxed branch.
- Summarize objections and extension requests.
- Check whether declaration lifecycle state matches CI policy.

Do not let agents auto-approve a breaking change unless the organization has explicitly authorized that policy. A good pilot records agent-generated evidence but keeps lifecycle authority visible.

## Pilot Review

At the end of the pilot, review these artifacts:

- The schema-changing PR.
- `.seip/declarations/<id>.json`.
- CI logs from both failing and passing states.
- Consumer validation command output.
- Consumer response messages.
- Final `seip status <id> --json`.
- Final `seip log <id> --json`.

The adoption decision should be based on whether SEIP reduced ambiguity and created useful enforcement, not whether it eliminated all migration work.

