# SEIP Production v1 Phase 1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typed, fail-closed SEIP v1 protocol core: canonical schema validation, deterministic fingerprints, immutable declaration lifecycle, and exact policy evaluation.

**Architecture:** Introduce a new TypeScript core alongside the v0.2 implementation so existing CLI and demos remain runnable during the migration. The v1 JSON Schema is the canonical contract; generated types and CommonJS standalone validators behind ESM TypeScript wrappers feed pure modules for diagnostics, fingerprinting, declaration semantics, lifecycle transitions, and policy. Node effects, the JSON Schema detector, migration I/O, CLI replacement, GitHub Action hardening, and release publication remain later phases.

**Tech Stack:** Node.js 20+ ESM, TypeScript 7.0.2, Node test runner, Ajv 8.20.0 standalone generation, ajv-formats 3.0.1, esbuild 0.28.1 for self-contained generated validators, json-schema-to-typescript 15.0.4, fast-check 4.9.0, built-in `node:crypto`.

---

## Execution Prerequisites and Boundaries

- Execute in an isolated worktree and feature branch, not directly on `main`. Use @superpowers:using-git-worktrees before Task 1.
- Use @superpowers:test-driven-development for every behavior task and @superpowers:verification-before-completion before the phase checkpoint.
- Preserve the existing `src/index.mjs`, `src/notify.js`, `bin/seip.mjs`, examples, and v0.2 tests during this phase.
- Do not publish npm packages, push branches, change GitHub settings, send Slack messages, or modify the GitHub Action behavior in this phase.
- Treat the approved design as normative: `docs/superpowers/specs/2026-07-11-production-v1-design.md`.
- Commit after every task. Do not combine tasks into a single large commit.

## Phase 1 File Structure

### Create

- `tsconfig.json` — compiles only the new v1 TypeScript core and generated validator into `dist/`.
- `scripts/generate-protocol.mjs` — generates TypeScript protocol types and CommonJS standalone validators from the canonical schemas.
- `schemas/legacy/seip-v0.1.schema.json` — preserves the previous protocol schema for migration fixtures.
- `seip.amendment.schema.json` — canonical closed schema for material amendment patches.
- `src/generated/protocol-types.ts` — generated protocol types; never hand-edited.
- `src/generated/protocol-validator.cjs` — generated CommonJS standalone Ajv validator; never hand-edited.
- `src/generated/amendment-validator.cjs` — generated CommonJS standalone amendment validator; never hand-edited.
- `src/core/protocol-schema.ts` — total wrappers around generated schema validators.
- `src/core/diagnostics.ts` — result and diagnostic contracts.
- `src/core/protocol-version.ts` — protocol semver compatibility checks.
- `src/core/canonical-value.ts` — tagged canonical values and exact decimal normalization.
- `src/core/canonicalize.ts` — RFC 8785-compatible canonical JSON for normalized SEIP values.
- `src/core/fingerprint.ts` — path types, normalized changes, deterministic ordering, and SHA-256 change IDs.
- `src/core/declaration.ts` — total declaration validation and pure declaration construction.
- `src/core/lifecycle.ts` — immutable transitions, amendment revisions, responses, and terminal rules.
- `src/core/policy.ts` — advisory/declared/coordinated evaluation, coverage precedence, and evidence eligibility.
- `src/core/index.ts` — internal core barrel.
- `src/index.ts` — supported v1 root export.
- `test/v1/protocol-schema.test.mjs` — canonical schema and generated-artifact parity.
- `test/v1/protocol-version.test.mjs` — supported and unsupported protocol versions.
- `test/v1/fingerprint.test.mjs` — injective canonicalization and stable fingerprint fixtures.
- `test/v1/declaration.test.mjs` — total structural and semantic validation.
- `test/v1/lifecycle.test.mjs` — transition table, amendments, responses, and immutability.
- `test/v1/policy.test.mjs` — policy presets, exact coverage, active/completed precedence, history, and evidence.
- `test/v1/public-api.test.mjs` — supported core export boundary.
- `test/fixtures/v1/valid/minimal.json` — smallest valid v1 declaration.
- `test/fixtures/v1/invalid/` — focused invalid declaration fixtures.

### Modify

- `package.json` — exact development dependencies, build/generation scripts, Node engine, v1 root entry metadata, and `dist/` package contents.
- `package-lock.json` — reproducible dependency graph.
- `.gitignore` — generated build output.
- `.github/workflows/ci.yml` — install locked dependencies before running the unchanged full test command.
- `seip.schema.json` — replace the v0.1 contract with the canonical v1 declaration schema.
- `seip.amendment.schema.json` — add the closed amendment-patch contract.

## Frozen Phase 1 Protocol Contracts

The schema and generated TypeScript must express these contracts exactly. Do not invent alternative field names or shapes during implementation.

### IDs and common values

- `declaration_id`: `^[A-Za-z0-9](?!.*\.\.)[A-Za-z0-9_.-]*$` and maximum 128 characters.
- `change_id`: `^chg_sha256_[0-9a-f]{64}$`.
- event, response, and evidence IDs: non-empty safe identifiers with prefixes `evt_`, `rsp_`, and `evd_`; path separators and `..` are forbidden.
- team and validator IDs: trimmed non-empty strings, maximum 128 characters.
- timestamps: RFC 3339 `date-time` strings.
- SHA-256 digests: lower-case 64-character hexadecimal strings.

### Normalized changes

`target.path` is the tagged path-segment array from the approved design. `before` and `after` are normalized snapshot values containing no bare numbers; arbitrary source values use `CanonicalValue`.

Standard `kind` values and required snapshots are:

| Kind | `before` | `after` | Additional rule |
| --- | --- | --- | --- |
| `object_add`, `add` | absent | required | `object_add` uses empty path. |
| `object_remove`, `remove` | required | absent | `object_remove` uses empty path. |
| `rename` | required | required | Both snapshots contain exact `name`; old/new names differ. |
| `retype` | required | required | Both snapshots contain normalized `type`. |
| `make_required`, `make_optional` | required | required | Both contain boolean `required`; values differ. |
| `make_non_nullable`, `make_nullable` | required | required | Both contain boolean `nullable`; values differ. |
| `enum_narrow`, `enum_widen` | required | required | Both contain canonical `enum` arrays. |
| `format_change` | required | required | Both contain `format`; values differ. |
| `constraint_change` | required | required | Both are normalized structural snapshots. Canonical constraint-keyword representation is deferred pending separate approval; Phase 1 must not invent a keyword field. |
| `deprecate` | required | required | `after.deprecated` is true. |
| `unknown` | at least one | at least one | Detector supplies all known snapshots. |

