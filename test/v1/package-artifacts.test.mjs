import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

test("package includes exact notices for bundled validator code", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const notices = await readFile(
    new URL("../../THIRD_PARTY_NOTICES.md", import.meta.url),
    "utf8",
  );

  assert.ok(packageJson.files.includes("THIRD_PARTY_NOTICES.md"));
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  for (const expected of [
    "Ajv 8.20.0",
    "Copyright (c) 2015-2021 Evgeny Poberezkin",
    "ajv-formats 3.0.1",
    "Copyright (c) 2020 Evgeny Poberezkin",
    "esbuild 0.28.1",
    "Copyright (c) 2020 Evan Wallace",
  ]) {
    assert.match(notices, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const path of [
    "../../node_modules/ajv/LICENSE",
    "../../node_modules/ajv-formats/LICENSE",
    "../../node_modules/esbuild/LICENSE.md",
  ]) {
    const license = (await readFile(new URL(path, import.meta.url), "utf8")).trim();
    assert.ok(notices.includes(license), path);
  }

  const packed = spawnSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    packed.status,
    0,
    [packed.stdout, packed.stderr].filter(Boolean).join("\n"),
  );
  const manifest = JSON.parse(packed.stdout)[0];
  assert.ok(manifest.files.some((file) => file.path === "LICENSE"));
  assert.ok(
    manifest.files.some((file) => file.path === "THIRD_PARTY_NOTICES.md"),
  );
  for (const path of [
    "dist/generated/protocol-validator.cjs",
    "dist/generated/amendment-validator.cjs",
  ]) {
    assert.ok(manifest.files.some((file) => file.path === path), path);
  }
});
