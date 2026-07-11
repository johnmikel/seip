# SEIP Production v1 Design

**Status:** Approved for specification review

**Date:** 2026-07-11

**Target:** `seip` package v1 and SEIP protocol v1

**Current baseline:** package v0.2.0, protocol v0.1

## Summary

SEIP v1 will be a governance-first, Git-native schema change-control protocol and toolkit. It will bind detected breaking changes to exact, deterministic change fingerprints; require a versioned change declaration containing migration intent, timelines, consumer acknowledgements, and validation evidence; and let CI enforce an organization's chosen review policy before merge.

SEIP's differentiator is change intent and producer-consumer coordination. It will not attempt to become a universal schema compatibility engine. A conservative JSON Schema detector will provide a useful default, while a normalized change-set contract will let specialist tools such as oasdiff, Buf, Avro tooling, dbt checks, and SQL analyzers provide detection results.

The v1 release is intentionally allowed to break the unpublished v0.2 programmatic API, CLI details, configuration shape, and v0.1 declaration format. A migration command and guide will support existing repository declarations.

## Canonical Product Language

The primary promise is:

> Make breaking schema changes deliberate, reviewable, and enforceable before merge.

The canonical description is:

> SEIP is a Git-native schema change-control protocol and toolkit. It binds detected breaking changes to a versioned declaration containing migration intent, timelines, consumer acknowledgements, and validation evidence, then lets CI enforce the organization's review policy before merge.

Documentation and interfaces will use the following terms consistently:

- **Change set:** machine-produced normalized schema differences.
- **Change declaration:** the Git-tracked artifact describing intent and coordination state.
- **Consumer acknowledgement:** a human or team decision.
- **Validation evidence:** a machine-produced result or artifact reference.
- **Exact change coverage:** a declaration containing the deterministic fingerprint of a detected change.
- **Detector:** a component that converts format-specific schema inputs into a normalized change set.
- **Policy evaluation:** the decision that determines whether CI passes.

The documentation will describe SEIP as an artifact protocol over Git, not as a network transport protocol.

## Goals

1. A breaking or unknown change must not pass the production policy without an exact, eligible declaration.
2. Invalid, unsupported, incomplete, or indeterminate input must never be reported as "no changes."
3. Declarations, lifecycle transitions, responses, evidence, and audit history must be validated from one canonical protocol schema and a small set of explicit semantic invariants.
4. The library, CLI, and GitHub Action must evaluate the same core rules and produce stable structured diagnostics.
5. The package must expose a small typed API with explicit module boundaries.
6. Local persistence must be safe against accidental overwrite, partial writes, malformed neighboring files, and unverified history mutation.
7. Secrets and unbounded command output must not be returned, logged, or committed to declarations.
8. Release claims must be proven by CI, package-install tests, security tests, and documentation examples.

## Non-goals

SEIP v1 will not provide:

- a schema registry or centralized state service;
- a universal OpenAPI, Protobuf, Avro, SQL, GraphQL, or dbt compatibility engine;
- migration execution or rollback orchestration;
- direct GitHub pull-request state management;
- a notification state store;
- cross-repository identity, authorization, or synchronization;
- signed attestations or a remote evidence service;
- remote JSON Schema reference fetching by default;
- an adapter marketplace or plugin installer.

These boundaries keep v1 focused on trustworthy change control. External detectors and delivery systems integrate through documented data contracts.

## Design Principles

- **Fail closed:** uncertainty is represented explicitly and blocks under production policy.
- **Exact over heuristic:** coverage uses fingerprints, not a matching property name or broad change type.
- **One source of truth:** the protocol JSON Schema is canonical; runtime validation and TypeScript types are generated from it.
- **Pure core, explicit effects:** lifecycle and policy functions do not access the filesystem, network, environment, or process state.
- **Immutable transitions:** core operations return new values and never partially mutate input.
- **Append-only evidence:** responses, evidence, and events are appended and verified against Git history.
- **Stable automation contract:** diagnostics, JSON output, and exit codes are versioned.
- **Conservative scope:** use specialist detectors instead of weakly reimplementing every schema dialect.
- **Preserve extensions:** unknown protocol fields survive read-transition-write cycles; custom fields should use `x_*` names.