Unknown detector-specific kinds must contain `:` and use a detector namespace. Schema checks structural presence; `validateDeclaration` checks the per-kind semantic rules and fingerprint.

### Declaration fields

- `protocol_version`: stable semver in the supported v1 range.
- `revision`: integer `>=1`.
- `producer`: required `team`, optional `contact`.
- `changes`: non-empty array with unique `change_id`.
- `intent.summary`: trimmed string, 1–200 characters.
- `intent.rationale`: trimmed non-empty string.
- `intent.migration`: required `strategy`, optional `steps[]` and `rollback`.
- `intent.timeline`: required `review_deadline` and `target_enforcement_at`; optional `deprecation_at` and `removal_at`. When both later dates exist, `target_enforcement_at <= deprecation_at <= removal_at`.
- `consumers`: unique teams; optional contact and unique dependency strings; a top-level `status` field is forbidden.
- `responses`, `evidence`, and `events`: required append-ordered arrays.

### Extension preservation

Every persisted declaration record is forward-extensible: the declaration root, producer, normalized change, target, intent, migration, timeline, consumer, response, evidence, artifact, event, and event details records all allow unknown optional fields. Tagged path/canonical-value union variants, `AmendmentPatch`, and the in-memory policy input/result machine contracts remain closed. Unknown fields may contain any JSON value and must survive validation, creation where supplied, amendments, and every lifecycle transition with deep-equal parsed values. `x_*` is a naming recommendation for custom fields, not a preservation allowlist. Generated types must therefore include index signatures on extensible records, and every transition test must include unknown fields at root and nested levels and assert deep-equal preservation.

### Responses

Each response requires these known fields and may also carry preserved unknown optional fields:

```ts
interface ConsumerResponse {
  [extension: string]: unknown;
  response_id: string;
  declaration_revision: number;
  team: string;
  decision: "ACKNOWLEDGED" | "OBJECTED" | "EXTENSION_REQUESTED";
  message: string;
  actor: string;
  at: string;
}
```

### Evidence

Each evidence entry requires these known fields and may also carry preserved unknown optional fields:

```ts
interface ValidationEvidence {
  [extension: string]: unknown;
  evidence_id: string;
  declaration_revision: number;
  team: string;
  validator_id: string;
  validator_version?: string;
  change_ids: string[];
  source_digests: Record<string, string>;
  result: "PASSED" | "FAILED";
  at: string;
  summary: string;
  artifact?: {
    [extension: string]: unknown;
    uri: string;
    sha256: string;
  };
}
```

`change_ids` is non-empty and unique. `summary` is at most 1 KiB. Artifact URI restrictions are enforced semantically in later effects work; Phase 1 validates allowed `https`/`urn` schemes, no userinfo/query credentials, and the digest shape.

### Events and replay

Every event contains `event_id`, `type`, `declaration_revision`, `at`, `actor`, `from_status`, and `to_status`. Event types are:

- `CREATED`
- `DECLARATION_UPDATED`
- `PROPOSED`
- `CONSUMER_RESPONDED`
- `EVIDENCE_RECORDED`
- `ACCEPTED`
- `ENFORCING`
- `COMPLETED`
- `WITHDRAWN`
- `REJECTED`

Discriminated event details are:

```ts
type EventDetails =
  | { type: "CREATED" }
  | {
      type: "DECLARATION_UPDATED";
      reason: string;
      changed_paths: string[];
      before_digest: string;
      after_digest: string;
    }
  | {
      type: "CONSUMER_RESPONDED";
      response_id: string;
      team: string;
      decision: ConsumerResponse["decision"];
    }
  | {
      type: "EVIDENCE_RECORDED";
      evidence_id: string;
      team: string;
      result: ValidationEvidence["result"];
    }
  | { type: "WITHDRAWN" | "REJECTED"; reason: string }
  | { type: "PROPOSED" | "ACCEPTED" | "ENFORCING" | "COMPLETED" };
```

`CREATED` is the first and only created event, uses revision `1`, and transitions `null -> DRAFT`. Later events chain exactly: each `from_status` equals the preceding event's `to_status`. Non-status operations use identical from/to status except `CONSUMER_RESPONDED`: from `PROPOSED`, `OBJECTED` or `EXTENSION_REQUESTED` transitions to `UNDER_REVIEW` while `ACKNOWLEDGED` preserves `PROPOSED`; from `UNDER_REVIEW`, every decision preserves `UNDER_REVIEW`. Event timestamps and revisions are non-decreasing. Only `DECLARATION_UPDATED` increments revision, exactly by one. Current declaration `revision` equals `1 + count(DECLARATION_UPDATED)`, and current `status` equals the final `to_status`. Each response and evidence entry has exactly one matching recorded event with the same ID, team, revision, and decision/result.

### Amendment patch

`reason` is a separate required argument to `amendDeclaration`; it is not a patch field. `seip.amendment.schema.json` is a closed object with at least one of:

```ts
interface AmendmentPatch {
  intent?: IntentMergePatch;
  consumers?: {
    add?: Consumer[];
    update?: Array<{
      team: string;
      contact?: string;
      dependencies?: string[];
    }>;
  };
}
```

`intent` follows RFC 7396 merge-patch semantics within the intent object. Deleting a required intent field is invalid. Consumer operations are keyed by team: `add` rejects existing teams; `update` requires an existing team and cannot change its identity; remove/rename operations do not exist in v1.

### Deterministic amendment audit data

`DECLARATION_UPDATED.changed_paths` uses canonical SEIP logical pointers. Pointer tokens use RFC 6901 escaping (`~` as `~0`, `/` as `~1`). Intent changes are rooted at `/intent`: object patches recurse in sorted key order, while an added/removed value or changed scalar/array records the pointer of that value (arrays are atomic). Consumer additions use `/consumers/by-team/{escaped-team}`; metadata updates use `/consumers/by-team/{escaped-team}/contact` or `/consumers/by-team/{escaped-team}/dependencies`. The final list is unique and sorted by UTF-16 code units. A no-op patch is rejected.

The audit digest preimage is exactly:

```ts
{
  intent: declaration.intent,
  consumers: [...declaration.consumers].sort((a, b) => compareCodeUnits(a.team, b.team))
}
```

It includes all preserved unknown fields within those sections. `before_digest` and `after_digest` are the lower-case, unprefixed SHA-256 hex of `canonicalize(preimage).value` before and after applying the patch. Existing consumer order is preserved in the declaration; newly added consumers are appended in team-code-unit order. Audit digest normalization is the only place the consumer array is reordered. If canonicalization fails, amendment fails without mutation.

### Pure policy input

Detector output cannot assign its own trust. Use separate contracts:

```ts
interface DetectionReport {
  ok: boolean;
  completeness: "complete" | "partial";
  changes: NormalizedChange[];
  diagnostics: Diagnostic[];
  detector: { id: string; version: string; mode: "builtin" | "executed" | "imported" };
  source_digests: Record<string, string>;
}

interface DetectorTrust {
  trusted: boolean;
  mode: "builtin" | "executed" | "operator_import" | "untrusted_import";
  authorization_id?: string;
}

interface HistoryVerificationResult {
  status: "verified" | "failed" | "not_evaluated";
  base_sha?: string;
  diagnostics: Diagnostic[];
}

interface EvidenceRequirement {
  mode: "none" | "all_consumers" | "selected";
  selected_teams?: string[];
  required_validator_ids?: string[];
  trusted_validator_ids: string[];
}

interface PolicyInput {
  preset: "advisory" | "declared" | "coordinated";
  detection: DetectionReport;
  detector_trust: DetectorTrust;
  declarations: unknown[];
  history?: HistoryVerificationResult;
  evidence: EvidenceRequirement;
}
```

Policy compares evidence `source_digests` with `detection.source_digests`. `operator_import` can be trusted only when the caller sets `trusted: true`; the detection report cannot promote itself. `declared` and `coordinated` reject untrusted imports. `coordinated` requires `history.status === "verified"` and a valid base SHA.

Detector provenance and operator trust must match this fail-closed matrix; every other combination is an operational error:

| `detection.detector.mode` | Required `detector_trust.mode` | Required `trusted` | Additional rule |
| --- | --- | --- | --- |
| `builtin` | `builtin` | `true` | Trust was established by the bundled adapter. |
| `executed` | `executed` | `true` | Trust was established by the allowlisted execution adapter. |
| `imported` | `operator_import` | `true` | A non-empty `authorization_id` is required. |
| `imported` | `untrusted_import` | `false` | `authorization_id` must be absent. |

In particular, imported output cannot be paired with `builtin` or `executed` trust, and `trusted: true` is invalid with `untrusted_import`. The pure evaluator validates this matrix before considering completeness, compatibility, declarations, or coverage.

## Task 1: Bootstrap the TypeScript Core Toolchain

**Files:**
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/core/index.ts`
- Modify: `package.json`
- Create: `package-lock.json`
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Record the clean baseline**

Run:

```bash
git status --short
npm test
```

Expected: clean worktree and all 45 existing tests pass.

- [ ] **Step 2: Install exact Phase 1 development dependencies**

Run:

```bash
npm install --save-dev --save-exact \
  typescript@7.0.2 \
  @types/node@20.19.43 \
  ajv@8.20.0 \
  ajv-formats@3.0.1 \
  esbuild@0.28.1 \
  json-schema-to-typescript@15.0.4 \
  fast-check@4.9.0
```

Expected: `package-lock.json` is created; all packages appear under `devDependencies`; `dependencies` remains absent.

- [ ] **Step 3: Add the compiler configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "allowJs": true,
    "checkJs": false,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*.ts",
    "src/generated/**/*.cjs"
  ],
  "exclude": [
    "src/index.mjs",
    "src/notify.js"
  ]
}
```

- [ ] **Step 4: Add empty v1 entry points**

Create `src/core/index.ts`:

```ts
export {};
```

Create `src/index.ts`:

```ts
export * from "./core/index.js";
```

- [ ] **Step 5: Add build scripts without replacing the legacy test command**

Update `package.json` scripts to include:

```json
{
  "build": "tsc -p tsconfig.json",
  "pretest": "npm run build",
  "test": "node --test",
  "test:v1": "npm run build && node --test test/v1/*.test.mjs"
}
```

Add:

```json
{
  "engines": { "node": ">=20" }
}
```

Defer `types` together with `main`, `exports`, and `files` until Task 8 so intermediate package metadata stays truthful.

- [ ] **Step 6: Ignore build output and install dependencies in CI**

Add `dist/` to `.gitignore`.

In `.github/workflows/ci.yml`, add `npm ci` before `npm test`. Do not expand the runtime/OS matrix yet.

- [ ] **Step 7: Verify the toolchain and legacy suite**

Run:

```bash
npm run build
npm test
git diff --check
```

Expected: TypeScript compilation succeeds and all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .github/workflows/ci.yml src/index.ts src/core/index.ts
git commit -m "build: add v1 TypeScript core toolchain"
```

## Task 2: Make the v1 JSON Schema the Canonical Contract

**Files:**
- Create: `schemas/legacy/seip-v0.1.schema.json`
- Modify: `seip.schema.json`
- Create: `seip.amendment.schema.json`
- Create: `scripts/generate-protocol.mjs`
- Generate: `src/generated/protocol-types.ts`
- Generate: `src/generated/protocol-validator.cjs`
- Generate: `src/generated/amendment-validator.cjs`
- Create: `src/core/protocol-schema.ts`
- Create: `test/fixtures/v1/valid/minimal.json`
- Create: `test/fixtures/v1/invalid/missing-change-id.json`
- Create: `test/fixtures/v1/invalid/consumer-status-field.json`
- Create: `test/v1/protocol-schema.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Preserve the legacy schema**

Copy the current `seip.schema.json` unchanged to `schemas/legacy/seip-v0.1.schema.json`. Verify the copy before replacing the root schema:

```bash
cmp seip.schema.json schemas/legacy/seip-v0.1.schema.json
```

Expected: exit `0`.

- [ ] **Step 2: Write the schema conformance test first**

Create `test/v1/protocol-schema.test.mjs` with tests that:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const valid = JSON.parse(await readFile(new URL("../fixtures/v1/valid/minimal.json", import.meta.url)));
const missingChangeId = JSON.parse(await readFile(new URL("../fixtures/v1/invalid/missing-change-id.json", import.meta.url)));

