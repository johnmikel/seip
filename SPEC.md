# SEIP Specification (v0.1)

SEIP (Schema Evolution Intent Protocol) defines a minimal, tool-agnostic format for expressing schema change intent and coordinating producer/consumer timelines.

## Scope

SEIP specifies a JSON declaration format, lifecycle states, and validation rules that allow multiple tools to interoperate over the same change declarations.

## Goals

- Provide a stable, versioned declaration format for schema change intent.
- Make breaking changes explicit and traceable in version control.
- Enable producers and consumers to negotiate timelines with a shared artifact.
- Allow tools to surface declarations through existing review and notification systems.

## Non-goals

- Owning schema diffing or migration execution in a specific technology stack.
- Defining how teams should implement migrations internally.
- Replacing GitHub, Slack, email, dashboards, or other notification systems.
- Defining a universal cross-repository write path, authorization model, or delivery service.

## Terminology

- Producer: The team that owns the schema being changed.
- Consumer: Any downstream team or system owner that depends on the schema.
- Declaration: A JSON file describing a schema change and its lifecycle.
- Automation: CI systems, scripts, or agents acting on behalf of a producer or consumer team.

## File layout

Declarations live at `.seip/declarations/<declaration_id>.json` within a repository. Tools should treat this directory as the source of truth.

## Canonical Storage And Transport

SEIP defines the declaration and lifecycle, not the transport mechanism.

- Git is the canonical state store.
- CI, pull requests, dashboards, or notification adapters can surface declarations to humans and systems.
- Notification delivery is optional and outside the core protocol.
- The protocol does not require a `consumers[].webhook` field.
- The reference implementation operates on the repository that contains the canonical declaration and does not define a universal cross-repository write path.

## Declaration object

A declaration MUST be a JSON object with the following top-level fields:

- `seip_version` (string)
- `declaration_id` (string; safe file identifier using letters, numbers, dots, underscores, or hyphens)
- `created_at` (ISO 8601 string)
- `status` (enum)
- `producer` (object)
- `change` (object)
- `timeline` (object)
- `consumers` (array)
- `responses` (array)
- `events` (array)

The canonical JSON Schema is in `seip.schema.json`.

## Lifecycle states

- `DRAFT`
- `PROPOSED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `ENFORCING`
- `COMPLETED`
- `WITHDRAWN`
- `REJECTED`

Recommended transitions:

- `DRAFT -> PROPOSED -> ACCEPTED -> ENFORCING -> COMPLETED`
- `PROPOSED -> UNDER_REVIEW -> ACCEPTED`
- `DRAFT|PROPOSED|UNDER_REVIEW -> WITHDRAWN`

## Validation rules

1. `change.breaking = true` requires a `migration.strategy`.
2. `change.affected_objects` SHOULD be populated for breaking changes.
3. `timeline.review_deadline`, `timeline.deprecation_date`, and `timeline.removal_date` MUST be valid ISO 8601 timestamps.
4. Consumers and responses MUST use the allowed status enums.
5. `events` MUST be present, SHOULD be append-only, and MUST include a timestamp for each lifecycle change.
6. Review deadlines are informative unless enforced by surrounding CI or organizational policy.

## Rename mapping

Renames can be expressed explicitly with `change.renames` entries of the form `{ object, from, to }`. Tools SHOULD treat these mappings as authoritative when validating rename coverage.

## Type compatibility

Tools MAY classify type changes as lossy or lossless according to local schema semantics. Lossy type transitions SHOULD be treated as breaking. Lossless or widening type transitions MAY be reported without requiring a breaking declaration unless local policy says otherwise.

Reference tools SHOULD also treat compatibility tightening as breaking when it can remove values a consumer may currently rely on. Examples include making an existing field required, changing nullable to non-nullable, narrowing enum values, and changing a field format. These checks remain generic unless a source-specific adapter supplies richer schema semantics.

The v0.2 reference implementation supports SEIP object/table fixtures and common JSON Schema object inputs, including root `properties`, local `$ref` resolution, `$defs` and `definitions`, nested object paths, array item object paths, and simple `allOf` composition. More advanced dialect behavior, such as remote references, full `oneOf` or `anyOf` semantics, Avro compatibility modes, dbt model lineage, or SQL DDL parsing, remains adapter-specific.

## Consumer validation

Consumer validation is an integration hook, not a universal validator. A SEIP-compatible tool MAY verify that the referenced consumer target exists and MAY execute a local validation command supplied by the consumer or organization. Validation commands SHOULD receive the declaration id, declaration path, and consumer target path through machine-readable inputs such as environment variables.

## Audit events

`events[]` provides an append-only audit trail. Each event SHOULD include `type`, `at`, and `actor`, and MAY include `from_status`, `to_status`, and a freeform `message`.

## Automation Interface

SEIP-compatible tools SHOULD expose machine-readable access to declarations and validation results, either by reading declaration files directly or through command-line or API output.

## Notification adapters

Notification adapters MAY render declarations for delivery through existing systems such as GitHub pull request comments, GitHub Actions summaries, Slack Block Kit messages, email, or internal portals.

Adapters MUST NOT become an alternate source of truth for declaration state. They SHOULD link back to the canonical declaration in Git when a repository URL is available.

The reference CLI provides adapter output through `seip notify`, including:

- `--adapter github` for Markdown suitable for GitHub PR comments or Actions summaries.
- `--adapter slack` for Slack Block Kit payloads.
- `--json` for machine-readable automation output.
- `--dry-run` to build payloads without sending network requests.

## Policy and non-response

SEIP allows organizations to enforce local policy around declaration status and required consumer acknowledgements. The protocol does not define automatic acceptance, rejection, or timeout resolution for missed responses or deadlines.

## Versioning and compatibility

- `seip_version` follows semver. Minor versions add optional fields only.
- Tools MUST ignore unknown fields to maintain forward compatibility.
- New required fields are only introduced in major versions.

## Extensions

Custom fields are allowed if they are namespaced, for example `x_company_policy` or `x_ticket_url`.

## Conformance

A tool is SEIP-compatible if it can read and write valid declarations, preserve unknown fields, and respect the lifecycle semantics described above.

For CI enforcement, tools MUST NOT treat invalid declarations, non-breaking declarations, withdrawn declarations, or rejected declarations as valid coverage for breaking changes. Tools SHOULD reject responses from undeclared consumers and SHOULD only accept consumer responses while a declaration is in a reviewable state.
