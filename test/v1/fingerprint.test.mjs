import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import {
  canonicalize,
  computeChangeId,
  normalizeDecimalLexeme,
  sortChanges,
} from "../../dist/core/index.js";

void canonicalize;
void computeChangeId;
void sortChanges;

const PROPERTY_SEED = 0x5e1f2026;
const PROPERTY_RUNS = 200;

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    [code],
  );
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.severity === "error"));
}

function hasUnsafeInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && !Number.isSafeInteger(value);
  }
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasUnsafeInteger);
  return Object.values(value).some(hasUnsafeInteger);
}

function reverseRecordInsertion(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(reverseRecordInsertion);

  const reordered = Object.create(null);
  for (const [key, nested] of Object.entries(value).reverse()) {
    Object.defineProperty(reordered, key, {
      configurable: true,
      enumerable: true,
      value: reverseRecordInsertion(nested),
      writable: true,
    });
  }
  return reordered;
}

test("normalizes strict JSON decimal lexemes without IEEE-754 conversion", () => {
  const cases = [
    ["0", "0e0"],
    ["-0", "0e0"],
    ["1", "1e0"],
    ["1.0", "1e0"],
    ["10e-1", "1e0"],
    ["1200", "12e2"],
    ["0.00120", "12e-4"],
    ["9007199254740993", "9007199254740993e0"],
    ["1e-400", "1e-400"],
  ];

  for (const [lexeme, expected] of cases) {
    assert.deepEqual(normalizeDecimalLexeme(lexeme), {
      ok: true,
      value: expected,
      diagnostics: [],
    });
  }
});

test("normalizes sign and exponent variants with BigInt exponent arithmetic", () => {
  const cases = [
    ["-12.3400E+0005", "-1234e3"],
    ["-100E-0002", "-1e0"],
    ["0.000e-999999999999999999999999", "0e0"],
    ["1E+999999999999999999999999", "1e999999999999999999999999"],
    ["1000e-999999999999999999999999", "1e-999999999999999999999996"],
  ];

  for (const [lexeme, expected] of cases) {
    assert.deepEqual(normalizeDecimalLexeme(lexeme), {
      ok: true,
      value: expected,
      diagnostics: [],
    });
  }
});

test("rejects non-JSON and non-string decimal lexemes deterministically", () => {
  const invalid = [
    "NaN",
    "Infinity",
    "01",
    "-01",
    "1.",
    ".1",
    "1e",
    "1e+",
    "0x10",
    "+1",
    " 1",
    "1 ",
    "--1",
    null,
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1,
    1n,
    {},
  ];

  for (const value of invalid) {
    const first = normalizeDecimalLexeme(value);
    const second = normalizeDecimalLexeme(value);
    assertFailure(first, "SEIP_CANONICAL_DECIMAL_INVALID");
    assert.deepEqual(first, second);
  }
});

test("canonicalizes records by raw UTF-16 code units and ignores insertion order", () => {
  const astral = "\u{10000}";
  const bmp = "\ue000";
  const first = { [bmp]: 3, z: 4, [astral]: 2, a: 1 };
  const second = { a: 1, [astral]: 2, [bmp]: 3, z: 4 };
  const expected = `{"a":1,"z":4,"${astral}":2,"${bmp}":3}`;

  assert.deepEqual(canonicalize(first), {
    ok: true,
    value: expected,
    diagnostics: [],
  });
  assert.deepEqual(canonicalize(second), canonicalize(first));
});

test("preserves array order and does not normalize Unicode", () => {
  assert.deepEqual(canonicalize(["third", "second", "first"]), {
    ok: true,
    value: '["third","second","first"]',
    diagnostics: [],
  });

  const composed = canonicalize("é");
  const decomposed = canonicalize("e\u0301");
  assert.equal(composed.ok, true);
  assert.equal(decomposed.ok, true);
  assert.notDeepEqual(composed, decomposed);
});

test("uses JSON.stringify escaping and shortest finite number spellings", () => {
  const strings = [
    'quote"slash\\',
    "\b\f\n\r\t\u0000",
    "\u2028\u2029",
    "\ud800",
    "\udfff",
  ];
  for (const value of strings) {
    assert.deepEqual(canonicalize(value), {
      ok: true,
      value: JSON.stringify(value),
      diagnostics: [],
    });
  }

  for (const value of [-0, 0, 1.5, 1e-7, 1.2345678901234567, 5e-324]) {
    assert.deepEqual(canonicalize(value), {
      ok: true,
      value: JSON.stringify(value),
      diagnostics: [],
    });
  }
  assert.deepEqual(canonicalize(null), {
    ok: true,
    value: "null",
    diagnostics: [],
  });
  assert.deepEqual(canonicalize(true), {
    ok: true,
    value: "true",
    diagnostics: [],
  });
});