test("generated protocol validator accepts the minimal v1 declaration", async () => {
  const { validateProtocolSchema } = await import("../../dist/core/protocol-schema.js");
  assert.deepEqual(validateProtocolSchema(valid), { ok: true, diagnostics: [] });
});

test("generated protocol validator rejects a change without change_id", async () => {
  const { validateProtocolSchema } = await import("../../dist/core/protocol-schema.js");
  const result = validateProtocolSchema(missingChangeId);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((item) => item.code === "SEIP_PROTOCOL_SCHEMA_INVALID"));
});
```

Also assert that a v0.1-style `consumers[].status` property is rejected by the v1 schema, because consumer state is derived from responses.

Add a valid fixture with unknown optional fields at the declaration root and within producer, change, target, intent, migration, timeline, consumer, response, evidence, artifact, event, and event details records. Assert the generated types/schema accept them while the closed tagged unions and amendment patch reject unknown fields.

- [ ] **Step 3: Run the focused test and confirm failure**

Run:

```bash
npm run build && node --test test/v1/protocol-schema.test.mjs
```

Expected: FAIL because `dist/core/protocol-schema.js` does not exist.

- [ ] **Step 4: Replace the root schema with protocol v1**

Write `seip.schema.json` as JSON Schema 2020-12 with:

- `$id`: `https://seip.dev/schema/v1/declaration.schema.json`;
- `additionalProperties: true` at extensible protocol objects;
- root required fields: `protocol_version`, `declaration_id`, `created_at`, `revision`, `status`, `producer`, `changes`, `intent`, `consumers`, `responses`, `evidence`, `events`;
- `protocol_version` semver pattern and stable v1 examples;
- safe declaration-ID pattern and no `..` path segments;
- RFC 3339 `date-time` formats;
- `revision` integer minimum `1`;
- the eight lifecycle statuses;
- tagged path segments (`property`, `items`, `tuple_item`);
- fully tagged canonical values (`null`, `boolean`, `string`, `number`, `array`, `object`);
- numeric decimal pattern for exact `coefficient` + `e` + exponent representation;
- normalized changes with exact `change_id`, `fingerprint_version: "1"`, compatibility enum, snapshots, and target;
- intent, migration, and timeline objects;
- unique consumer objects without a mutable status field;
- revision-scoped responses and evidence;
- event IDs, actors, timestamps, and nullable transition endpoints.

Use `$defs` for every reusable object. Set `additionalProperties: true` explicitly on every persisted declaration record listed in **Extension preservation**. Set `additionalProperties: false` only for tagged union variants and the amendment-patch machine contract where unknown fields would make a variant or operation ambiguous.

Consumer objects remain forward-extensible but explicitly forbid a top-level `status` property with a schema `not` constraint.

Create `seip.amendment.schema.json` as the closed `AmendmentPatch` contract in the frozen protocol section. The patch requires at least one of `intent` or `consumers`; `reason` is deliberately absent because it is a separate argument to `amendDeclaration`. The schema allows only an RFC 7396 intent merge patch and keyed `consumers.add`/`consumers.update` operations. It exposes no remove or rename operation and forbids identity, protocol, producer, changes, revision, status, responses, evidence, and events.

- [ ] **Step 5: Add minimal valid and focused invalid fixtures**

The valid fixture must match the illustrative declaration in the approved design, use one exact change, and contain a `CREATED` event. The invalid fixtures differ from it by one defect only.

- [ ] **Step 6: Write the generator**

Create `scripts/generate-protocol.mjs`:

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";
import { build as bundle } from "esbuild";
import { compile } from "json-schema-to-typescript";

const schemaUrl = new URL("../seip.schema.json", import.meta.url);
const amendmentSchemaUrl = new URL("../seip.amendment.schema.json", import.meta.url);
const generatedDir = new URL("../src/generated/", import.meta.url);
const projectDir = fileURLToPath(new URL("..", import.meta.url));
const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
const amendmentSchema = JSON.parse(await readFile(amendmentSchemaUrl, "utf8"));

await mkdir(generatedDir, { recursive: true });

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  code: { source: true, esm: false }
});
addFormats(ajv);
const validate = ajv.compile(schema);
const validateAmendment = ajv.compile(amendmentSchema);

async function writeStandalone(validator, filename) {
  await bundle({
    stdin: {
      contents: standaloneCode(ajv, validator),
      resolveDir: projectDir,
      sourcefile: filename,
      loader: "js"
    },
    outfile: fileURLToPath(new URL(filename, generatedDir)),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    legalComments: "inline",
    sourcemap: false,
    minify: false,
    charset: "utf8"
  });
}

await writeStandalone(validate, "protocol-validator.cjs");
await writeStandalone(validateAmendment, "amendment-validator.cjs");

const types = await compile(schema, "SeipDeclaration", {
  bannerComment: "// Generated from seip.schema.json. Do not edit."
});
await writeFile(new URL("protocol-types.ts", generatedDir), types);
```

Add `"generate": "node scripts/generate-protocol.mjs"`, add `"check:generated": "npm run generate && git diff --exit-code -- src/generated"`, and change `build` to `npm run generate && tsc -p tsconfig.json`.

In `.github/workflows/ci.yml`, add `npm run check:generated` after `npm ci` and before `npm test`. This makes the committed schema-derived artifacts authoritative and fails CI when regeneration changes them.

- [ ] **Step 7: Add the generated-validator wrapper**

Create `src/core/protocol-schema.ts`. It must expose both `validateProtocolSchema` and `validateAmendmentSchema`, catch arbitrary input, convert Ajv errors into stable diagnostics using `instancePath`, and never throw for user data.

Import the generated `.cjs` default exports from the ESM TypeScript wrapper. Raw Ajv standalone code may reference `require("ajv-formats/dist/formats")`, so generation bundles each validator and all of its runtime helpers into a self-contained CommonJS file before TypeScript copies it to `dist/`. The public package and wrapper remain ESM, and `dependencies` remains absent. The focused test must import the built wrapper and prove both date-time format validation and amendment validation execute without `require is undefined` or module-resolution errors.

Use this exported shape:

```ts
export interface SchemaValidationResult {
  ok: boolean;
  diagnostics: Array<{
    code: "SEIP_PROTOCOL_SCHEMA_INVALID" | "SEIP_LIFECYCLE_AMENDMENT_INVALID";
    severity: "error";
    message: string;
    path?: string;
  }>;
}

