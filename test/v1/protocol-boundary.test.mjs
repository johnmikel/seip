import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  validateAmendmentSchema,
  validateProtocolSchema,
} from "../../dist/core/protocol-schema.js";
import {
  computeChangeId,
  validateDeclaration,
} from "../../dist/core/index.js";
import { preflightJsonData } from "../../dist/core/json-data.js";

const fixtures = new URL("../fixtures/v1/", import.meta.url);
const jsonDataModuleUrl = new URL(
  "../../dist/core/json-data.js",
  import.meta.url,
).href;
const coreModuleUrl = new URL("../../dist/core/index.js", import.meta.url).href;
const minimalDeclarationUrl = new URL(
  "valid/minimal-declaration.json",
  fixtures,
).href;

async function loadFixture(path) {
  return JSON.parse(await readFile(new URL(path, fixtures), "utf8"));
}

function runWideJsonProbe(body) {
  const script = `
    import { preflightJsonData } from ${JSON.stringify(jsonDataModuleUrl)};
    ${body}
  `;
  const child = spawnSync(
    process.execPath,
    ["--expose-gc", "--input-type=module", "--eval", script],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    },
  );
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  return JSON.parse(child.stdout);
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

function assertResourceIssue(result, resource) {
  assert.equal(result.ok, false);
  assert.equal(result.issue.kind, "resource_limit");
  assert.equal(result.issue.resource, resource);
}

function assertDeclarationResourceFailure(result) {
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.length > 0);
  assert.ok(
    result.diagnostics.every(
      (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_RESOURCE_LIMIT",
    ),
  );
}

function nestedArrays(depth) {
  let value = null;
  for (let index = 0; index < depth; index += 1) value = [value];
  return value;
}

