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

function assertCredentialQueryRejected(result, label) {
  assertInvalid(result, "SEIP_PROTOCOL_SCHEMA_INVALID");
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === "/evidence/0/artifact/uri" &&
        diagnostic.message ===
          "must not include credential-bearing query parameters",
    ),
    label,
  );
}

function buildSharedCanonicalDag(depth) {
  let node = { kind: "string", value: "leaf" };
  for (let level = 0; level < depth; level += 1) {
    node = { kind: "array", items: [node, node] };
  }
  return node;
}

function buildSharedCanonicalDiamonds(depths) {
  return {
    kind: "array",
    items: depths.map(buildSharedCanonicalDag),
  };
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

test("bounds unfolded work from shared acyclic canonical DAGs", async () => {
  const declaration = await loadFixture("valid/extended-declaration.json");

  const withinBudget = structuredClone(declaration);
  withinBudget.changes[0].after = buildSharedCanonicalDag(10);
  assert.deepEqual(validateProtocolSchema(withinBudget), {
    ok: true,
    diagnostics: [],
  });

  const overBudget = structuredClone(declaration);
  overBudget.changes[0].after = buildSharedCanonicalDag(11);
  const protocolResult = validateProtocolSchema(overBudget);
  assertJsonBoundaryFailure(
    protocolResult,
    "SEIP_PROTOCOL_SCHEMA_INVALID",
  );
  assert.deepEqual(protocolResult, validateProtocolSchema(overBudget));

  const amendmentResult = validateAmendmentSchema({
    intent: {
      summary: "Clarify the migration",
      shared_extension: buildSharedCanonicalDag(11),
    },
  });
  assertJsonBoundaryFailure(
    amendmentResult,
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
  assert.deepEqual(
    amendmentResult,
    validateAmendmentSchema({
      intent: {
        summary: "Clarify the migration",
        shared_extension: buildSharedCanonicalDag(11),
      },
    }),
  );
});

test("accepts exactly 4096 shared visits and rejects 4097", () => {
  // The disjoint diamond branches contribute 4096 expansion visits in total.
  const atLimit = preflightJsonData(
    buildSharedCanonicalDiamonds([10, 8, 6, 5, 4, 1]),
  );
  assert.equal(atLimit.ok, true);

  // The final, separately-built depth-one branch contributes one more visit.
  assert.deepEqual(
    preflightJsonData(
      buildSharedCanonicalDiamonds([10, 8, 6, 5, 4, 1, 1]),
    ),
    {
      ok: false,
      issue: { message: "must be JSON data" },
    },
  );
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
  const fullwidthCredentialKeys = [
    "ｔｏｋｅｎ［０］",
    "sig［0］",
    "X-Goog-Credential［0］",
    "credentials［ｔｏｋｅｎ］",
    "foo［ｔｏｋｅｎ］［０］",
  ];
  const credentialKeys = [
    "sig",
    "X-Goog-Credential",
    "X-Goog-Signature",
    "X-Amz-Security-Token",
    "token[]",
    "token[0]",
    "sig[0]",
    "X-Goog-Credential[0]",
    "credentials[token]",
    "foo[token][0]",
    "foo[ｔｏｋｅｎ]",
    "ｔｏｋｅｎ",
    ...fullwidthCredentialKeys,
  ];

  for (const key of credentialKeys) {
    const candidate = structuredClone(declaration);
    const artifactUri = new URL("https://example.com/report");
    artifactUri.searchParams.set(key, "secret");
    candidate.evidence[0].artifact.uri = artifactUri.href;
    assert.deepEqual(
      [...new URL(artifactUri.href).searchParams.keys()],
      [key],
      `${key}: URLSearchParams decoded query name`,
    );
    const result = validateProtocolSchema(candidate);
    assertCredentialQueryRejected(result, key);
  }

  for (const query of [
    "token%5B0%5D=secret",
    "sig%5B0%5D=secret",
    "X-Goog-Credential%5B0%5D=secret",
    "credentials%5Btoken%5D=secret",
    "foo%5Btoken%5D%5B0%5D=secret",
    ...fullwidthCredentialKeys.map(
      (key) => `${encodeURIComponent(key)}=secret`,
    ),
  ]) {
    const candidate = structuredClone(declaration);
    candidate.evidence[0].artifact.uri =
      `https://example.com/report?${query}`;
    assertCredentialQueryRejected(
      validateProtocolSchema(candidate),
      query,
    );
  }

  const benignBracketKeys = [
    "filter[name]",
    "page[0]",
    "filter［name］",
    "page［０］",
  ];
  for (const key of benignBracketKeys) {
    const candidate = structuredClone(declaration);
    const artifactUri = new URL("https://example.com/report");
    artifactUri.searchParams.set(key, "benign");
    candidate.evidence[0].artifact.uri = artifactUri.href;
    assert.deepEqual(
      [...new URL(artifactUri.href).searchParams.keys()],
      [key],
      `${key}: URLSearchParams decoded benign query name`,
    );
    assert.equal(validateProtocolSchema(candidate).ok, true, key);
  }

  for (const query of [
    "page_token=next-page",
    "designature=blue",
    "signal=strength",
    "filter%5Bname%5D=active",
    "page%5B0%5D=next",
    "filter%5Bname%5D=active#token=fragment-only",
    "safe=value#sig=fragment-only",
    ...benignBracketKeys
      .slice(2)
      .map((key) => `${encodeURIComponent(key)}=benign`),
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