export function validateProtocolSchema(value: unknown): SchemaValidationResult;
export function validateAmendmentSchema(value: unknown): SchemaValidationResult;
```

- [ ] **Step 8: Generate, build, and run the focused tests**

Run:

```bash
npm run generate
npm run build
node --test test/v1/protocol-schema.test.mjs
npm test
```

Expected: focused tests pass; the complete legacy and v1 suite passes.

- [ ] **Step 9: Prove generated files are deterministic**

Run:

```bash
git add src/generated
npm run generate
git diff --exit-code -- src/generated
```

Expected: no diff.

- [ ] **Step 10: Commit**

```bash
git add seip.schema.json seip.amendment.schema.json schemas/legacy scripts/generate-protocol.mjs src/generated src/core/protocol-schema.ts test/fixtures/v1 test/v1/protocol-schema.test.mjs package.json package-lock.json .github/workflows/ci.yml
git commit -m "feat: define the SEIP v1 protocol schema"
```

## Task 3: Add Stable Diagnostics and Protocol-Version Semantics

**Files:**
- Create: `src/core/diagnostics.ts`
- Create: `src/core/protocol-version.ts`
- Create: `test/v1/protocol-version.test.mjs`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Write failing protocol-version and result tests**

Cover:

```js
test("accepts stable protocol 1.x", () => {
  assert.equal(validateProtocolVersion("1.0.0").ok, true);
  assert.equal(validateProtocolVersion("1.99.0").ok, true);
});

test("rejects unsupported major and prerelease versions", () => {
  assert.equal(validateProtocolVersion("2.0.0").diagnostics[0].code, "SEIP_PROTOCOL_VERSION_UNSUPPORTED");
  assert.equal(validateProtocolVersion("1.1.0-rc.1").ok, false);
});

test("never throws for arbitrary values", () => {
  for (const value of [null, 1, {}, [], "not-semver"]) {
    assert.doesNotThrow(() => validateProtocolVersion(value));
  }
});
```

- [ ] **Step 2: Verify the focused test fails**

Run:

```bash
npm run build && node --test test/v1/protocol-version.test.mjs
```

Expected: FAIL because the exports do not exist.

- [ ] **Step 3: Implement the diagnostic contracts**

Create `src/core/diagnostics.ts` with:

```ts
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  changeId?: string;
  declarationId?: string;
  hint?: string;
}

export type Result<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export function failure(code: string, message: string, extras: Partial<Diagnostic> = {}): Result<never> {
  return { ok: false, diagnostics: [{ ...extras, code, severity: "error", message }] };
}
```

Do not add exceptions or logging.

- [ ] **Step 4: Implement stable v1 version checking**

Create `src/core/protocol-version.ts`. Parse semver without a dependency using a strict regular expression; accept stable `1.x.y` with optional build metadata, reject prereleases, invalid strings, and other majors. Return `SEIP_PROTOCOL_VERSION_INVALID` for malformed values and `SEIP_PROTOCOL_VERSION_UNSUPPORTED` for valid but unsupported values. Add `1.2.3+build.7` to the accepted test table.

- [ ] **Step 5: Export and verify**

Export both modules from `src/core/index.ts`.

Run:

```bash
npm run build
node --test test/v1/protocol-version.test.mjs
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/diagnostics.ts src/core/protocol-version.ts src/core/index.ts test/v1/protocol-version.test.mjs
git commit -m "feat: add v1 diagnostics and version checks"
```

## Task 4: Implement Injective Canonical Values and Change Fingerprints

**Files:**
- Create: `src/core/canonical-value.ts`
- Create: `src/core/canonicalize.ts`
- Create: `src/core/fingerprint.ts`
- Create: `test/v1/fingerprint.test.mjs`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Write failing canonical-decimal tests**

Test this exact table:

```js
const cases = [
  ["0", "0e0"],
  ["-0", "0e0"],
  ["1", "1e0"],
  ["1.0", "1e0"],
  ["10e-1", "1e0"],
  ["1200", "12e2"],
  ["0.00120", "12e-4"],
  ["9007199254740993", "9007199254740993e0"],
  ["1e-400", "1e-400"]
];
```

Also reject `NaN`, `Infinity`, leading-zero integers, incomplete exponents, hexadecimal values, and non-string input.

- [ ] **Step 2: Write failing canonicalization and fingerprint tests**

Cover:

- object key order does not alter canonical output;
- arrays preserve order;
- exact Unicode strings such as `"é"` and `"e\u0301"` remain distinct;
- literal property `"*"` does not collide with `{ type: "items" }`;
- object-valued enums cannot collide with tagged canonical values;
- absent and `null` snapshots differ;
- compatibility, detector name, and detector version do not affect `change_id`;
- before/after, kind, object, or path changes do affect `change_id`;
- known fixture IDs remain stable;
- `computeChangeId` and `sortChanges` return diagnostics rather than throw for `null`, primitives, arrays, malformed path segments, negative or unsafe tuple indexes, forged IDs, bare snapshot numbers, unsupported prototypes, and cyclic input.

Use `fast-check` to generate JSON-safe tagged values and assert that canonicalization is deterministic and does not mutate input.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
npm run build && node --test test/v1/fingerprint.test.mjs
```

Expected: FAIL because the fingerprint exports do not exist.

- [ ] **Step 4: Implement canonical values and exact decimal normalization**

Define the tagged union:

```ts
export type CanonicalValue =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "number"; decimal: string }
  | { kind: "array"; items: CanonicalValue[] }
  | { kind: "object"; entries: Array<{ key: string; value: CanonicalValue }> };
```

Implement `normalizeDecimalLexeme(lexeme: unknown): Result<string>` using string parsing and `BigInt`-safe exponent arithmetic. Never call `Number(lexeme)`. Sort object entries by exact key code units and reject duplicate keys in the normalized representation.

- [ ] **Step 5: Implement RFC 8785-compatible serialization for normalized values**

`canonicalize(value)` must:

- accept only null, booleans, strings, finite JSON numbers, arrays, and plain records;
- serialize strings through `JSON.stringify`;
- serialize numbers using the RFC 8785/ECMAScript shortest round-trippable representation used by `JSON.stringify` (exact schema numbers remain tagged decimal strings, while this support keeps unknown optional JSON fields preservable and auditable);
- sort record keys using UTF-16 code-unit order;
- reject unsupported prototypes, `undefined`, symbols, functions, non-finite numbers, unsafe integers, and cycles;
- return `Result<string>` and never silently coerce.

