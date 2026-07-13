import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const compilerPath = fileURLToPath(
  new URL("../../node_modules/typescript/bin/tsc", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("./generated-types.compile.ts", import.meta.url),
);

test("generated protocol types satisfy the strict compiler fixture", () => {
  const result = spawnSync(
    process.execPath,
    [
      compilerPath,
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--types",
      "node",
      "--exactOptionalPropertyTypes",
      "true",
      "--noUncheckedIndexedAccess",
      "--skipLibCheck",
      fixturePath,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});