## Package and Module Architecture

SEIP v1 remains a single npm package. A monorepo or family of separately versioned adapter packages is deferred until real integration demand exists.

The source will be split into bounded modules:

```text
src/
  core/
    canonicalize.ts
    declaration.ts
    diagnostics.ts
    fingerprint.ts
    lifecycle.ts
    policy.ts
    protocol-version.ts
  detectors/
    contract.ts
    json-schema.ts
  generated/
    protocol-types.ts
    protocol-validator.ts
  node/
    command-runner.ts
    file-store.ts
    git-history.ts
    slack-delivery.ts
  notify/
    github-markdown.ts
    model.ts
    slack-payload.ts
  cli/
    commands/
    main.ts
  index.ts
bin/
  seip.mjs
```

The generated types and standalone validator come from `seip.schema.json`. Generation runs at build time and CI fails when generated output is stale. Development dependencies may include a strict JSON Schema validator/compiler and type generator; the published package should preserve zero runtime dependencies unless a later measured requirement justifies changing that constraint.

The public exports are:

- `seip` for pure protocol, detector, lifecycle, fingerprint, and policy APIs;
- `seip/node` for file storage, command execution, Git-history verification, and explicit network delivery;
- `seip/notify` for pure GitHub and Slack rendering;
- `seip/schema` for the canonical protocol schema and generated types.

Deep imports outside the exports map are unsupported.

## Data Flow

The primary validation flow is:

```text
before/after schema inputs
        |
        v
format-specific detector
        |
        v
normalized change set + completeness metadata + diagnostics
        |
        v
deterministic change fingerprints
        |
        v
protocol-valid declarations + optional base-branch declarations
        |
        v
history verification + policy evaluation
        |
        v
structured pass/fail result
```

An external detector may enter at the normalized change-set boundary. The policy engine does not need to know how a change was discovered.

## Canonical Protocol Model

The v1 protocol uses `protocol_version` rather than the ambiguous v0.1 `seip_version`. Package version and protocol version are independent semver values and are documented separately.

A declaration contains:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `protocol_version` | required | Protocol semver. v1 tools accept supported `1.x` declarations. |
| `declaration_id` | required | Safe, stable file identifier. |
| `created_at` | required | RFC 3339 date-time. |
| `status` | required | Current lifecycle status. |
| `producer` | required | Owning team and optional contact. |
| `changes` | required | One or more exact normalized changes with valid fingerprints. |
| `intent` | required | Summary, rationale, migration, rollback, and timeline. |
| `consumers` | required | Unique declared consumer teams. May be empty. |
| `responses` | required | Append-only consumer decisions. |
| `evidence` | required | Append-only machine validation evidence. |
| `events` | required | Append-only lifecycle and material-update history. |

The protocol permits unknown fields for forward compatibility. Tools must preserve them. Custom extensions should use names such as `x_ticket_url` or `x_company_policy`.

### Illustrative declaration

```json
{
  "protocol_version": "1.0.0",
  "declaration_id": "seip_transaction_value_minor_units",
  "created_at": "2026-07-11T09:00:00.000Z",
  "status": "DRAFT",
  "producer": {
    "team": "ledger-api",
    "contact": "#ledger-api"
  },
  "changes": [
    {
      "change_id": "chg_sha256_0123456789abcdef",
      "fingerprint_version": "1",
      "schema_kind": "json-schema",
      "target": {
        "object": "transaction",
        "path": "value"
      },
      "kind": "retype",
      "compatibility": "breaking",
      "before": { "type": "number" },
      "after": { "type": "integer" }
    }
  ],
  "intent": {
    "summary": "Store transaction value in minor units",
    "rationale": "Remove floating-point ambiguity",
    "migration": {
      "strategy": "dual_write",
      "steps": ["Write both representations", "Migrate consumers"],
      "rollback": "Continue reading the original field"
    },
    "timeline": {
      "review_deadline": "2026-07-18T17:00:00.000Z",
      "target_enforcement_at": "2026-08-01T09:00:00.000Z",
      "deprecation_at": "2026-08-15T09:00:00.000Z",
      "removal_at": "2026-09-01T09:00:00.000Z"
    }
  },
  "consumers": [
    { "team": "payments-api" },
    { "team": "risk-service" }
  ],
  "responses": [],
  "evidence": [],
  "events": [
    {
      "event_id": "evt_01900000-0000-7000-8000-000000000001",
      "type": "CREATED",
      "at": "2026-07-11T09:00:00.000Z",
      "actor": "ledger-api",
      "from_status": null,
      "to_status": "DRAFT"
    }
  ]
}
```

