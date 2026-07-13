import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  validateAmendmentSchema,
  validateProtocolSchema,
} from "../../dist/core/protocol-schema.js";
import { preflightJsonData } from "../../dist/core/json-data.js";

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

function assertJsonBoundaryFailure(result, code, path) {
  assertInvalid(result, code);
  assert.deepEqual(result.diagnostics, [
    {
      code,
      severity: "error",
      message: "must be JSON data",
      ...(path === undefined ? {} : { path }),
    },
  ]);
}

test("requires fingerprint_version to use the normative string identity", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const stringVersion = structuredClone(declaration);
  stringVersion.changes[0].fingerprint_version = "1";
  assert.equal(validateProtocolSchema(stringVersion).ok, true);

  const numericVersion = structuredClone(declaration);
  numericVersion.changes[0].fingerprint_version = 1;
  assertInvalid(
    validateProtocolSchema(numericVersion),
    "SEIP_PROTOCOL_SCHEMA_INVALID",
  );
});

test("accepts only reflection-safe JSON data before schema validation", async () => {
  const base = await loadFixture("valid/extended-declaration.json");
  const cases = [
    { label: "undefined", value: undefined, path: "/root_extension" },
    { label: "bigint", value: 1n, path: "/root_extension" },
    { label: "function", value: () => true, path: "/root_extension" },
    { label: "symbol", value: Symbol("value"), path: "/root_extension" },
    { label: "NaN", value: Number.NaN, path: "/root_extension" },
    { label: "Infinity", value: Number.POSITIVE_INFINITY, path: "/root_extension" },
    {
      label: "sparse array",
      value: (() => {
        const value = [];
        value[1] = "present";
        return value;
      })(),
      path: "/root_extension/0",
    },
    {
      label: "array property",
      value: Object.assign([], { extra: true }),
      path: "/root_extension/extra",
    },
    { label: "Date", value: new Date(0), path: "/root_extension" },
    {
      label: "class instance",
      value: new (class CustomRecord {
        constructor() {
          this.value = true;
        }
      })(),
      path: "/root_extension",
    },
    {
      label: "custom prototype",
      value: Object.assign(Object.create({ inherited: true }), { own: true }),
      path: "/root_extension",
    },
    {
      label: "non-enumerable property",
      value: (() => {
        const value = {};
        Object.defineProperty(value, "hidden", {
          enumerable: false,
          value: true,
        });
        return value;
      })(),
      path: "/root_extension/hidden",
    },
    {
      label: "symbol key",
      value: (() => {
        const value = {};
        Object.defineProperty(value, Symbol("hidden"), {
          enumerable: true,
          value: true,
        });
        return value;
      })(),
      path: "/root_extension",
    },
    {
      label: "toJSON function",
      value: { toJSON() { return "hidden"; } },
      path: "/root_extension/toJSON",
    },
    {
      label: "cycle",
      value: (() => {
        const value = {};
        value.self = value;
        return value;
      })(),
      path: "/root_extension/self",
    },
    {
      label: "proxy",
      value: new Proxy({}, {
        ownKeys() {
          throw new Error("reflection must not run");
        },
      }),
      path: "/root_extension",
    },
  ];

  let accessorInvoked = false;
  const accessorValue = {};
  Object.defineProperty(accessorValue, "secret", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      throw new Error("accessor must not run");
    },
  });
  cases.push({
    label: "accessor",
    value: accessorValue,
    path: "/root_extension/secret",
  });

  for (const { label, value, path } of cases) {
    const candidate = structuredClone(base);
    candidate.root_extension = value;
    const result = validateProtocolSchema(candidate);
    assertJsonBoundaryFailure(
      result,
      "SEIP_PROTOCOL_SCHEMA_INVALID",
      path,
    );
    assert.equal(accessorInvoked, false, label);
  }

  assertJsonBoundaryFailure(
    validateAmendmentSchema({ intent: { extension: 1n } }),
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
    "/intent/extension",
  );
});