- [ ] **Step 6: Implement path and fingerprint contracts**

Use:

```ts
export type PathSegment =
  | { type: "property"; name: string }
  | { type: "items" }
  | { type: "tuple_item"; index: number };

export type NormalizedSnapshotValue =
  | null
  | boolean
  | string
  | CanonicalValue
  | NormalizedSnapshotValue[]
  | { [key: string]: NormalizedSnapshotValue };

export interface NormalizedChange {
  change_id: string;
  fingerprint_version: "1";
  schema_kind: string;
  target: { object: string; path: PathSegment[] };
  kind: string;
  compatibility: "compatible" | "breaking" | "unknown";
  before?: NormalizedSnapshotValue;
  after?: NormalizedSnapshotValue;
}
```

Expose total APIs over arbitrary caller input:

```ts
export function computeChangeId(value: unknown): Result<string>;
export function sortChanges(value: unknown): Result<NormalizedChange[]>;
```

`computeChangeId` first validates the complete change shape, including tagged paths and safe tuple indexes, then validates that snapshot trees contain no bare numbers or unsupported values. It canonicalizes only `fingerprint_version`, `schema_kind`, `target`, `kind`, `before`, and `after`, and returns the full lower-case SHA-256 hex prefixed with `chg_sha256_`. It does not trust or require an incoming `change_id` when computing the digest. `sortChanges` requires an array of structurally valid `NormalizedChange` records, rejects a forged `change_id` by recomputing it, and orders by canonical field encodings followed by `change_id`. Both functions detect cycles and return diagnostics rather than throw.

- [ ] **Step 7: Export and verify**

Run:

```bash
npm run build
node --test test/v1/fingerprint.test.mjs
npm test
```