The full hash is used in real `change_id` values; the example is abbreviated for readability.

### Responses and evidence

Consumers do not store a second mutable `status` field. Current consumer state is derived from the latest valid response for each team, eliminating disagreement between `consumers[]` and `responses[]`.

A response includes a stable response ID, team, decision, message, actor, and RFC 3339 timestamp. Allowed decisions are `ACKNOWLEDGED`, `OBJECTED`, and `EXTENSION_REQUESTED`.

Evidence is distinct from acknowledgement. An evidence entry includes an evidence ID, consumer team, validator identity, result (`PASSED` or `FAILED`), timestamp, short summary, and optional artifact URI plus digest. Raw command output and credentials are not protocol fields.

## Change Normalization and Fingerprints

Every detected change has:

- `schema_kind`;
- `target.object` and `target.path`;
- `kind`;
- `before` and `after` normalized snapshots;
- `compatibility`: `compatible`, `breaking`, or `unknown`;
- `change_id` and `fingerprint_version`.

`change_id` is computed as:

```text
chg_sha256_<hex SHA-256 of canonical JSON>
```

The fingerprint input is:

```json
{
  "fingerprint_version": "1",
  "schema_kind": "...",
  "target": { "object": "...", "path": "..." },
  "kind": "...",
  "before": {},
  "after": {}
}
```

Compatibility classification, detector name, and detector version are excluded from the hash. The same semantic before/after change therefore retains its identity if classification improves. The change set separately records detector name, version, and completeness.

Canonical JSON recursively sorts object keys. Detectors normalize semantically unordered collections, such as JSON Schema `required` and `enum`, before hashing; arrays whose order has meaning retain their order. Policy recomputes every fingerprint and rejects mismatches.

A declaration may contain multiple changes. Every current breaking or unknown change must appear exactly in an eligible declaration. Broad matches on object, property, or change type do not count. Multiple active declarations covering the same change produce an ambiguity diagnostic rather than nondeterministic selection.

## Detector Contract

A detector returns:

```ts
interface DetectionResult {
  ok: boolean;
  changes: NormalizedChange[];
  diagnostics: Diagnostic[];
  metadata: {
    detector: string;
    version: string;
    schemaKind: string;
    completeness: "complete" | "partial";
  };
}
```

Invalid syntax, unreadable input, unsupported root structure, or a detector unable to determine whether its traversal was complete is an operational error. It must not return an empty successful result.

A normalized change whose compatibility cannot be classified uses `unknown`. Production policy treats `unknown` as breaking. This allows explicit coordination without misrepresenting the detector's confidence.

### Built-in JSON Schema detector

The built-in detector supports a documented subset of JSON Schema 2020-12:

- object properties and required fields;
- scalar and union types;
- nullability;
- enums and formats;
- nested objects and array items;
- local JSON Pointer references through `$ref`;
- `$defs` and legacy `definitions`;
- simple `allOf` composition.

It must use path-local cycle detection or memoization, merge all `allOf` branches without overwriting earlier properties, and treat rename detection only as a suggestion. A rename becomes authoritative only through explicit mapping or an external detector with format-specific certainty.

Unsupported constructs that could hide affected fields, including unhandled `oneOf`, `anyOf`, conditional schemas, or remote references, produce a partial/incomplete diagnostic. The coordinated policy rejects incomplete detection. Remote references are never fetched implicitly.

Compatibility is based on known-safe widening rules. Any removed allowed value, added constraint, unknown retype, or otherwise unproven transition is `breaking` or `unknown`, never assumed compatible.

## Lifecycle

The lifecycle states remain:

- `DRAFT`
- `PROPOSED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `ENFORCING`
- `COMPLETED`
- `WITHDRAWN`
- `REJECTED`

Allowed transitions are:

| From | To | Preconditions |
| --- | --- | --- |
| `DRAFT` | `PROPOSED` | Declaration is valid. |
| `DRAFT` | `WITHDRAWN` | Reason and actor are recorded. |
| `PROPOSED` | `UNDER_REVIEW` | An objection or extension request is recorded. |
| `PROPOSED` | `ACCEPTED` | Explicit accept; every declared consumer's latest response is `ACKNOWLEDGED`, or there are no consumers. |
| `PROPOSED` | `WITHDRAWN` | Reason and actor are recorded. |
| `PROPOSED` | `REJECTED` | Reason and actor are recorded. |
| `UNDER_REVIEW` | `ACCEPTED` | Explicit accept; all objections/extensions have later acknowledgements. |
| `UNDER_REVIEW` | `WITHDRAWN` | Reason and actor are recorded. |
| `UNDER_REVIEW` | `REJECTED` | Reason and actor are recorded. |
| `ACCEPTED` | `ENFORCING` | Explicit producer action. |
| `ACCEPTED` | `WITHDRAWN` | Reason and actor are recorded before enforcement begins. |
| `ENFORCING` | `COMPLETED` | Explicit completion action. |

`COMPLETED`, `WITHDRAWN`, and `REJECTED` are terminal. No operation may append a lifecycle transition from a terminal state.

Responses are accepted only in `PROPOSED` or `UNDER_REVIEW`. An objection or extension request moves `PROPOSED` to `UNDER_REVIEW`. A later acknowledgement from the same consumer resolves that consumer's prior objection or extension request, but acknowledgements never auto-accept the declaration. Acceptance is always explicit and records the accepting actor.

Status must agree with the latest lifecycle event. Events and responses must be chronologically valid and internally consistent. Consumer teams are unique.

## Policy Engine

SEIP v1 provides three named presets:

| Preset | Behavior |
| --- | --- |
| `advisory` | Reports compatible, breaking, unknown, and uncovered changes without failing for policy reasons. Invalid or incomplete input still exits as an operational error. |
| `declared` | Requires every breaking or unknown change to have exact coverage by a valid declaration at `PROPOSED` or later. `WITHDRAWN` and `REJECTED` declarations are ineligible. |
| `coordinated` | Requires exact coverage by a declaration at `ACCEPTED`, `ENFORCING`, or `COMPLETED`, all declared acknowledgements, complete detection, and intact Git history. |

`coordinated` is the default for `seip validate` and the GitHub Action. The explicit default keeps the README quick start and actual enforcement behavior aligned.

Optional policy can require validation evidence from every declared consumer or a configured subset. Evidence and acknowledgement remain separate requirements.

Completed declarations may cover the exact change they coordinated, such as the final removal of a deprecated field. They cannot cover a later retype or removal with a different before/after snapshot because its fingerprint differs.

Configuration is validated against its own schema. Unknown preset names, statuses, consumer teams, or unsupported options are configuration errors, not uncovered-change errors.

## Public Library API

The pure API is immutable and independent of Node filesystem or process state:

```ts
detectChanges(input): DetectionResult
validateDeclaration(value): ValidationResult
evaluatePolicy(input): PolicyResult