test("accepts dense JSON data, null prototypes, and acyclic sharing", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");
  const shared = { nested: [null, true, "text", 42] };
  declaration.shared_one = shared;
  declaration.shared_two = shared;
  declaration.null_record = Object.assign(Object.create(null), { safe: true });

  const nullPrototypeRoot = Object.assign(Object.create(null), declaration);
  assert.deepEqual(validateProtocolSchema(nullPrototypeRoot), {
    ok: true,
    diagnostics: [],
  });

  const preflight = preflightJsonData(nullPrototypeRoot);
  assert.equal(preflight.ok, true);
  if (preflight.ok) {
    assert.notEqual(preflight.value, nullPrototypeRoot);
    assert.equal(Object.getPrototypeOf(preflight.value), null);
    assert.equal(preflight.value.shared_one, preflight.value.shared_two);
  }
});

test("does not invoke inherited prototype accessors after preflight", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    "contact",
  );
  let accessorInvoked = false;
  let result;

  try {
    Object.defineProperty(Object.prototype, "contact", {
      configurable: true,
      get() {
        accessorInvoked = true;
        throw new Error("inherited accessors must not run");
      },
    });
    result = validateProtocolSchema(declaration);
  } finally {
    if (originalDescriptor === undefined) {
      delete Object.prototype.contact;
    } else {
      Object.defineProperty(Object.prototype, "contact", originalDescriptor);
    }
  }

  assert.equal(accessorInvoked, false);
  assert.deepEqual(result, { ok: true, diagnostics: [] });
});

test("canonicalizes extra array-property diagnostics", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");
  const candidates = [
    Object.assign([], { z: true, a: true }),
    Object.assign([], { a: true, z: true }),
  ];

  const results = candidates.map((extension) => {
    const candidate = structuredClone(declaration);
    candidate.root_extension = extension;
    return validateProtocolSchema(candidate);
  });
  for (const result of results) {
    assertJsonBoundaryFailure(
      result,
      "SEIP_PROTOCOL_SCHEMA_INVALID",
      "/root_extension/a",
    );
  }
  assert.deepEqual(results[0], results[1]);
});

test("rejects a team repeated across amendment add and update", () => {
  const result = validateAmendmentSchema({
    consumers: {
      add: [{ team: "risk", contact: "risk@example.com" }],
      update: [{ team: "risk", contact: "risk-oncall@example.com" }],
    },
  });

  assertInvalid(result, "SEIP_LIFECYCLE_AMENDMENT_INVALID");
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.path === "/consumers/update/0/team",
    ),
  );
});

test("rejects normalized cloud signatures and bracketed credential keys", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");
  const credentialKeys = [
    "sig",
    "X-Goog-Credential",
    "X-Goog-Signature",
    "X-Amz-Security-Token",
    "token%5B%5D",
    "%EF%BD%94%EF%BD%8F%EF%BD%8B%EF%BD%85%EF%BD%8E",
  ];

  for (const key of credentialKeys) {
    const candidate = structuredClone(declaration);
    candidate.evidence[0].artifact.uri =
      `https://example.com/report?${key}=secret`;
    const result = validateProtocolSchema(candidate);
    assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) => diagnostic.path === "/evidence/0/artifact/uri",
      ),
      key,
    );
  }

  for (const query of [
    "page_token=next-page",
    "designature=blue",
    "signal=strength",
  ]) {
    const candidate = structuredClone(declaration);
    candidate.evidence[0].artifact.uri =
      `https://example.com/report?${query}`;
    assert.equal(validateProtocolSchema(candidate).ok, true, query);
  }
});

test("preserves distinct escaped additionalProperties diagnostic paths", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  declaration.changes[0].target.path = [{
    type: "items",
    "slash/field": true,
    "tilde~field": true,
  }];

  const result = validateProtocolSchema(declaration);
  assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
  assert.deepEqual(
    result.diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.message === "must NOT have additional properties",
      )
      .map((diagnostic) => diagnostic.path),
    [
      "/changes/0/target/path/0/slash~1field",
      "/changes/0/target/path/0/tilde~0field",
    ],
  );
});

test("wrapper identity checks preserve exact-duplicate rejection", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  declaration.consumers.push(structuredClone(declaration.consumers[0]));
  assertInvalid(
    validateProtocolSchema(declaration),
    "SEIP_PROTOCOL_SCHEMA_INVALID",
  );

  assertInvalid(
    validateAmendmentSchema({
      consumers: {
        add: [
          { team: "risk", contact: "risk@example.com" },
          { team: "risk", contact: "risk@example.com" },
        ],
      },
    }),
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
});
