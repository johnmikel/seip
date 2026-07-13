import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  validateAmendmentSchema,
  validateProtocolSchema,
} from "../../dist/core/protocol-schema.js";

const fixtures = new URL("../fixtures/v1/", import.meta.url);

async function loadFixture(path) {
  return JSON.parse(await readFile(new URL(path, fixtures), "utf8"));
}

function assertInvalid(result, code) {
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.length > 0);
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.code === code));
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.severity === "error"));
}

test("accepts the minimal v1 declaration", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");

  assert.deepEqual(validateProtocolSchema(declaration), {
    ok: true,
    diagnostics: [],
  });
});

test("rejects a one-change declaration missing change_id", async () => {
  const declaration = await loadFixture("invalid/missing-change-id.json");

  const result = validateProtocolSchema(declaration);

  assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "/changes/0"));
  assert.deepEqual(result, validateProtocolSchema(declaration));
});

test("normalizes diagnostics independently of object key insertion order", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const forward = structuredClone(declaration);
  forward.changes[0].after = { alpha: 1, beta: 2 };
  const reverse = structuredClone(declaration);
  reverse.changes[0].after = { beta: 2, alpha: 1 };

  assert.deepEqual(
    validateProtocolSchema(forward),
    validateProtocolSchema(reverse),
  );
});

test("rejects the v0.1 consumer status field", async () => {
  const declaration = await loadFixture("invalid/consumer-status.json");

  const result = validateProtocolSchema(declaration);

  assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.path === "/consumers/0/status",
    ),
  );
});

test("executes RFC 3339 date-time validation in the bundled validator", async () => {
  const declaration = await loadFixture("invalid/invalid-created-at.json");

  const result = validateProtocolSchema(declaration);

  assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "/created_at"));
});

test("accepts unknown optional fields at every extensible declaration record", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");

  assert.deepEqual(validateProtocolSchema(declaration), {
    ok: true,
    diagnostics: [],
  });
});

test("keeps every tagged path variant closed", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const variants = [
    { type: "property", name: "status", unexpected: true },
    { type: "items", unexpected: true },
    { type: "tuple_item", index: 0, unexpected: true },
  ];

  for (const variant of variants) {
    const candidate = structuredClone(declaration);
    candidate.changes[0].target.path = [variant];
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }
});

test("keeps canonical-value variants closed and rejects bare snapshot numbers", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const closedVariant = structuredClone(declaration);
  closedVariant.changes[0].after = {
    kind: "number",
    decimal: "1e0",
    unexpected: true,
  };
  assertInvalid(validateProtocolSchema(closedVariant), "SEIP_PROTOCOL_SCHEMA_INVALID");

  const bareNumber = structuredClone(declaration);
  bareNumber.changes[0].after = 42;
  assertInvalid(validateProtocolSchema(bareNumber), "SEIP_PROTOCOL_SCHEMA_INVALID");

  const canonicalNumber = structuredClone(declaration);
  canonicalNumber.changes[0].after = { kind: "number", decimal: "1e0" };
  assert.equal(validateProtocolSchema(canonicalNumber).ok, true);
});

test("accepts only the canonical decimal spelling", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const declarationSchema = JSON.parse(
    await readFile(new URL("../../seip.schema.json", import.meta.url), "utf8"),
  );
  assert.equal(
    declarationSchema.$defs.CanonicalNumber.properties.decimal.pattern,
    "^(?:0e0|-?[1-9](?:[0-9]*[1-9])?e(?:0|-?[1-9][0-9]*))$",
  );

  for (const decimal of ["0e0", "1e0", "-1e0", "123e-4", "101e2"]) {
    const candidate = structuredClone(declaration);
    candidate.changes[0].after = { kind: "number", decimal };
    assert.equal(validateProtocolSchema(candidate).ok, true, decimal);
  }

  for (const decimal of [
    "1e-0",
    "1e00",
    "1e+0",
    "10e0",
    "01e0",
    "-01e0",
  ]) {
    const candidate = structuredClone(declaration);
    candidate.changes[0].after = { kind: "number", decimal };
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }
});