createDeclaration(input): DeclarationResult
proposeDeclaration(declaration, actor): TransitionResult
recordConsumerResponse(declaration, response): TransitionResult
acceptDeclaration(declaration, actor): TransitionResult
startEnforcement(declaration, actor): TransitionResult
completeDeclaration(declaration, actor): TransitionResult
withdrawDeclaration(declaration, reason, actor): TransitionResult
rejectDeclaration(declaration, reason, actor): TransitionResult
```

Expected invalid data, policy failures, and invalid transitions return structured diagnostics and never partially mutate input. Programmer errors and effect-layer failures use a typed `SeipError` with stable `code`, message, safe context, and optional cause.

The Node file-store API is asynchronous and requires an explicit root. The pure core never reads `process.cwd()`, environment variables, or global configuration.

## Diagnostics and Error Semantics

All expected results use diagnostics with:

```ts
interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
  changeId?: string;
  declarationId?: string;
  hint?: string;
}
```

Stable code families include:

- `SEIP_INPUT_*`
- `SEIP_DETECTOR_*`
- `SEIP_PROTOCOL_*`
- `SEIP_LIFECYCLE_*`
- `SEIP_POLICY_*`
- `SEIP_HISTORY_*`
- `SEIP_STORAGE_*`
- `SEIP_DELIVERY_*`
- `SEIP_USAGE_*`

Human wording may improve in minor releases; diagnostic codes and JSON field meanings follow semver.

## CLI Contract

The CLI retains familiar flat commands:

- `init`
- `diff`
- `create`
- `propose`
- `respond`
- `accept`
- `status`
- `log`
- `validate`
- `validate-consumer`
- `verify-history`
- `lint`
- `notify`
- `config`
- `enforce`
- `complete`
- `withdraw`
- `reject`
- `migrate`

The ambiguous v0.2 `close --status` command is replaced by explicit terminal commands. `--help` and `--version` are first-class; unknown commands and flags are usage errors. Repeatable flags and `--flag=value` forms are parsed by a maintained parser or Node's `util.parseArgs`, not ad hoc array scanning.

Machine-readable output has one envelope:

```json
{
  "protocol_version": "1.0.0",
  "command": "validate",
  "ok": false,
  "data": {},
  "diagnostics": []
}
```

In JSON mode, stdout contains exactly one JSON document. Human diagnostics and operational failures use stderr. Color is enabled only for an interactive terminal and respects `NO_COLOR`.

Exit codes are:

- `0`: success or policy pass;
- `1`: policy violation;
- `2`: invalid input, usage, configuration, storage, detector, history, or delivery failure.

The CLI reports the true failure category. It must not label invalid declarations or detector failures as a count of "undeclared changes."

### Consumer validation commands

`validate-consumer` accepts an executable and arguments after `--`, for example:

```bash
seip validate-consumer seip_example --against ./models -- dbt build --select model
```

The command is spawned without a shell. SEIP supplies documented environment variables, enforces a configurable timeout and output limit, and does not persist raw stdout/stderr. Recorded evidence contains status, a safe summary, command identity without secrets, and an optional artifact URI/digest.

## GitHub Action

The composite Action exposes typed inputs for before schema, after schema or normalized change-set path, policy preset, configuration path, working directory, and base ref. The v0.2 free-form `seip-args` input is removed.

Inputs are passed through quoted environment variables or argument arrays; GitHub expressions are never interpolated directly into executable shell syntax. `$GITHUB_ACTION_PATH` is quoted. The Action uses a supported Node runtime, least-privilege permissions, and SHA-pinned third-party actions.

The Action publishes a structured result output and a human-readable step summary. The example workflow shows how to produce a base schema from the pull request base ref rather than pretending two manually maintained schema files are a complete integration.

## File Storage

The canonical layout remains:

```text
.seip/
  config.json
  declarations/
    <declaration_id>.json
