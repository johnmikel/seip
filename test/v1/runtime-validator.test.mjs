import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateProtocolSchema } from "../../dist/core/protocol-schema.js";

const fixtures = new URL("../fixtures/v1/", import.meta.url);

async function loadFixture(path) {
  return JSON.parse(await readFile(new URL(path, fixtures), "utf8"));
}

test("runtime validator clones omit redundant keyed deep equality", async () => {
  const declarationSchema = JSON.parse(
    await readFile(new URL("../../seip.schema.json", import.meta.url), "utf8"),
  );
  const amendmentSchema = JSON.parse(
    await readFile(
      new URL("../../seip.amendment.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const generated = await Promise.all([
    readFile(
      new URL("../../src/generated/protocol-validator.cjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../src/generated/amendment-validator.cjs", import.meta.url),
      "utf8",
    ),
  ]);

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

  for (const source of generated) {
    assert.doesNotMatch(source, /fast-deep-equal|runtime\/equal|require_equal/);
  }
});

test("primitive uniqueItems remain enforced on the runtime clone", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");
  declaration.evidence[0].change_ids.push(
    declaration.evidence[0].change_ids[0],
  );

  const result = validateProtocolSchema(declaration);
  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === "/evidence/0/change_ids" &&
        diagnostic.message.includes("duplicate items"),
    ),
  );
});

test("large keyed arrays validate within a bounded linear-time budget", {
  timeout: 15_000,
}, async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  declaration.consumers = Array.from(
    { length: 20_000 },
    (_, index) => ({ team: `consumer-${index}` }),
  );

  const startedAt = performance.now();
  const result = validateProtocolSchema(declaration);
  const elapsedMs = performance.now() - startedAt;

  assert.deepEqual(result, { ok: true, diagnostics: [] });
  assert.ok(
    elapsedMs < 2_000,
    `expected validation under 2000ms, received ${Math.round(elapsedMs)}ms`,
  );
});