test("rejects non-finite and unsafe integer numbers", () => {
  for (const value of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    9_007_199_254_740_992,
    -9_007_199_254_740_992,
    1e20,
    1e21,
    { nested: 9_007_199_254_740_992 },
  ]) {
    assertFailure(canonicalize(value), "SEIP_CANONICAL_JSON_INVALID");
  }
});

test("rejects reflection-unsafe JSON lookalikes without throwing or mutation", () => {
  const sparse = [];
  sparse[1] = "present";
  const extraArray = Object.assign([], { extra: true });
  const cycle = {};
  cycle.self = cycle;
  const symbolKey = { safe: true };
  symbolKey[Symbol("hidden")] = true;
  const cases = [
    undefined,
    1n,
    Symbol("value"),
    () => true,
    new Date(0),
    Object.assign(Object.create({ inherited: true }), { own: true }),
    sparse,
    extraArray,
    symbolKey,
    cycle,
    new Proxy({}, { ownKeys() { throw new Error("must not reflect"); } }),
  ];

  let accessorInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "secret", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      throw new Error("must not invoke");
    },
  });
  cases.push(accessor);

  for (const value of cases) {
    let first;
    assert.doesNotThrow(() => {
      first = canonicalize(value);
    });
    assertFailure(first, "SEIP_CANONICAL_JSON_INVALID");
    assert.deepEqual(first, canonicalize(value));
  }
  assert.equal(accessorInvoked, false);
});

test("accepts a small shared JSON DAG without mutating it", () => {
  const shared = { leaf: [null, true, "value", 1.25] };
  const value = { right: shared, left: shared };
  const before = structuredClone(value);

  assert.deepEqual(canonicalize(value), {
    ok: true,
    value:
      '{"left":{"leaf":[null,true,"value",1.25]},"right":{"leaf":[null,true,"value",1.25]}}',
    diagnostics: [],
  });
  assert.deepEqual(value, before);
  assert.equal(value.left, value.right);
});