function refreshDeclarationChangeIds(declaration) {
  for (const change of declaration.changes) {
    const result = computeChangeId(change);
    assert.equal(result.ok, true);
    change.change_id = result.value;
  }
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

test("enforces exact optional JSON depth limits before cloning", () => {
  assert.equal(
    preflightJsonData(nestedArrays(128), { maxDepth: 128 }).ok,
    true,
  );
  assertResourceIssue(
    preflightJsonData(nestedArrays(129), { maxDepth: 128 }),
    "depth",
  );
});

test("short-circuits an exact-size deep chain at a trusted depth limit", () => {
  const probe = runWideJsonProbe(`
    preflightJsonData([null], { maxDepth: 1 });
    const depth = 1_048_574;
    let value = null;
    for (let index = 0; index < depth; index += 1) value = [value];
    globalThis.keepAlive = value;
    const bytes = 2 * depth + 4;
    for (let index = 0; index < 3; index += 1) globalThis.gc();
    const before = process.memoryUsage();
    const beforeMaxRss = process.resourceUsage().maxRSS;
    const result = preflightJsonData(value, {
      maxBytes: 2 * 1024 * 1024,
      maxContainers: 100_000,
      maxDepth: 128,
    });
    const after = process.memoryUsage();
    const afterMaxRss = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({
      bytes,
      result,
      heapDelta: Math.max(0, after.heapUsed - before.heapUsed),
      rssDelta: Math.max(
        0,
        after.rss - before.rss,
        (afterMaxRss - beforeMaxRss) * 1024,
      ),
    }));
  `);

  assert.equal(probe.bytes, 2 * 1024 * 1024);
  assert.deepEqual(probe.result, {
    ok: false,
    issue: {
      kind: "resource_limit",
      message: "exceeds JSON resource limits",
      resource: "depth",
    },
  });
  assert.ok(
    probe.heapDelta < 64 * 1024 * 1024 &&
      probe.rssDelta < 96 * 1024 * 1024,
    `deep validity walk used ${probe.heapDelta} heap bytes and ${probe.rssDelta} RSS bytes`,
  );
});

test("counts exact compact JSON UTF-8 bytes including escaping and DAG unfolding", () => {
  const shared = {
    "é😀\ud800": "quote: \" slash: \\ newline:\n",
  };
  const values = [shared, [shared, shared]];

  for (const value of values) {
    const exactBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    assert.equal(
      preflightJsonData(value, { maxBytes: exactBytes }).ok,
      true,
    );
    assertResourceIssue(
      preflightJsonData(value, { maxBytes: exactBytes - 1 }),
      "bytes",
    );
  }
});

test("accepts exactly 2 MiB of logical JSON and rejects one byte more", () => {
  const maxBytes = 2 * 1024 * 1024;
  const value = { payload: "" };
  const emptyBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  value.payload = "a".repeat(maxBytes - emptyBytes);

  assert.equal(preflightJsonData(value, { maxBytes }).ok, true);
  value.payload += "a";
  assertResourceIssue(preflightJsonData(value, { maxBytes }), "bytes");
});

test("bounds validity-walk memory for a wide JSON array", () => {
  const probe = runWideJsonProbe(`
    preflightJsonData([null], { maxBytes: 1 });
    globalThis.keepAlive = Array(419_431).fill(null);
    const bytes = 5 * globalThis.keepAlive.length + 1;
    for (let index = 0; index < 3; index += 1) globalThis.gc();
    const before = process.memoryUsage();
    const beforeMaxRss = process.resourceUsage().maxRSS;
    const result = preflightJsonData(globalThis.keepAlive, {
      maxBytes: 2 * 1024 * 1024,
    });
    const after = process.memoryUsage();
    const afterMaxRss = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({
      bytes,
      result,
      heapDelta: Math.max(0, after.heapUsed - before.heapUsed),
      rssDelta: Math.max(
        0,
        after.rss - before.rss,
        (afterMaxRss - beforeMaxRss) * 1024,
      ),
    }));
  `);

  assert.equal(probe.bytes, 2_097_156);
  assert.deepEqual(probe.result, {
    ok: false,
    issue: {
      kind: "resource_limit",
      message: "exceeds JSON resource limits",
      resource: "bytes",
    },
  });
  assert.ok(
    probe.heapDelta < 96 * 1024 * 1024 &&
      probe.rssDelta < 144 * 1024 * 1024,
    `wide validity walk used ${probe.heapDelta} heap bytes and ${probe.rssDelta} RSS bytes`,
  );
});

test("bounds accepted-path memory for a near-limit scalar array", () => {
  const probe = runWideJsonProbe(`
    preflightJsonData([null], { maxBytes: 1 });
    globalThis.keepAlive = Array(419_430).fill(null);
    const bytes = 5 * globalThis.keepAlive.length + 1;
    for (let index = 0; index < 3; index += 1) globalThis.gc();
    const before = process.memoryUsage();
    const beforeMaxRss = process.resourceUsage().maxRSS;
    const result = preflightJsonData(globalThis.keepAlive, {
      maxBytes: 2 * 1024 * 1024,
    });
    const after = process.memoryUsage();
    const afterMaxRss = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({
      bytes,
      ok: result.ok,
      isolated: result.ok && result.value !== globalThis.keepAlive,
      length: result.ok && result.value.length,
      first: result.ok && result.value[0],
      last: result.ok && result.value[result.value.length - 1],
      heapDelta: Math.max(0, after.heapUsed - before.heapUsed),
      rssDelta: Math.max(
        0,
        after.rss - before.rss,
        (afterMaxRss - beforeMaxRss) * 1024,
      ),
    }));
  `);

  assert.equal(probe.bytes, 2_097_151);
  assert.equal(probe.ok, true);
  assert.equal(probe.isolated, true);
  assert.equal(probe.length, 419_430);
  assert.equal(probe.first, null);
  assert.equal(probe.last, null);
  assert.ok(
    probe.heapDelta < 80 * 1024 * 1024 &&
      probe.rssDelta < 144 * 1024 * 1024,
    `accepted scalar array used ${probe.heapDelta} heap bytes and ${probe.rssDelta} RSS bytes`,
  );
});

test("counts unique JSON containers at exact configurable limits", () => {
  assert.equal(preflightJsonData(null, { maxContainers: 0 }).ok, true);
  assertResourceIssue(preflightJsonData({}, { maxContainers: 0 }), "containers");
  assert.equal(preflightJsonData({}, { maxContainers: 1 }).ok, true);

  const atLimit = Array.from({ length: 99_999 }, () => ({}));
  const accepted = preflightJsonData(atLimit, { maxContainers: 100_000 });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.notEqual(accepted.value, atLimit);
    assert.notEqual(accepted.value[0], atLimit[0]);
    assert.equal(Object.getPrototypeOf(accepted.value[0]), null);
  }

  assert.deepEqual(
    preflightJsonData(Array.from({ length: 100_000 }, () => ({})), {
      maxContainers: 100_000,
    }),
    {
      ok: false,
      issue: {
        kind: "resource_limit",
        message: "exceeds JSON resource limits",
        resource: "containers",
      },
    },
  );

  const shared = {};
  const aliases = Array(4).fill(shared);
  const sharedResult = preflightJsonData(aliases, { maxContainers: 2 });
  assert.equal(sharedResult.ok, true);
  if (sharedResult.ok) {
    assert.notEqual(sharedResult.value[0], shared);
    assert.equal(sharedResult.value[0], sharedResult.value.at(-1));
  }

  for (const invalidLimit of [-1, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(preflightJsonData(null, { maxContainers: invalidLimit }), {
      ok: false,
      issue: { message: "must be JSON data" },
    });
  }
});

test("snapshots dynamic container and depth limits exactly once", () => {
  let changingReads = 0;
  const changingLimit = {
    get maxContainers() {
      changingReads += 1;
      return changingReads === 1 ? 0 : 1;
    },
  };
  assertResourceIssue(
    preflightJsonData([{}, {}], changingLimit),
    "containers",
  );
  assert.equal(changingReads, 1);

  let collectionReads = 0;
  const mutatingCollectionLimit = {
    maxContainers: 0,
    get arrayLengthLimits() {
      collectionReads += 1;
      this.maxContainers = 1;
      return [];
    },
  };
  assertResourceIssue(
    preflightJsonData([{}, {}], mutatingCollectionLimit),
    "containers",
  );
  assert.equal(collectionReads, 0);

  let changingDepthReads = 0;
  const changingDepthLimit = {
    get maxDepth() {
      changingDepthReads += 1;
      return changingDepthReads === 1 ? 1 : 2;
    },
  };
  assertResourceIssue(
    preflightJsonData(nestedArrays(2), changingDepthLimit),
    "depth",
  );
  assert.equal(changingDepthReads, 1);

  let mixedContainerReads = 0;
  const mixedLimits = {
    get maxContainers() {
      mixedContainerReads += 1;
      return 0;
    },
    maxDepth: 128,
  };
  assertResourceIssue(
    preflightJsonData(nestedArrays(129), mixedLimits),
    "depth",
  );
  assert.equal(mixedContainerReads, 0);

  let throwingReads = 0;
  const throwingLimit = {
    get maxContainers() {
      throwingReads += 1;
      throw new Error("must remain inside preflight");
    },
  };
  assert.deepEqual(preflightJsonData(null, throwingLimit), {
    ok: false,
    issue: { message: "must be JSON data" },
  });
  assert.equal(throwingReads, 1);

  throwingReads = 0;
  assert.deepEqual(preflightJsonData({ invalid: undefined }, throwingLimit), {
    ok: false,
    issue: { message: "must be JSON data", path: "/invalid" },
  });
  assert.equal(throwingReads, 0);

  let proxyReads = 0;
  const proxyLimits = new Proxy(
    {},
    {
      get() {
        proxyReads += 1;
        throw new Error("must remain inside preflight");
      },
    },
  );
  assert.deepEqual(preflightJsonData({ invalid: undefined }, proxyLimits), {
    ok: false,
    issue: { message: "must be JSON data", path: "/invalid" },
  });
  assert.equal(proxyReads, 0);
  assert.deepEqual(preflightJsonData(null, proxyLimits), {
    ok: false,
    issue: { message: "must be JSON data" },
  });
  assert.equal(proxyReads, 1);
});

test("bounds accepted-path memory for a valid near-limit declaration", () => {
  const probe = runWideJsonProbe(`
    const { readFile } = await import("node:fs/promises");
    const { computeChangeId, validateDeclaration } = await import(
      ${JSON.stringify(coreModuleUrl)}
    );
    const source = await readFile(
      new URL(${JSON.stringify(minimalDeclarationUrl)}),
      "utf8",
    );
    const prepareDeclaration = () => {
      const declaration = JSON.parse(source);
      const changeId = computeChangeId(declaration.changes[0]);
      if (!changeId.ok) throw new Error("fixture change could not be fingerprinted");
      declaration.changes[0].change_id = changeId.value;
      return declaration;
    };
    validateDeclaration(prepareDeclaration());
    globalThis.keepAlive = prepareDeclaration();
    globalThis.keepAlive.memory_extension = Array(419_216).fill(null);
    const bytes = Buffer.byteLength(JSON.stringify(globalThis.keepAlive), "utf8");
    for (let index = 0; index < 3; index += 1) globalThis.gc();
    const before = process.memoryUsage();
    const beforeMaxRss = process.resourceUsage().maxRSS;
    const result = validateDeclaration(globalThis.keepAlive);
    const after = process.memoryUsage();
    const afterMaxRss = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({
      bytes,
      ok: result.ok,
      isolated: result.ok && result.value !== globalThis.keepAlive,
      extensionIsolated:
        result.ok &&
        result.value.memory_extension !== globalThis.keepAlive.memory_extension,
      extensionLength: result.ok && result.value.memory_extension.length,
      heapDelta: Math.max(0, after.heapUsed - before.heapUsed),
      rssDelta: Math.max(
        0,
        after.rss - before.rss,
        (afterMaxRss - beforeMaxRss) * 1024,
      ),
    }));
  `);

  assert.equal(probe.bytes, 2_097_151);
  assert.equal(probe.ok, true);
  assert.equal(probe.isolated, true);
  assert.equal(probe.extensionIsolated, true);
  assert.equal(probe.extensionLength, 419_216);
  assert.ok(
    probe.heapDelta < 80 * 1024 * 1024 &&
      probe.rssDelta < 144 * 1024 * 1024,
    `accepted declaration used ${probe.heapDelta} heap bytes and ${probe.rssDelta} RSS bytes`,
  );
});

test("bounds container-limit rejection for a pathological declaration", () => {
  const probe = runWideJsonProbe(`
    const { readFile } = await import("node:fs/promises");
    const { computeChangeId, validateDeclaration } = await import(
      ${JSON.stringify(coreModuleUrl)}
    );
    const declaration = JSON.parse(await readFile(
      new URL(${JSON.stringify(minimalDeclarationUrl)}),
      "utf8",
    ));
    const changeId = computeChangeId(declaration.changes[0]);
    if (!changeId.ok) throw new Error("fixture change could not be fingerprinted");
    declaration.changes[0].change_id = changeId.value;
    validateDeclaration(declaration);
    globalThis.keepAlive = declaration;
    globalThis.keepAlive.container_extension = Array.from(
      { length: 699_050 },
      () => ({}),
    );
    for (let index = 0; index < 3; index += 1) globalThis.gc();
    const before = process.memoryUsage();
    const beforeMaxRss = process.resourceUsage().maxRSS;
    const result = validateDeclaration(globalThis.keepAlive);
    const after = process.memoryUsage();
    const afterMaxRss = process.resourceUsage().maxRSS;
    process.stdout.write(JSON.stringify({
      ok: result.ok,
      diagnostics: result.diagnostics,
      extensionLength: globalThis.keepAlive.container_extension.length,
      inputChildPrototypeIsObject:
        Object.getPrototypeOf(globalThis.keepAlive.container_extension[0]) ===
        Object.prototype,
      heapDelta: Math.max(0, after.heapUsed - before.heapUsed),
      rssDelta: Math.max(
        0,
        after.rss - before.rss,
        (afterMaxRss - beforeMaxRss) * 1024,
      ),
    }));
  `);

  assert.equal(probe.ok, false);
  assert.deepEqual(probe.diagnostics, [
    {
      code: "SEIP_PROTOCOL_RESOURCE_LIMIT",
      severity: "error",
      message: "Declaration exceeds configured protocol resource limits.",
    },
  ]);
  assert.equal(probe.extensionLength, 699_050);
  assert.equal(probe.inputChildPrototypeIsObject, true);
  assert.ok(
    probe.heapDelta < 144 * 1024 * 1024 &&
      probe.rssDelta < 256 * 1024 * 1024,
    `container-limit rejection used ${probe.heapDelta} heap bytes and ${probe.rssDelta} RSS bytes`,
  );
});

test("does not reach a late wide-array accessor beyond a trusted cap", () => {
  const probe = runWideJsonProbe(`
    const value = Array(419_431).fill(null);
    value[0] = { invalid_nested_value: undefined };
    let getterInvoked = false;
    Object.defineProperty(value, "419430", {
      configurable: true,
      enumerable: true,
      get() {
        getterInvoked = true;
        return null;
      },
    });
    const result = preflightJsonData(value, { maxBytes: 1, maxContainers: 0 });
    process.stdout.write(JSON.stringify({ getterInvoked, result }));
  `);

  assert.equal(probe.getterInvoked, false);
  assert.deepEqual(probe.result, {
    ok: false,
    issue: {
      kind: "resource_limit",
      message: "exceeds JSON resource limits",
      resource: "containers",
    },
  });
});

test("validates hostile descriptors while they remain within trusted limits", () => {
  let getterInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "payload", {
    enumerable: true,
    get() {
      getterInvoked = true;
      throw new Error("must not execute");
    },
  });

  const result = preflightJsonData(accessor, {
    maxBytes: 1,
    maxContainers: 1,
    maxDepth: 1,
  });

  assert.deepEqual(result, {
    ok: false,
    issue: { message: "must be JSON data", path: "/payload" },
  });
  assert.equal(getterInvoked, false);
});