test("wrappers enforce keyed uniqueness beyond standard uniqueItems", async () => {
  const declarationSchema = JSON.parse(
    await readFile(new URL("../../seip.schema.json", import.meta.url), "utf8"),
  );
  const amendmentSchema = JSON.parse(
    await readFile(
      new URL("../../seip.amendment.schema.json", import.meta.url),
      "utf8",
    ),
  );

  for (const field of ["changes", "consumers", "responses", "evidence", "events"]) {
    assert.equal(declarationSchema.properties[field].uniqueItems, true, field);
  }
  assert.equal(
    declarationSchema.$defs.CanonicalObject.properties.entries.uniqueItems,
    true,
  );
  assert.equal(
    amendmentSchema.$defs.ConsumerOperations.properties.add.uniqueItems,
    true,
  );
  assert.equal(
    amendmentSchema.$defs.ConsumerOperations.properties.update.uniqueItems,
    true,
  );

  const extended = await loadFixture("valid/extended-declaration.json");
  const declarationCases = [];

  const changes = structuredClone(extended);
  changes.changes.push({
    ...structuredClone(changes.changes[0]),
    target: {
      ...structuredClone(changes.changes[0].target),
      object: "ArchivedOrder",
    },
  });
  declarationCases.push([changes, "/changes/1/change_id"]);

  const consumers = structuredClone(extended);
  consumers.consumers.push({
    ...structuredClone(consumers.consumers[0]),
    contact: "different@example.com",
  });
  declarationCases.push([consumers, "/consumers/1/team"]);

  const responses = structuredClone(extended);
  responses.responses.push({
    ...structuredClone(responses.responses[0]),
    message: "A different response with the same identity.",
  });
  declarationCases.push([responses, "/responses/1/response_id"]);

  const evidence = structuredClone(extended);
  evidence.evidence.push({
    ...structuredClone(evidence.evidence[0]),
    summary: "Different evidence with the same identity.",
  });
  declarationCases.push([evidence, "/evidence/1/evidence_id"]);

  const events = structuredClone(extended);
  events.events.push({
    ...structuredClone(events.events[0]),
    actor: "a-different-actor",
  });
  declarationCases.push([events, "/events/1/event_id"]);

  const canonicalEntries = structuredClone(extended);
  canonicalEntries.changes[0].after = {
    kind: "object",
    entries: [
      { key: "state", value: { kind: "string", value: "old" } },
      { key: "state", value: { kind: "string", value: "new" } },
    ],
  };
  declarationCases.push([
    canonicalEntries,
    "/changes/0/after/entries/1/key",
  ]);

  // Each pair differs structurally, so schema `uniqueItems` alone cannot reject it.
  for (const [candidate, expectedPath] of declarationCases) {
    const result = validateProtocolSchema(candidate);
    assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
    assert.ok(
      result.diagnostics.some((diagnostic) => diagnostic.path === expectedPath),
      expectedPath,
    );
    assert.deepEqual(result, validateProtocolSchema(candidate));
  }

  const amendmentCases = [
    [
      {
        consumers: {
          add: [
            { team: "risk", contact: "risk@example.com" },
            { team: "risk", contact: "risk-oncall@example.com" },
          ],
        },
      },
      "/consumers/add/1/team",
    ],
    [
      {
        consumers: {
          update: [
            { team: "analytics", contact: "one@example.com" },
            { team: "analytics", contact: "two@example.com" },
          ],
        },
      },
      "/consumers/update/1/team",
    ],
  ];
  for (const [candidate, expectedPath] of amendmentCases) {
    const result = validateAmendmentSchema(candidate);
    assertInvalid(result, "SEIP_LIFECYCLE_AMENDMENT_INVALID");
    assert.ok(
      result.diagnostics.some((diagnostic) => diagnostic.path === expectedPath),
      expectedPath,
    );
    assert.deepEqual(result, validateAmendmentSchema(candidate));
  }
});

test("semantic uniqueness checks respect ownProperties", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const change = declaration.changes[0];
  delete change.after;
  change.kind = "warehouse:detector";
  Object.setPrototypeOf(change, {
    after: {
      kind: "object",
      entries: [
        { key: "state", value: { kind: "string", value: "old" } },
        { key: "state", value: { kind: "string", value: "new" } },
      ],
    },
  });
  assert.equal(validateProtocolSchema(declaration).ok, true);

  const amendment = Object.assign(
    Object.create({
      consumers: {
        add: [
          { team: "risk", contact: "one@example.com" },
          { team: "risk", contact: "two@example.com" },
        ],
      },
    }),
    { intent: { summary: "Clarified migration" } },
  );
  assert.equal(validateAmendmentSchema(amendment).ok, true);
});