test(`canonicalization properties are reproducible (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
  fc.assert(
    fc.property(
      fc.jsonValue({ maxDepth: 4 }).filter((value) => !hasUnsafeInteger(value)),
      (value) => {
        const before = structuredClone(value);
        const first = canonicalize(value);
        const second = canonicalize(value);
        assert.equal(first.ok, true);
        assert.deepEqual(first, second);
        assert.deepEqual(value, before);

        if (value !== null && typeof value === "object") {
          assert.deepEqual(canonicalize(reverseRecordInsertion(value)), first);
        }
      },
    ),
    { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS },
  );
});

const BASE_CHANGE = {
  fingerprint_version: "1",
  schema_kind: "json-schema",
  target: {
    object: "transaction",
    path: [{ type: "property", name: "value" }],
  },
  kind: "retype",
  compatibility: "breaking",
  before: { type: "number" },
  after: { type: "integer" },
};

const BASE_CHANGE_ID =
  "chg_sha256_65b780d6cca1e025c6c1eb89bcfea5f26932ce09414429a3954d5a4877bc5b93";

function changeWith(overrides = {}) {
  return { ...structuredClone(BASE_CHANGE), ...overrides };
}

function changeIdOf(value) {
  const result = computeChangeId(value);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}

function withComputedId(value) {
  return { ...structuredClone(value), change_id: changeIdOf(value) };
}

function snapshotShape(kind, snapshots = {}) {
  const value = changeWith({ kind });
  delete value.before;
  delete value.after;
  return Object.assign(value, snapshots);
}

test("computes the independent v1 SHA-256 fixture", () => {
  assert.deepEqual(computeChangeId(BASE_CHANGE), {
    ok: true,
    value: BASE_CHANGE_ID,
    diagnostics: [],
  });

  assert.deepEqual(
    canonicalize({
      after: { type: "integer" },
      before: { type: "number" },
      fingerprint_version: "1",
      kind: "retype",
      schema_kind: "json-schema",
      target: {
        object: "transaction",
        path: [{ name: "value", type: "property" }],
      },
    }),
    {
      ok: true,
      value:
        '{"after":{"type":"integer"},"before":{"type":"number"},"fingerprint_version":"1","kind":"retype","schema_kind":"json-schema","target":{"object":"transaction","path":[{"name":"value","type":"property"}]}}',
      diagnostics: [],
    },
  );
});

test("excludes compatibility, incoming IDs, detector metadata, and extensions", () => {
  const variants = [
    BASE_CHANGE,
    changeWith({ compatibility: "compatible" }),
    changeWith({ compatibility: "unknown" }),
    changeWith({ change_id: "forged-or-legacy" }),
    changeWith({
      detector: { name: "schema-detector", version: "99.0.0" },
      detector_name: "other",
      detector_version: "1",
      extension: [null, true, "value", 1.25],
    }),
    changeWith({
      target: {
        ...structuredClone(BASE_CHANGE.target),
        detector_name: "target-detector",
        detector_version: "2",
        extension: { safe: true },
      },
    }),
  ];

  for (const value of variants) {
    assert.equal(changeIdOf(value), BASE_CHANGE_ID);
  }
});

test("fingerprints every semantic field and keeps tagged paths injective", () => {
  const variants = [
    changeWith({ before: { type: "float" } }),
    changeWith({ after: { type: "int64" } }),
    changeWith({ kind: "rename" }),
    changeWith({ schema_kind: "avro" }),
    changeWith({
      target: { ...structuredClone(BASE_CHANGE.target), object: "payment" },
    }),
    changeWith({
      target: {
        ...structuredClone(BASE_CHANGE.target),
        path: [{ type: "property", name: "other" }],
      },
    }),
  ];
  const ids = variants.map(changeIdOf);
  assert.ok(ids.every((id) => id !== BASE_CHANGE_ID));
  assert.equal(new Set(ids).size, ids.length);

  const paths = [
    [{ type: "property", name: "*" }],
    [{ type: "items" }],
    [{ type: "property", name: "/" }],
    [{ type: "property", name: "~" }],
    [{ type: "property", name: "" }],
    [{ type: "tuple_item", index: 0 }],
  ];
  const pathIds = paths.map((path) =>
    changeIdOf(
      changeWith({
        target: { ...structuredClone(BASE_CHANGE.target), path },
      }),
    ),
  );
  assert.equal(new Set(pathIds).size, paths.length);
});

test("normalizes CanonicalValue object entries and rejects duplicate keys", () => {
  const entries = [
    { key: "z", value: { kind: "number", decimal: "1e0" } },
    { key: "a", value: { kind: "string", value: "one" } },
  ];
  const first = changeWith({
    before: { enum: { kind: "object", entries } },
  });
  const second = changeWith({
    before: { enum: { kind: "object", entries: entries.toReversed() } },
  });
  assert.equal(changeIdOf(first), changeIdOf(second));

  const injective = [
    first,
    changeWith({
      before: {
        enum: {
          kind: "object",
          entries: [
            { key: "a", value: { kind: "string", value: "z" } },
          ],
        },
      },
    }),
    changeWith({
      before: {
        enum: {
          kind: "array",
          items: [{ kind: "string", value: "one" }],
        },
      },
    }),
    changeWith({ before: { enum: { entries: ["a", "one"] } } }),
  ].map(changeIdOf);
  assert.equal(new Set(injective).size, injective.length);

  const duplicate = changeWith({
    before: {
      enum: {
        kind: "object",
        entries: [
          { key: "same", value: { kind: "null" } },
          { key: "same", value: { kind: "boolean", value: true } },
        ],
      },
    },
  });
  assertFailure(computeChangeId(duplicate), "SEIP_PROTOCOL_CHANGE_INVALID");
});

test("normalizes tagged objects without changing shared ordered-array semantics", () => {
  const entries = [
    { key: "z", value: { kind: "null" } },
    { key: "a", value: { kind: "string", value: "first" } },
  ];
  const sharedDag = changeWith({
    before: {
      enum: { kind: "object", entries },
      ordered: entries,
    },
  });
  const equivalentTree = changeWith({
    before: {
      enum: { kind: "object", entries: structuredClone(entries) },
      ordered: structuredClone(entries),
    },
  });
  const before = structuredClone(sharedDag);

  assert.equal(changeIdOf(sharedDag), changeIdOf(equivalentTree));
  assert.deepEqual(sharedDag, before);
});

test("requires tagged decimal values to already be canonical", () => {
  const canonical = changeWith({
    before: { minimum: { kind: "number", decimal: "12e-4" } },
  });
  assert.match(changeIdOf(canonical), /^chg_sha256_[0-9a-f]{64}$/);

  for (const decimal of ["0", "1.0", "01e0", "1e+0", "1e00", "-0e0"] ) {
    assertFailure(
      computeChangeId(
        changeWith({
          before: { minimum: { kind: "number", decimal } },
        }),
      ),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
  }
});

test("distinguishes absence from null canonically while changes require record snapshots", () => {
  const absent = canonicalize({ kind: "detector:change" });
  const presentNull = canonicalize({ kind: "detector:change", before: null });
  assert.equal(absent.ok, true);
  assert.equal(presentNull.ok, true);
  assert.notDeepEqual(absent, presentNull);

  assertFailure(
    computeChangeId(changeWith({ before: null })),
    "SEIP_PROTOCOL_CHANGE_INVALID",
  );
});

test("enforces standard and detector-specific snapshot shapes", () => {
  for (const kind of ["add", "object_add"]) {
    changeIdOf(snapshotShape(kind, { after: { type: "string" } }));
    assertFailure(
      computeChangeId(
        snapshotShape(kind, {
          before: { type: "never" },
          after: { type: "string" },
        }),
      ),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
    assertFailure(
      computeChangeId(snapshotShape(kind)),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
  }

  for (const kind of ["remove", "object_remove"]) {
    changeIdOf(snapshotShape(kind, { before: { type: "string" } }));
    assertFailure(
      computeChangeId(
        snapshotShape(kind, {
          before: { type: "string" },
          after: { type: "never" },
        }),
      ),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
    assertFailure(
      computeChangeId(snapshotShape(kind)),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
  }

  for (const kind of [
    "rename",
    "retype",
    "make_required",
    "make_optional",
    "make_non_nullable",
    "make_nullable",
    "enum_narrow",
    "enum_widen",
    "format_change",
    "constraint_change",
    "deprecate",
  ]) {
    changeIdOf(
      snapshotShape(kind, {
        before: { state: "before" },
        after: { state: "after" },
      }),
    );
    assertFailure(
      computeChangeId(snapshotShape(kind, { before: { state: "before" } })),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
    assertFailure(
      computeChangeId(snapshotShape(kind, { after: { state: "after" } })),
      "SEIP_PROTOCOL_CHANGE_INVALID",
    );
  }

  changeIdOf(snapshotShape("unknown", { before: { known: "before" } }));
  changeIdOf(snapshotShape("unknown", { after: { known: "after" } }));
  changeIdOf(
    snapshotShape("unknown", {
      before: { known: "before" },
      after: { known: "after" },
    }),
  );
  assertFailure(
    computeChangeId(snapshotShape("unknown")),
    "SEIP_PROTOCOL_CHANGE_INVALID",
  );

  changeIdOf(snapshotShape("detector:custom"));
  changeIdOf(
    snapshotShape("detector:custom", { before: { optional: "snapshot" } }),
  );
  changeIdOf(
    snapshotShape("detector:custom", { after: { optional: "snapshot" } }),
  );
});

test("validates every complete change field but ignores the incoming ID", () => {
  assert.equal(changeIdOf(BASE_CHANGE), BASE_CHANGE_ID);
  assert.equal(
    changeIdOf(changeWith({ change_id: "not-a-normalized-change-id" })),
    BASE_CHANGE_ID,
  );

  const malformed = [
    null,
    false,
    "change",
    1,
    [],
    {},
    changeWith({ fingerprint_version: "2" }),
    changeWith({ schema_kind: "" }),
    changeWith({ kind: "" }),
    changeWith({ kind: "custom-without-colon" }),
    changeWith({ kind: ":missing-prefix" }),
    changeWith({ kind: "missing-suffix:" }),
    changeWith({ compatibility: "sometimes" }),
    changeWith({ target: { object: "", path: [] } }),
    changeWith({ target: { object: "transaction", path: "value" } }),
    changeWith({
      target: { object: "transaction", path: [{ type: "items", extra: true }] },
    }),
    changeWith({
      target: { object: "transaction", path: [{ type: "property" }] },
    }),
    changeWith({
      target: {
        object: "transaction",
        path: [{ type: "property", name: "x", extra: true }],
      },
    }),
    changeWith({
      target: { object: "transaction", path: [{ type: "tuple_item", index: -1 }] },
    }),
    changeWith({
      target: { object: "transaction", path: [{ type: "tuple_item", index: 1.5 }] },
    }),
    changeWith({
      target: {
        object: "transaction",
        path: [{ type: "tuple_item", index: 9_007_199_254_740_992 }],
      },
    }),
    changeWith({ before: { minimum: 1 } }),
    changeWith({ before: { nested: [{ minimum: 1 }] } }),
    changeWith({ before: { tag: { kind: "null", extra: true } } }),
    changeWith({ before: { tag: { kind: "boolean", value: "true" } } }),
    changeWith({ before: { tag: { kind: "array", items: [null] } } }),
    changeWith({ before: { tag: { kind: "object", entries: [{ key: "x" }] } } }),
  ];

  for (const value of malformed) {
    let first;
    assert.doesNotThrow(() => {
      first = computeChangeId(value);
    });
    assertFailure(first, "SEIP_PROTOCOL_CHANGE_INVALID");
    assert.deepEqual(first, computeChangeId(value));
  }
});

test("rejects proxies, accessors, unsupported prototypes, and cycles without throwing", () => {
  const cycle = changeWith();
  cycle.before.self = cycle.before;
  const unsupported = changeWith({ before: { value: new Date(0) } });
  const proxy = new Proxy(changeWith(), {
    ownKeys() {
      throw new Error("must not reflect");
    },
  });
  let accessorInvoked = false;
  const accessorSnapshot = {};
  Object.defineProperty(accessorSnapshot, "secret", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      throw new Error("must not invoke");
    },
  });
  const accessor = changeWith({ before: accessorSnapshot });

  for (const value of [cycle, unsupported, proxy, accessor]) {
    let result;
    assert.doesNotThrow(() => {
      result = computeChangeId(value);
    });
    assertFailure(result, "SEIP_PROTOCOL_CHANGE_INVALID");
    assert.deepEqual(result, computeChangeId(value));
  }
  assert.equal(accessorInvoked, false);
});

function sortableChange({
  marker,
  schema_kind = "a",
  object = "a",
  path = [],
  kind = "retype",
}) {
  return withComputedId({
    fingerprint_version: "1",
    schema_kind,
    target: { object, path, target_extension: { marker } },
    kind,
    compatibility: "breaking",
    before: { marker: `before-${marker}` },
    after: { marker: `after-${marker}` },
    change_extension: { marker },
  });
}

test("sorts full changes by the exact canonical tuple and preserves extensions", () => {
  const schemaB = sortableChange({ marker: "schema-b", schema_kind: "b" });
  const objectB = sortableChange({ marker: "object-b", object: "b" });
  const items = sortableChange({ marker: "items", path: [{ type: "items" }] });
  const property = sortableChange({
    marker: "property",
    path: [{ type: "property", name: "a" }],
  });
  const tuple = sortableChange({
    marker: "tuple",
    path: [{ type: "tuple_item", index: 0 }],
  });
  const rename = sortableChange({ marker: "rename", kind: "rename" });
  const tieA = sortableChange({ marker: "tie-a" });
  const tieB = sortableChange({ marker: "tie-b" });
  const ties = [tieA, tieB].sort((left, right) =>
    left.change_id < right.change_id ? -1 : left.change_id > right.change_id ? 1 : 0,
  );
  const expected = [rename, ...ties, tuple, property, items, objectB, schemaB];
  const input = [schemaB, items, tieB, objectB, property, rename, tieA, tuple];
  const before = structuredClone(input);

  const result = sortChanges(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(
    result.value.map((change) => change.change_id),
    expected.map((change) => change.change_id),
  );
  assert.deepEqual(input, before);
  assert.deepEqual(result.value[0].change_extension, rename.change_extension);
  assert.deepEqual(result.value[0].target.target_extension, rename.target.target_extension);

  const alternateInput = input.toReversed().map((change, index) => {
    const alternate = reverseRecordInsertion(change);
    alternate.compatibility = index % 2 === 0 ? "compatible" : "unknown";
    return alternate;
  });
  const alternate = sortChanges(alternateInput);
  assert.equal(alternate.ok, true, JSON.stringify(alternate));
  assert.deepEqual(
    alternate.value.map((change) => change.change_id),
    expected.map((change) => change.change_id),
  );
});

test("sortChanges rejects incomplete, forged, unsafe, and cyclic arrays", () => {
  const valid = sortableChange({ marker: "valid" });
  const forged = {
    ...structuredClone(valid),
    change_id: `chg_sha256_${"0".repeat(64)}`,
  };
  assertFailure(sortChanges([forged]), "SEIP_PROTOCOL_CHANGE_ID_MISMATCH");

  const malformedId = { ...structuredClone(valid), change_id: "short" };
  for (const value of [null, {}, [BASE_CHANGE], [malformedId], [null]]) {
    assertFailure(sortChanges(value), "SEIP_PROTOCOL_CHANGE_INVALID");
  }

  const cycle = [valid];
  cycle.push(cycle);
  assertFailure(sortChanges(cycle), "SEIP_PROTOCOL_CHANGE_INVALID");
});
