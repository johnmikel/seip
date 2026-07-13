import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import addFormats from "ajv-formats";
import { build } from "esbuild";
import { compile } from "json-schema-to-typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const generatedDirectory = new URL("../src/generated/", import.meta.url);
const declarationSchemaUrl = new URL("../seip.schema.json", import.meta.url);
const amendmentSchemaUrl = new URL("../seip.amendment.schema.json", import.meta.url);

const [declarationSchema, amendmentSchema] = await Promise.all(
  [declarationSchemaUrl, amendmentSchemaUrl].map(async (url) =>
    JSON.parse(await readFile(url, "utf8")),
  ),
);

function generateStandaloneValidator(schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    ownProperties: true,
    code: {
      source: true,
      esm: false,
    },
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return standaloneCode(ajv, validate);
}

async function bundleStandaloneValidator(source, sourcefile) {
  const result = await build({
    stdin: {
      contents: source,
      resolveDir: projectRoot,
      sourcefile,
      loader: "js",
    },
    bundle: true,
    write: false,
    platform: "node",
    target: "node20",
    format: "cjs",
    legalComments: "inline",
    sourcemap: false,
    minify: false,
    charset: "utf8",
  });
  const output = result.outputFiles?.[0];
  if (output === undefined) {
    throw new Error("esbuild did not produce " + sourcefile);
  }
  return output.text;
}

const [protocolValidator, amendmentValidator, protocolTypes] = await Promise.all([
  bundleStandaloneValidator(
    generateStandaloneValidator(declarationSchema),
    "protocol-validator.raw.cjs",
  ),
  bundleStandaloneValidator(
    generateStandaloneValidator(amendmentSchema),
    "amendment-validator.raw.cjs",
  ),
  compile(declarationSchema, "SeipDeclaration", {
    bannerComment: "// Generated from seip.schema.json. Do not edit.",
    additionalProperties: false,
    unknownAny: true,
  }),
]);

await mkdir(generatedDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL("protocol-validator.cjs", generatedDirectory), protocolValidator),
  writeFile(new URL("amendment-validator.cjs", generatedDirectory), amendmentValidator),
  writeFile(new URL("protocol-types.ts", generatedDirectory), protocolTypes),
]);