test("does not inspect invalid data beyond a trusted container cap", () => {
  const nonfinite = { value: Number.POSITIVE_INFINITY };
  assertResourceIssue(
    preflightJsonData([{}, nonfinite], { maxContainers: 2 }),
    "containers",
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assertResourceIssue(
    preflightJsonData([{}, cyclic], { maxContainers: 2 }),
    "containers",
  );

  let getterInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "payload", {
    enumerable: true,
    get() {
      getterInvoked = true;
      throw new Error("must not execute");
    },
  });
  assertResourceIssue(
    preflightJsonData([{}, accessor], { maxContainers: 2 }),
    "containers",
  );
  assert.equal(getterInvoked, false);

  let proxyTraps = 0;
  const proxied = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error("must not inspect a container beyond the cap");
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error("must not inspect a container beyond the cap");
      },
    },
  );
  assertResourceIssue(
    preflightJsonData([{}, proxied], { maxContainers: 2 }),
    "containers",
  );
  assert.equal(proxyTraps, 0);

  const sharedScalarLeaf = { value: null };
  assertResourceIssue(
    preflightJsonData(
      [{}, sharedScalarLeaf, sharedScalarLeaf, sharedScalarLeaf],
      { maxContainers: 0 },
    ),
    "containers",
  );
});

