import assert from "node:assert/strict";
import test from "node:test";

import {
  failure,
  validateProtocolVersion,
} from "../../dist/core/index.js";

const invalidResult = {
  ok: false,
  diagnostics: [
    {
      code: "SEIP_PROTOCOL_VERSION_INVALID",
      severity: "error",
      message: "Protocol version must be a valid SemVer 2.0.0 string.",
      path: "/protocol_version",
    },
  ],
};

const unsupportedResult = {
  ok: false,
  diagnostics: [
    {
      code: "SEIP_PROTOCOL_VERSION_UNSUPPORTED",
      severity: "error",
      message: "Protocol version must be a stable 1.x.y release.",
      path: "/protocol_version",
    },
  ],
};

test("accepts stable v1 SemVer strings and preserves the original version", () => {
  for (const version of [
    "1.0.0",
    "1.99.0",
    "1.2.3+build.7",
    "1.2.3+001",
    "1.999999999999999999999999.0",
  ]) {
    assert.deepEqual(validateProtocolVersion(version), {
      ok: true,
      value: version,
      diagnostics: [],
    });
  }
});

test("rejects valid stable versions from other majors as unsupported", () => {
  for (const version of [
    "0.9.0",
    "2.0.0",
    "999999999999999999999999.0.0",
  ]) {
    assert.deepEqual(validateProtocolVersion(version), unsupportedResult);
  }
});

test("rejects valid prerelease versions as unsupported", () => {
  for (const version of [
    "1.1.0-rc.1",
    "1.0.0-alpha+build",
    "1.0.0-0",
  ]) {
    assert.deepEqual(validateProtocolVersion(version), unsupportedResult);
  }
});

test("rejects malformed strings as invalid", () => {
  for (const version of [
    "01.0.0",
    "1.01.0",
    "1.0.01",
    "1.0.0-",
    "1.0.0+",
    "1.0.0-alpha..1",
    "1.0.0+build..7",
    "1.0.0-01",
    "1.0.0-alpha.01",
    " 1.0.0",
    "1.0.0 ",
    "v1.0.0",
    "1",
    "1.0",
    "1.0.0_alpha",
    "1.0.0+build_7",
  ]) {
    assert.deepEqual(validateProtocolVersion(version), invalidResult, version);
  }
});

test("treats arbitrary non-string values as invalid without throwing", () => {
  for (const value of [
    null,
    undefined,
    1,
    1n,
    Symbol("1.0.0"),
    [],
    {},
    () => "1.0.0",
  ]) {
    let result;
    assert.doesNotThrow(() => {
      result = validateProtocolVersion(value);
    });
    assert.deepEqual(result, invalidResult);
  }
});

test("failure preserves the diagnostic result shape and protects required fields", () => {
  assert.deepEqual(
    failure("SEIP_EXAMPLE", "Stable message.", {
      code: "OVERRIDDEN_CODE",
      severity: "warning",
      message: "Overridden message.",
      path: "/example",
      changeId: "change-1",
      declarationId: "declaration-1",
      hint: "Stable hint.",
    }),
    {
      ok: false,
      diagnostics: [
        {
          code: "SEIP_EXAMPLE",
          severity: "error",
          message: "Stable message.",
          path: "/example",
          changeId: "change-1",
          declarationId: "declaration-1",
          hint: "Stable hint.",
        },
      ],
    },
  );
});