test("rejects duplicate migration steps in declarations and amendments", async () => {
  const declarationSchema = JSON.parse(
    await readFile(new URL("../../seip.schema.json", import.meta.url), "utf8"),
  );
  const amendmentSchema = JSON.parse(
    await readFile(
      new URL("../../seip.amendment.schema.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    declarationSchema.$defs.Migration.properties.steps.uniqueItems,
    true,
  );
  assert.equal(
    amendmentSchema.$defs.MigrationMergePatch.properties.steps.anyOf.find(
      (variant) => variant.type === "array",
    ).uniqueItems,
    true,
  );

  const declaration = await loadFixture("valid/minimal-declaration.json");
  declaration.intent.migration.steps = ["deploy", "deploy"];
  assertInvalid(validateProtocolSchema(declaration), "SEIP_PROTOCOL_SCHEMA_INVALID");

  assertInvalid(
    validateAmendmentSchema({
      intent: { migration: { steps: ["deploy", "deploy"] } },
    }),
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
});

test("enforces structural snapshot presence for standard change kinds", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const invalidChanges = [
    { kind: "add" },
    { kind: "remove" },
    { kind: "rename", before: { name: "state" } },
    { kind: "unknown" },
  ];

  for (const change of invalidChanges) {
    const candidate = structuredClone(declaration);
    candidate.changes[0] = {
      ...candidate.changes[0],
      ...change,
    };
    delete candidate.changes[0].before;
    delete candidate.changes[0].after;
    if ("before" in change) candidate.changes[0].before = change.before;
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }

  const detectorKind = structuredClone(declaration);
  detectorKind.changes[0].kind = "detector-specific";
  assertInvalid(validateProtocolSchema(detectorKind), "SEIP_PROTOCOL_SCHEMA_INVALID");
  detectorKind.changes[0].kind = "warehouse:detector-specific";
  assert.equal(validateProtocolSchema(detectorKind).ok, true);
});

test("forbids irrelevant snapshots for add and remove aliases", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");

  for (const kind of ["add", "object_add"]) {
    const candidate = structuredClone(declaration);
    candidate.changes[0].kind = kind;
    candidate.changes[0].before = { type: "null" };
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }

  for (const kind of ["remove", "object_remove"]) {
    const candidate = structuredClone(declaration);
    candidate.changes[0].kind = kind;
    candidate.changes[0].before = { type: "string" };
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }
});

test("accepts a valid lifecycle amendment including merge-patch nulls", async () => {
  const amendment = await loadFixture("valid/amendment.json");

  assert.deepEqual(validateAmendmentSchema(amendment), {
    ok: true,
    diagnostics: [],
  });
});

test("validates typed non-empty intent merge patches", () => {
  const validPatches = [
    { intent: { summary: null } },
    { intent: { rationale: null } },
    { intent: { migration: null } },
    { intent: { timeline: null } },
    { intent: { migration: { strategy: null } } },
    { intent: { timeline: { review_deadline: null } } },
    { intent: { extension_flag: { nested: [1, true, null] } } },
  ];
  for (const patch of validPatches) {
    assert.equal(validateAmendmentSchema(patch).ok, true);
  }

  const invalidPatches = [
    { intent: {} },
    { intent: { migration: {} } },
    { intent: { timeline: {} } },
    { intent: { summary: 42 } },
    { intent: { summary: "" } },
    { intent: { rationale: false } },
    { intent: { migration: "replace everything" } },
    { intent: { migration: { strategy: 42 } } },
    { intent: { migration: { steps: "one step" } } },
    { intent: { migration: { rollback: false } } },
    { intent: { timeline: "next week" } },
    { intent: { timeline: { review_deadline: 42 } } },
  ];
  for (const patch of invalidPatches) {
    assertInvalid(
      validateAmendmentSchema(patch),
      "SEIP_LIFECYCLE_AMENDMENT_INVALID",
    );
  }
});

test("rejects identity-only consumer updates", () => {
  assertInvalid(
    validateAmendmentSchema({
      consumers: {
        update: [{ team: "analytics" }],
      },
    }),
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
});

test("publishes RFC 3339 timestamp patterns for annotation-only validators", async () => {
  const declarationSchema = JSON.parse(
    await readFile(new URL("../../seip.schema.json", import.meta.url), "utf8"),
  );
  const amendmentSchema = JSON.parse(
    await readFile(
      new URL("../../seip.amendment.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const patterns = [
    declarationSchema.$defs.Timestamp?.pattern,
    amendmentSchema.$defs.Timestamp?.pattern,
  ];

  assert.deepEqual(patterns.map((pattern) => typeof pattern), ["string", "string"]);
  for (const pattern of patterns) {
    const expression = new RegExp(pattern);
    assert.equal(expression.test("2026-07-13T09:00:00Z"), true);
    assert.equal(expression.test("2024-02-29T09:00:00Z"), true);
    for (const invalid of [
      "2026-02-31T09:00:00Z",
      "2026-04-31T09:00:00Z",
      "2026-13-01T09:00:00Z",
      "2026-07-13T24:00:00Z",
      "2026-07-13T09:00:00+24:00",
      "2026-07-13T09:00:00+01:60",
      "2026/07/13 09:00:00",
    ]) {
      assert.equal(expression.test(invalid), false, invalid);
    }
  }

  // The portable fallback checks calendar shape; Ajv's format check supplies
  // the year-aware leap-day rule.
  const declaration = await loadFixture("valid/minimal-declaration.json");
  declaration.created_at = "2023-02-29T09:00:00Z";
  assertInvalid(validateProtocolSchema(declaration), "SEIP_PROTOCOL_SCHEMA_INVALID");
  assertInvalid(
    validateAmendmentSchema({
      intent: { timeline: { review_deadline: "2023-02-29T09:00:00Z" } },
    }),
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
});

test("rejects credential-bearing artifact query parameters case-insensitively", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");
  const credentialKeys = [
    "client_secret",
    "Authorization",
    "X-Amz-Credential",
    "token",
    "tokens",
    "password",
    "passwords",
    "api_key",
    "API_KEYS",
    "access-key",
    "access_keys",
    "credential",
    "credentials",
    "signature",
    "signatures",
    "X-Amz-Signature",
  ];

  for (const key of credentialKeys) {
    const candidate = structuredClone(declaration);
    candidate.evidence[0].artifact.uri = `https://example.com/report?${key}=secret`;
    assertInvalid(validateProtocolSchema(candidate), "SEIP_PROTOCOL_SCHEMA_INVALID");
  }

  const benign = structuredClone(declaration);
  benign.evidence[0].artifact.uri =
    "https://example.com/report?version=1&region=eu";
  assert.equal(validateProtocolSchema(benign).ok, true);
});

test("generates exact detector kinds and forbids Consumer.status in TypeScript", async () => {
  const generated = await readFile(
    new URL("../../src/generated/protocol-types.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    generated,
    /export type DetectorSpecificChange = NormalizedChangeCore & \{\n  kind: `\$\{string\}:\$\{string\}`;/,
  );
  assert.match(
    generated,
    /export interface Consumer \{[\s\S]*?status\?: never;[\s\S]*?\[k: string\]: unknown;[\s\S]*?\}/,
  );
});

test("rejects amendment reason and declaration-owned fields", async () => {
  const amendment = await loadFixture("valid/amendment.json");
  const forbidden = [
    "reason",
    "protocol_version",
    "declaration_id",
    "created_at",
    "producer",
    "changes",
    "revision",
    "status",
    "responses",
    "evidence",
    "events",
  ];

  for (const field of forbidden) {
    const candidate = structuredClone(amendment);
    candidate[field] = field === "reason" ? "because" : null;
    assertInvalid(validateAmendmentSchema(candidate), "SEIP_LIFECYCLE_AMENDMENT_INVALID");
  }
});

test("keeps amendment operation records closed", async () => {
  const amendment = await loadFixture("valid/amendment.json");
  const candidates = [
    { ...structuredClone(amendment), unexpected: true },
    {
      ...structuredClone(amendment),
      consumers: { ...structuredClone(amendment.consumers), remove: ["analytics"] },
    },
    {
      ...structuredClone(amendment),
      consumers: {
        ...structuredClone(amendment.consumers),
        update: [{ team: "analytics", replacement_team: "warehouse" }],
      },
    },
  ];

  for (const candidate of candidates) {
    assertInvalid(validateAmendmentSchema(candidate), "SEIP_LIFECYCLE_AMENDMENT_INVALID");
  }
});

test("schema wrappers are total over arbitrary JavaScript values", () => {
  const circular = {};
  circular.self = circular;
  const hostile = new Proxy({}, {
    get() {
      throw new Error("hostile getter");
    },
  });
  const values = [
    undefined,
    null,
    false,
    0,
    Number.NaN,
    1n,
    Symbol("value"),
    "text",
    [],
    {},
    circular,
    hostile,
    () => undefined,
  ];

  for (const validate of [validateProtocolSchema, validateAmendmentSchema]) {
    for (const value of values) {
      let result;
      assert.doesNotThrow(() => {
        result = validate(value);
      });
      assert.equal(typeof result.ok, "boolean");
      assert.ok(Array.isArray(result.diagnostics));
    }
  }
});