test("preserves collection limits for ordinary in-budget data", () => {
  assert.deepEqual(
    preflightJsonData(
      { items: [null, null] },
      {
        arrayLengthLimits: [{ path: ["items"], maxLength: 1 }],
        maxContainers: 2,
        maxDepth: 2,
      },
    ),
    {
      ok: false,
      issue: {
        kind: "resource_limit",
        message: "exceeds JSON resource limits",
        path: "/items",
        resource: "collection",
      },
    },
  );
});

test("bounds declaration depth and logical size without changing direct schema validation", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  refreshDeclarationChangeIds(declaration);

  const atDepth = structuredClone(declaration);
  atDepth.depth_extension = nestedArrays(127);
  assert.equal(validateDeclaration(atDepth).ok, true);

  const overDepth = structuredClone(declaration);
  overDepth.depth_extension = nestedArrays(128);
  assertResourceIssue(
    preflightJsonData(overDepth, { maxDepth: 128 }),
    "depth",
  );
  assertDeclarationResourceFailure(validateDeclaration(overDepth));
  assert.deepEqual(validateProtocolSchema(overDepth), {
    ok: true,
    diagnostics: [],
  });

  const maxBytes = 2 * 1024 * 1024;
  const atSize = structuredClone(declaration);
  atSize.size_extension = "";
  const baseBytes = Buffer.byteLength(JSON.stringify(atSize), "utf8");
  atSize.size_extension = "a".repeat(maxBytes - baseBytes);
  assert.equal(validateDeclaration(atSize).ok, true);

  const overSize = structuredClone(atSize);
  overSize.size_extension += "a";
  assertDeclarationResourceFailure(validateDeclaration(overSize));

  const overContainers = structuredClone(declaration);
  overContainers.container_extension = Array.from(
    { length: 100_000 },
    () => ({}),
  );
  assertDeclarationResourceFailure(validateDeclaration(overContainers));
  assert.deepEqual(validateProtocolSchema(overContainers), {
    ok: true,
    diagnostics: [],
  });
});

test("short-circuits oversized change collections as resources", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  refreshDeclarationChangeIds(declaration);

  const atLimit = structuredClone(declaration);
  atLimit.changes = Array(10_000).fill(null);
  const atLimitResult = validateDeclaration(atLimit);
  assert.equal(atLimitResult.ok, false);
  assert.ok(
    atLimitResult.diagnostics.every(
      (diagnostic) => diagnostic.code !== "SEIP_PROTOCOL_RESOURCE_LIMIT",
    ),
  );

  const tooManyChanges = structuredClone(declaration);
  tooManyChanges.changes = Array(10_001).fill(null);
  const overLimitResult = validateDeclaration(tooManyChanges);
  assertDeclarationResourceFailure(overLimitResult);
  assert.equal(overLimitResult.diagnostics[0].path, "/changes");
});

test("fails a 50k-event declaration as a resource before cloning", async () => {
  const declaration = await loadFixture("valid/minimal-declaration.json");
  refreshDeclarationChangeIds(declaration);

  const tooManyEvents = structuredClone(declaration);
  tooManyEvents.events = Array(50_000).fill(tooManyEvents.events[0]);
  assertDeclarationResourceFailure(validateDeclaration(tooManyEvents));
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
