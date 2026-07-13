import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

test("built schema wrapper runs outside repository dependency ancestry", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "seip-wrapper-"));
  try {
    await Promise.all([
      mkdir(join(temporaryRoot, "core"), { recursive: true }),
      mkdir(join(temporaryRoot, "generated"), { recursive: true }),
    ]);
    await Promise.all([
      copyFile(
        join(projectRoot, "dist/core/protocol-schema.js"),
        join(temporaryRoot, "core/protocol-schema.js"),
      ),
      copyFile(
        join(projectRoot, "dist/core/json-data.js"),
        join(temporaryRoot, "core/json-data.js"),
      ),
      copyFile(
        join(projectRoot, "src/generated/protocol-validator.cjs"),
        join(temporaryRoot, "generated/protocol-validator.cjs"),
      ),
      copyFile(
        join(projectRoot, "src/generated/amendment-validator.cjs"),
        join(temporaryRoot, "generated/amendment-validator.cjs"),
      ),
    ]);

    const declaration = await readFile(
      join(projectRoot, "test/fixtures/v1/valid/extended-declaration.json"),
      "utf8",
    );
    await writeFile(
      join(temporaryRoot, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    await writeFile(
      join(temporaryRoot, "runner.mjs"),
      `
import { validateProtocolSchema } from "./core/protocol-schema.js";

const declaration = ${declaration};
if (!validateProtocolSchema(declaration).ok) throw new Error("valid declaration rejected");

const invalidJson = structuredClone(declaration);
invalidJson.root_extension = 1n;
if (validateProtocolSchema(invalidJson).ok) throw new Error("BigInt accepted");

const credential = structuredClone(declaration);
credential.evidence[0].artifact.uri = "https://example.com/report?token%5B%5D=secret";
if (validateProtocolSchema(credential).ok) throw new Error("credential query accepted");

console.log("isolated wrapper ok");
`,
    );

    const result = spawnSync(process.execPath, [join(temporaryRoot, "runner.mjs")], {
      cwd: temporaryRoot,
      encoding: "utf8",
      env: {},
    });
    assert.equal(
      result.status,
      0,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
    assert.match(result.stdout, /isolated wrapper ok/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
