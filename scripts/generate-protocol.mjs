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

function cloneRuntimeSchema(schema, schemaName, identityArrayPaths) {
  const runtimeSchema = structuredClone(schema);

  for (const path of identityArrayPaths) {
    let arraySchema = runtimeSchema;
    for (const segment of path) {
      if (
        arraySchema === null ||
        typeof arraySchema !== "object" ||
        !Object.hasOwn(arraySchema, segment)
      ) {
        throw new Error(
          `${schemaName} runtime identity array path is missing: ${path.join(".")}`,
        );
      }
      arraySchema = arraySchema[segment];
    }

    if (
      arraySchema === null ||
      typeof arraySchema !== "object" ||
      arraySchema.uniqueItems !== true
    ) {
      throw new Error(
        `${schemaName} runtime identity array must declare uniqueItems: true: ${path.join(".")}`,
      );
    }
    delete arraySchema.uniqueItems;
  }

  return runtimeSchema;
}

function addRuntimeItemType(schema, schemaName, path, expectedRef, type) {
  let itemSchema = schema;
  for (const segment of path) {
    if (
      itemSchema === null ||
      typeof itemSchema !== "object" ||
      !Object.hasOwn(itemSchema, segment)
    ) {
      throw new Error(
        `${schemaName} runtime item path is missing: ${path.join(".")}`,
      );
    }
    itemSchema = itemSchema[segment];
  }

  if (
    itemSchema === null ||
    typeof itemSchema !== "object" ||
    itemSchema.$ref !== expectedRef ||
    Object.hasOwn(itemSchema, "type")
  ) {
    throw new Error(
      `${schemaName} runtime item must exclusively reference ${expectedRef}: ${path.join(".")}`,
    );
  }
  itemSchema.type = type;
}

const declarationTimestampPattern = declarationSchema.$defs?.Timestamp?.pattern;
const amendmentTimestampPattern = amendmentSchema.$defs?.Timestamp?.pattern;
if (
  typeof declarationTimestampPattern !== "string" ||
  declarationTimestampPattern !== amendmentTimestampPattern
) {
  throw new Error("declaration and amendment timestamp patterns must match");
}

const runtimeDeclarationSchema = cloneRuntimeSchema(
  declarationSchema,
  "declaration schema",
  [
    ["properties", "changes"],
    ["properties", "consumers"],
    ["properties", "responses"],
    ["properties", "evidence"],
    ["properties", "events"],
    ["$defs", "CanonicalObject", "properties", "entries"],
  ],
);
const runtimeAmendmentSchema = cloneRuntimeSchema(
  amendmentSchema,
  "amendment schema",
  [
    ["$defs", "ConsumerOperations", "properties", "add"],
    ["$defs", "ConsumerOperations", "properties", "update"],
  ],
);

// Ajv cannot infer a primitive type through $ref while compiling uniqueItems,
// so it otherwise emits a generic object deep-equality helper for this string
// array. The redundant runtime-only type is behaviorally equivalent to the
// referenced ChangeId schema and keeps primitive uniqueness on its fast path.
addRuntimeItemType(
  runtimeDeclarationSchema,
  "declaration schema",
  ["$defs", "Evidence", "properties", "change_ids", "items"],
  "#/$defs/ChangeId",
  "string",
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
  ajv.addKeyword({
    keyword: "tsType",
    schemaType: "string",
    valid: true,
  });
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

const [protocolValidator, amendmentValidator, generatedProtocolTypes] = await Promise.all([
  bundleStandaloneValidator(
    generateStandaloneValidator(runtimeDeclarationSchema),
    "protocol-validator.raw.cjs",
  ),
  bundleStandaloneValidator(
    generateStandaloneValidator(runtimeAmendmentSchema),
    "amendment-validator.raw.cjs",
  ),
  compile(declarationSchema, "SeipDeclaration", {
    bannerComment: "// Generated from seip.schema.json. Do not edit.",
    additionalProperties: false,
    unknownAny: true,
  }),
]);
const protocolTypes = `${generatedProtocolTypes.trimEnd()}\n\nexport type SeipDeclaration = SEIPV1Declaration;\n`;

await mkdir(generatedDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL("protocol-validator.cjs", generatedDirectory), protocolValidator),
  writeFile(new URL("amendment-validator.cjs", generatedDirectory), amendmentValidator),
  writeFile(new URL("protocol-types.ts", generatedDirectory), protocolTypes),
]);
