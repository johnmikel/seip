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
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "/consumers/0"));
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

test("accepts a valid lifecycle amendment including merge-patch nulls", async () => {
  const amendment = await loadFixture("valid/amendment.json");

  assert.deepEqual(validateAmendmentSchema(amendment), {
    ok: true,
    diagnostics: [],
  });
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
