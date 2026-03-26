# SEIP Specification (v0.1)

SEIP (Schema Evolution Intent Protocol) defines a minimal, tool-agnostic format for expressing schema change intent and coordinating producer/consumer timelines.

## Scope

SEIP specifies a JSON declaration format, lifecycle states, and validation rules that allow multiple tools to interoperate over the same change declarations.

## Goals

- Provide a stable, versioned declaration format for schema change intent.
- Make breaking changes explicit and traceable in version control.
- Enable producers and consumers to negotiate timelines with a shared artifact.

## Non-goals

- Owning schema diffing or migration execution in a specific technology stack.
- Defining how teams should implement migrations internally.

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
- The v0.1 reference implementation operates on the repository that contains the canonical declaration and does not define a universal cross-repository write path.

## Declaration object

A declaration MUST be a JSON object with the following top-level fields:

- `seip_version` (string)
- `declaration_id` (string)
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
5. `events` SHOULD be append-only and include a timestamp for each lifecycle change.
6. Review deadlines are informative unless enforced by surrounding CI or organizational policy.

## Rename mapping

Renames can be expressed explicitly with `change.renames` entries of the form `{ object, from, to }`. Tools SHOULD treat these mappings as authoritative when validating rename coverage.

## Audit events

`events[]` provides an append-only audit trail. Each event SHOULD include `type`, `at`, and `actor`, and MAY include `from_status`, `to_status`, and a freeform `message`.

## Automation Interface

SEIP-compatible tools SHOULD expose machine-readable access to declarations and validation results, either by reading declaration files directly or through command-line or API output.

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