Expected: focused and complete suites pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/canonical-value.ts src/core/canonicalize.ts src/core/fingerprint.ts src/core/index.ts test/v1/fingerprint.test.mjs
git commit -m "feat: add exact v1 change fingerprints"
```

## Task 5: Build Total Declaration Validation and Construction

**Files:**
- Create: `src/core/declaration.ts`
- Create: `test/v1/declaration.test.mjs`
- Add: `test/fixtures/v1/invalid/*.json`
- Modify: `src/core/index.ts`
- Modify: `src/core/json-data.ts`
- Modify: `test/v1/protocol-boundary.test.mjs`

- [ ] **Step 1: Write failing total-validation tests**

Cover arbitrary values (`null`, arrays, primitives, objects with null array entries), schema-invalid fixtures, unsupported protocol versions, duplicate consumer teams, duplicate IDs, invalid current revision references, change fingerprint mismatch, non-monotonic event times, and status disagreement with the latest lifecycle event.

Include this regression:

```js
test("never counts a schema-valid declaration with a forged fingerprint as valid", () => {
  const declaration = structuredClone(minimalDeclaration);
  declaration.changes[0].after = { type: "string" };
  const result = validateDeclaration(declaration);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((item) => item.code === "SEIP_PROTOCOL_CHANGE_ID_MISMATCH"));
});
```

- [ ] **Step 2: Verify failure**

Run:

```bash
npm run build && node --test test/v1/declaration.test.mjs
```

Expected: FAIL because `validateDeclaration` is not exported.

- [ ] **Step 3: Implement semantic declaration validation**

`validateDeclaration(value)` must:

1. call the generated schema validator;
2. validate the protocol version;
3. recompute every change ID;
4. enforce unique change, consumer, response, evidence, and event IDs;
5. enforce unique consumer teams;
6. require responses/evidence to reference a declared team, current or historical valid revision, and declared changes;
7. require chronological append order for responses, evidence, and events;
8. replay the complete event stream: require exactly one `CREATED` event first with revision `1` and `null -> DRAFT`, require every later `from_status` to equal the preceding `to_status`, require non-status events to preserve status except `CONSUMER_RESPONDED`—from `PROPOSED`, `OBJECTED` or `EXTENSION_REQUESTED` transitions to `UNDER_REVIEW` while `ACKNOWLEDGED` preserves `PROPOSED`; from `UNDER_REVIEW`, every decision preserves `UNDER_REVIEW`—reject events after a terminal state, and validate every event type against the allowed transition table;
9. require event timestamps and revisions to be non-decreasing, require only `DECLARATION_UPDATED` to increment revision and then by exactly one, and require current revision to equal `1 + count(DECLARATION_UPDATED)`;
10. require each response and evidence entry to have exactly one matching event with the same ID, team, declaration revision, and decision/result, with no orphan or duplicate recording event;
11. require the latest lifecycle event `to_status` to equal current status;
12. aggregate diagnostics instead of throwing after the first error.

Do not access the clock, crypto randomness, filesystem, or environment.

- [ ] **Step 4: Implement pure declaration construction**

Use explicit effect data:

```ts
export interface CreateDeclarationInput {
  // Required input-only effect data consumed by the CREATED event.
  actor: string;
  // Persisted declaration input fields and extensions are defined elsewhere.
}

export interface CreationContext {
  createdAt: string;
  createdEventId: string;
}

export function createDeclaration(
  input: CreateDeclarationInput,
  context: CreationContext
): Result<SeipDeclaration>;
```

`CreateDeclarationInput.actor` is required input-only effect data: construction consumes it as the `CREATED` event actor and neither persists it at declaration root nor infers it from producer metadata. Construction sets revision `1`, status `DRAFT`, empty response/evidence arrays, a single `CREATED` event, and sorted changes. It preserves every schema-allowed unknown field supplied at any extensible input record, including but not limited to `x_*`, and validates the completed value before returning success.

- [ ] **Step 5: Bound validated declaration resources before expensive work**

The declaration preflight must enforce these v1 defaults before schema,
semantic, shared-expansion, or clone work. Valid non-proxy own-data container
and depth limits are enforced during the reflection-safety walk so an
over-budget subtree is never inspected; dynamic limit configuration falls back
to the contained post-inspection checks:

- at most 100,000 unique JSON arrays and records, counting the root and each
  acyclic shared identity once;
- at most 128 levels of JSON container depth;
- at most 2 MiB of compact logical JSON; and
- at most 10,000 entries in `changes`.

`JsonDataLimits.maxContainers` is configurable for generic preflight callers
and reports `resource: "containers"` with no path. Exactly 100,000 containers
must pass and 100,001 must fail; scalars spend zero, a root container spends
one, and repeated references spend one by identity. An over-limit declaration
must produce `SEIP_PROTOCOL_RESOURCE_LIMIT` before cloning, while the direct
`validateProtocolSchema` API remains unchanged when no limits are supplied.
Invalid proxies, accessors, cycles, and scalar values retain precedence while
they are within a trusted container and depth budget. At the first unseen
container beyond a trusted container cap, or the first occurrence beyond a
trusted depth cap, preflight returns a pathless resource issue before inspecting
that subtree; the container cap takes precedence when both limits are crossed.
Accessor-, proxy-, inherited-, or otherwise invalid limit fields are not used as
early hints. The final depth pass remains authoritative for shared DAGs reached
at multiple depths, and ordinary collection limits retain their pathful result.

- [ ] **Step 6: Run focused and complete tests**

```bash
npm run build
node --test test/v1/declaration.test.mjs test/v1/protocol-boundary.test.mjs
npm test
```

Expected: all tests pass and arbitrary invalid values do not throw.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-11-production-v1-design.md \
  docs/superpowers/plans/2026-07-11-production-v1-phase-1-core.md \
  src/core/json-data.ts test/v1/protocol-boundary.test.mjs
git commit -m "fix: enforce json limits during inspection"
```

## Task 6: Implement the Immutable Lifecycle and Amendment Revisions

**Files:**
- Create: `src/core/lifecycle.ts`
- Create: `test/v1/lifecycle.test.mjs`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Write a failing transition-table test**

Create a table covering every state against every operation. Assert the allowed transitions from the design and `SEIP_LIFECYCLE_INVALID_TRANSITION` for all others. Explicitly test all terminal states against every operation.

- [ ] **Step 2: Write failing immutability and zero-consumer tests**

Cover:

- every lifecycle operation returns a diagnostic rather than throwing for non-object and schema-invalid input;
- input declaration remains deep-equal after success and failure;
- unknown optional fields at the declaration root and every nested extensible record survive each successful operation deep-equal;
- a zero-consumer proposed declaration can be explicitly accepted;
- a declaration with consumers cannot be accepted until every current-revision latest response is `ACKNOWLEDGED`;
- an objection or extension moves `PROPOSED` to `UNDER_REVIEW`;
- a later acknowledgement resolves the same consumer but does not auto-accept;
- responses are rejected outside `PROPOSED` and `UNDER_REVIEW`.

- [ ] **Step 3: Write failing amendment-revision tests**

Assert that amendment:

- changes only `intent` and `consumers`;
- requires actor and reason;
- increments revision;
- appends `DECLARATION_UPDATED` with changed pointers and before/after digests;
- retains old responses/evidence but makes them ineligible for the new revision;
- preserves DRAFT/PROPOSED/UNDER_REVIEW status;
- is rejected for ACCEPTED, ENFORCING, and terminal declarations;
- rejects attempts to alter changes, producer, identity, or protocol version.
- permits adding a new unique consumer and updating non-identity consumer metadata, but rejects removal or renaming of an existing team so historical responses always retain a declared team.

- [ ] **Step 4: Verify focused failure**

Run:

```bash
npm run build && node --test test/v1/lifecycle.test.mjs
```

Expected: FAIL because lifecycle exports do not exist.

- [ ] **Step 5: Implement transition context and helpers**

Use explicit effect inputs:

```ts
export interface TransitionContext {
  actor: string;
  at: string;
  eventId: string;
}
```

Every operation clones the JSON declaration, checks preconditions, appends one event, validates the result, and returns `Result<SeipDeclaration>`. Shared helpers must remain private to `lifecycle.ts`; do not duplicate transition checks in each exported function.

- [ ] **Step 6: Implement responses and amendment**

`recordConsumerResponse` takes a response ID, current revision, team, decision, message, and transition context. `amendDeclaration` uses `validateAmendmentSchema`, permits only `intent` changes plus append-only consumer-team membership/non-identity metadata updates, increments revision, and hashes the canonical mutable sections before and after.

- [ ] **Step 7: Run focused and full tests**

```bash
npm run build
node --test test/v1/lifecycle.test.mjs
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/lifecycle.ts src/core/index.ts test/v1/lifecycle.test.mjs
git commit -m "feat: add immutable v1 declaration lifecycle"
```

## Task 7: Implement Fail-Closed Policy Evaluation

**Files:**
- Create: `src/core/policy.ts`
- Create: `test/v1/policy.test.mjs`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Write failing detector-evaluability tests**

For every policy preset, assert that detector `ok: false`, `completeness: "partial"`, or error-severity detector diagnostics produce decision `error`, not pass/fail. Assert that `unknown` compatibility is treated as requiring breaking-change coverage. Test every allowed provenance/trust row in the frozen matrix and representative rejected mismatches, including an imported report paired with builtin trust and `trusted: true` paired with `untrusted_import`. An untrusted imported complete result may be rendered by `advisory` with every compatibility coerced to `unknown`, but it produces decision `error` for `declared` and `coordinated`; detector output cannot self-assert trust.

- [ ] **Step 2: Write failing exact-coverage regressions**

Cover:

- exact declared coverage passes the `declared` preset at PROPOSED;
- a matching object/path/kind with different before/after fails;
- a completed old number-to-integer declaration cannot cover string-to-boolean;
- active coverage takes precedence over completed history;
- two active declarations produce `SEIP_POLICY_AMBIGUOUS_COVERAGE`;
- withdrawn and rejected declarations never cover;
- a completed declaration covers an exact change only when no active declaration references it.

- [ ] **Step 3: Write failing coordinated-policy tests**

Cover:

- missing or failed `HistoryVerificationResult` produces decision `error`;
- ACCEPTED/ENFORCING/COMPLETED exact declarations are eligible;
- all current-revision latest consumer responses must acknowledge;
- amendment makes older acknowledgement/evidence ineligible;
- zero-consumer explicit ACCEPTED declaration passes;
- no history fallback occurs.

- [ ] **Step 4: Write failing evidence tests**

For evidence mode `all_consumers` and `selected`, assert:

- every required team and required validator covers every declared change;
- source digests and current revision must match;
- later FAILED evidence supersedes earlier PASSED for the same team/validator/change;
- wall-clock age alone does not invalidate evidence;
- untrusted validator IDs do not count.

- [ ] **Step 5: Verify focused failure**

Run:

```bash
npm run build && node --test test/v1/policy.test.mjs
```

Expected: FAIL because `evaluatePolicy` is not exported.

- [ ] **Step 6: Implement explicit policy input and result contracts**

Implement `DetectionReport`, `DetectorTrust`, `HistoryVerificationResult`, `EvidenceRequirement`, and `PolicyInput` exactly as frozen in the **Pure policy input** section above. Keep trust separate from detector-controlled output. Use this result contract:

```ts
export type PolicyPreset = "advisory" | "declared" | "coordinated";
export type PolicyDecision = "pass" | "fail" | "error";

export interface PolicyResult {
  ok: boolean;
  decision: PolicyDecision;
  diagnostics: Diagnostic[];
  coverage: Array<{
    changeId: string;
    declarationId?: string;
    state: "covered" | "uncovered" | "ambiguous";
  }>;
  history: "verified" | "not_evaluated" | "failed";
}
```

The input carries detector result/provenance, declarations, preset, evidence configuration, and an explicit history result. Do not read config files or Git.

- [ ] **Step 7: Implement deterministic evaluation order**

Evaluate in this order:

1. detector structural success, completeness, error diagnostics, and trusted provenance;
2. declaration validation;
3. coordinated-history requirement;
4. current breaking/unknown changes sorted by `change_id`;
5. active/completed coverage precedence;
6. preset status requirement;
7. current-revision acknowledgement requirement;
8. optional evidence requirement;
9. stable diagnostic and coverage ordering.

Advisory mode reports uncovered changes but passes only when detection itself is complete and valid. Expected policy findings are decision `fail`; invalid inputs and missing coordinated history are decision `error`.

- [ ] **Step 8: Run focused and complete tests**

```bash
npm run build
node --test test/v1/policy.test.mjs
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/policy.ts src/core/index.ts test/v1/policy.test.mjs
git commit -m "feat: enforce exact v1 change coverage"
```

## Task 8: Publish the v1 Core Boundary Inside the Unreleased Branch

**Files:**
- Modify: `src/index.ts`
- Modify: `src/core/index.ts`
- Modify: `package.json`
- Create: `test/v1/public-api.test.mjs`
- Modify: `docs/superpowers/specs/2026-07-11-production-v1-design.md` only if implementation exposed a verified, necessary clarification; do not rewrite the approved design for convenience.

- [ ] **Step 1: Write the failing public-boundary test**

Create `test/v1/public-api.test.mjs` that imports `../../dist/index.js` and checks only the approved core exports. Assert no storage, Slack delivery, current-working-directory helpers, or process-exiting CLI functions are exported.

Expected core exports include:

```js
[
  "acceptDeclaration",
  "amendDeclaration",
  "canonicalize",
  "completeDeclaration",
  "computeChangeId",
  "createDeclaration",
  "evaluatePolicy",
  "normalizeDecimalLexeme",
  "proposeDeclaration",
  "recordConsumerResponse",
  "rejectDeclaration",
  "sortChanges",
  "startEnforcement",
  "validateDeclaration",
  "validateProtocolSchema",
  "validateProtocolVersion",
  "withdrawDeclaration"
]
```

- [ ] **Step 2: Verify the boundary test fails if the barrel is incomplete**

Run:

```bash
npm run build && node --test test/v1/public-api.test.mjs
```

Expected: FAIL for missing or extra exports until the barrel is curated.

- [ ] **Step 3: Curate the root and package metadata**

Update `src/core/index.ts` and `src/index.ts` with explicit named exports; do not use wildcard exports from generated internals.

Update `package.json`:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schema": "./seip.schema.json",
    "./legacy": "./src/index.mjs"
  },
  "files": [
    "bin/",
    "dist/",
    "src/index.mjs",
    "src/notify.js",
    "examples/",
    "action.yml",
    "README.md",
    "SPEC.md",
    "seip.schema.json"
  ]
}
```

The `./legacy` export is temporary and explicitly unsupported for v1 consumers; it exists only so remaining repository examples can migrate in later phases. Do not document it as a stable API.

- [ ] **Step 4: Run all phase verification commands**

Run:

```bash
npm run generate
npm run build
node --test test/v1/*.test.mjs
npm test
npm pack --dry-run
pack_dir=$(mktemp -d)
trap 'rm -rf "$pack_dir"' EXIT
npm pack --pack-destination "$pack_dir"
mkdir "$pack_dir/app"
(
  cd "$pack_dir/app"
  npm init -y >/dev/null
  npm install --omit=dev "$pack_dir"/seip-*.tgz >/dev/null
  node -e 'const p = require("./node_modules/seip/package.json"); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1)'
  node --input-type=module -e 'import { validateProtocolSchema } from "seip"; const r = validateProtocolSchema({ created_at: "not-a-date" }); if (r.ok || !r.diagnostics.some((d) => d.path === "/created_at")) process.exit(1)'
)
git diff --check
git status --short
```

Expected:

- all v1 tests pass;
- all original 45 tests pass;
- the package dry run includes `dist/`, schema, CLI, and required legacy runtime files;
- a clean consumer install with development dependencies omitted can import and execute the bundled date-time validator, and the installed package declares no runtime dependencies;
- no generated-file drift exists;
- only intentional Task 8 files are modified.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/core/index.ts package.json test/v1/public-api.test.mjs
git commit -m "feat: expose the SEIP v1 core API"
```

## Phase 1 Completion Checkpoint

- [ ] Run @superpowers:verification-before-completion over the exact commands in Task 8.
- [ ] Run @superpowers:requesting-code-review against the Phase 1 commit range.
- [ ] Confirm the worktree is clean.
- [ ] Confirm no npm publish, push, external message, GitHub setting, or release action occurred.
- [ ] Record any implementation-driven design clarification as a separate reviewed spec amendment.
- [ ] Only after Phase 1 is accepted, write the Phase 2 detector and migration plan against the actual resulting tree.

Phase 1 is complete when the new core is typed, deterministic, total over arbitrary declaration input, fail-closed, exactly covered, fully tested, and available through the v1 root export while the existing CLI and demos still pass unchanged.