```

The Node file store:

- validates declaration IDs before path construction;
- resolves and containment-checks paths;
- refuses to overwrite on create;
- writes a temporary sibling file, flushes it, and atomically renames it;
- supports optimistic expected-digest checks for updates;
- sorts listings deterministically;
- reports malformed files individually rather than aborting discovery;
- never silently repairs or discards invalid data.

Explicit replacement or migration operations require a distinct flag and use the same atomic path.

## Git-History Integrity

`verify-history` compares declarations from a base ref with working-tree declarations. For declarations that exist in the base:

- `declaration_id`, protocol major version, `created_at`, producer team, and exact `changes[]` are immutable;
- `responses[]`, `evidence[]`, and `events[]` must retain the base array as an exact prefix;
- status must follow a valid newly appended event;
- a base declaration may not disappear;
- accepted or terminal intent and consumers are frozen;
- material changes to intent or consumers while reviewable require an appended `DECLARATION_UPDATED` event.

The coordinated policy requires this check when base data is available, and the GitHub Action supplies base data by default. A standalone library evaluation without base data returns a clear `history not evaluated` status; it does not falsely claim append-only verification.

## Notification and Delivery Boundaries

GitHub Markdown and Slack Block Kit generation are pure renderers over a validated declaration or notification model.

Slack delivery is an explicit Node effect. Webhooks are read from an environment variable or direct in-memory option, must use HTTPS, are never included in returned results, and are redacted from errors. Delivery supports `AbortSignal` and a default timeout. Response bodies are size-limited before being included in a safe error.

Notifications are projections, not state. They never mutate a declaration or count as acknowledgement.

## Security Model

The threat model treats schema files, declarations, Action inputs, external detector output, validation-command output, webhook responses, and repository paths as untrusted data.

Required controls include:

- file-size, nesting-depth, and change-count limits with documented defaults;
- no implicit remote reference or network resolution;
- safe path construction and containment checks;
- no shell execution for user-supplied command strings;
- no secret-bearing URL in logs, errors, JSON output, evidence, or notification targets;
- capped and redacted child-process output;
- network timeouts and cancellation;
- JSON-only stdout guarantees;
- least-privilege GitHub workflow permissions;
- dependency and provenance checks in release CI.

Authorization remains a Git-hosting and repository-review responsibility. SEIP records actors but does not claim to authenticate them.

## Legacy Migration

Protocol v0.1 declarations do not count as v1 policy coverage. v1 tools can identify and inspect them, then emit `SEIP_PROTOCOL_MIGRATION_REQUIRED`.

`seip migrate` supports:

1. read-only inspection and a migration report;
2. generation of v1 candidates into a separate output directory;
3. explicit schema inputs or a normalized change set to regenerate exact fingerprints;
4. diagnostics for intent, consumer, or timeline data that cannot be inferred;
5. a separate, atomic write step after human review.

Migration never invents acknowledgements, evidence, acceptance, or exact change snapshots. Legacy files are not overwritten by default.

## Documentation Rewrite

The following artifacts must use the canonical product language and be checked against executable behavior:

- `README.md` as the concise adoption entry point;
- `SPEC.md` as the normative protocol v1 specification using consistent MUST/SHOULD/MAY language;
- `seip.schema.json` as the canonical machine contract;
- generated API and CLI reference documentation;
- GitHub Action and base-versus-head integration guide;
- migration guide;
- threat model and security policy;
- changelog, contribution guide, and release checklist;
- whitepaper, with claims reduced or updated where they exceed verified behavior.

The quick start must exercise a real default-policy failure, declaration creation, proposal, acknowledgement, explicit acceptance, and passing validation. Documentation commands are executed in CI where practical.

A comparison guide will cover Contractual, oasdiff, Apollo GraphOS, Pact, Buf, Confluent Schema Registry, and ODCS/Data Contract CLI. It will describe direct competitors, adjacent tools, integration opportunities, and differences without unverified superiority claims.

The recommended positioning is:

> The breaking-schema-change RFC and acknowledgement gate; bring your own differ.

## Testing Strategy

The test suite includes:

### Protocol conformance

- valid and invalid fixtures generated from the canonical schema;
- runtime validator versus schema parity;
- supported and unsupported protocol versions;
- arbitrary JSON inputs that never crash validation;
- unknown-field preservation through transitions.

### Detector correctness

- type compatibility matrices, including unions and missing types;
- enum introduction, removal, widening, narrowing, replacement, and non-scalar values;
- format introduction, removal, and change;
- requiredness and nullability changes;
- repeated local references and reference cycles;
- multiple `allOf` branches;
- nested objects and array items;
- unsupported keyword and incomplete-detection cases;
- rename ambiguity;
- deterministic output and fingerprints;
- seeded property-based and fuzz tests.

### Lifecycle and policy

- every allowed and forbidden transition from every state;
- immutable inputs and terminal states;
- unique consumers and derived latest responses;
- explicit zero-consumer acceptance;
- unresolved objection and extension handling;
- exact coverage and fingerprint mismatch;
- stale completed declaration regression;
- overlapping active coverage;
- all policy presets and optional evidence requirements.

### Storage and history

- exclusive creation and atomic updates;
- optimistic digest conflicts;
- malformed neighboring files;
- traversal and containment attacks;
- prefix integrity for responses, evidence, and events;
- immutable fields, deletion, frozen accepted intent, and material-update events.

### CLI and Action

- stable JSON envelopes and exit codes;
- JSON-only stdout on every error path;
- human output snapshots without brittle ANSI assumptions;
- unknown flags, repeatable values, equals syntax, and invalid commands;
- shell-injection payloads in every Action input;
- actual Action execution, not metadata string inspection;
- child-process timeout, output cap, and secret redaction;
- Slack timeout and webhook redaction.

### Package and platform

- `npm pack` contents;
- install the tarball into a clean temporary project;
- import every public export and reject unsupported deep imports;
- generated type-consumer compilation;
- Node 20, 22, and 24;
- Linux, macOS, and Windows for core CLI smoke tests.

Initial quality gates require at least 90% line coverage and 80% branch coverage, formatting, linting, typechecking, generated-file consistency, Action validation, and package-install smoke tests.

## Release Engineering

Before publication, the repository includes:

- the canonical Apache-2.0 `LICENSE` and any required `NOTICE`;
- complete npm `repository`, `homepage`, `bugs`, `engines`, `exports`, `types`, and `files` metadata;
- a lockfile for development dependencies;
- least-privilege, SHA-pinned CI and release workflows;
- dependency review, secret scanning, static analysis, and package provenance checks;
- npm trusted publishing with provenance rather than a long-lived token;
- a changelog, security policy, contribution guide, threat model, and release checklist;
- branch rules requiring the production quality gates.

The release sequence is:

1. build and verify the package locally;
2. publish or otherwise distribute `1.0.0-rc.1` only after explicit authorization;
3. run installation and pilot acceptance tests against the release candidate;
4. resolve release-blocking defects;
5. publish `1.0.0` only after separate explicit authorization.

Preparing the repository and workflow does not authorize npm publication, GitHub settings changes, or external notifications.

## Implementation Decomposition

The production-v1 program will be planned and executed in dependency order:

1. **Protocol and core integrity:** canonical schema, generated validation/types, normalized changes, fingerprints, lifecycle, and policy.
2. **Detector and migration:** conservative JSON Schema detector, external change-set contract, and v0.1 migration.
3. **Effects and interfaces:** file store, history verification, notifications, CLI, and GitHub Action.
4. **Quality and release:** conformance/fuzz/security testing, packaging, documentation rewrite, CI, and release-candidate readiness.

Each phase must leave the repository passing its relevant gates. No phase may weaken the fail-closed or exact-coverage requirements to preserve v0.2 behavior.

## Acceptance Criteria

SEIP v1 is implementation-complete when all of the following are true:

1. Every breaking or unknown change under the coordinated policy requires an exact eligible fingerprint.
2. A completed declaration for one before/after change cannot cover a different later change.
3. Invalid, unsupported, or incomplete detector input never produces a successful empty change set.
4. Runtime validation and `seip.schema.json` agree for the conformance corpus.
5. Lifecycle operations are immutable, explicit, total over arbitrary input, and terminal-safe.
6. Zero-consumer declarations have an explicit valid path to acceptance.
7. Git history checks detect deletion, mutation, or truncation of canonical audit data.
8. The GitHub Action resists shell-injection test payloads and defaults to coordinated policy.
9. Slack credentials, child-process secrets, and raw unbounded output do not appear in results or declarations.
10. A packed tarball installs cleanly and exposes only documented typed entry points.
11. Node/platform matrices, coverage thresholds, static checks, security tests, and documentation examples pass in CI.
12. The README, specification, schema, CLI help, Action guide, migration guide, and whitepaper make mutually consistent claims.
13. The repository contains the legal, security, contribution, release, and provenance artifacts expected of a production package.
14. No npm publication, GitHub protection change, or external message occurs without explicit authorization.

## Deferred Follow-up Opportunities

After v1 adoption evidence exists, separate designs may consider:

- first-party oasdiff, Buf, Avro, dbt, SQL, or ODCS adapters;
- cross-repository response bundles;
- signed validation attestations;
- hosted dashboards or GitHub Checks synchronization;
- separately versioned adapter packages.

They are intentionally excluded from the v1 implementation plan.
