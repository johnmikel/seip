import { URL } from "node:url";

import amendmentValidatorModule from "../generated/amendment-validator.cjs";
import protocolValidatorModule from "../generated/protocol-validator.cjs";

export interface SchemaValidationResult {
  ok: boolean;
  diagnostics: Array<{
    code:
      | "SEIP_PROTOCOL_SCHEMA_INVALID"
      | "SEIP_LIFECYCLE_AMENDMENT_INVALID";
    severity: "error";
    message: string;
    path?: string;
  }>;
}

interface ValidatorError {
  instancePath?: string;
  message?: string;
}

interface GeneratedValidator {
  (value: unknown): boolean;
  errors?: readonly ValidatorError[] | null;
}

type DiagnosticCode =
  SchemaValidationResult["diagnostics"][number]["code"];
type SchemaDiagnostic = SchemaValidationResult["diagnostics"][number];
type JsonRecord = Record<string, unknown>;
type SemanticValidator = (
  value: unknown,
  code: DiagnosticCode,
) => SchemaDiagnostic[];

const credentialArtifactQueryNames = new Set([
  "accesskey",
  "accesskeys",
  "accesstoken",
  "accesstokens",
  "apikey",
  "apikeys",
  "authorization",
  "awsaccesskeyid",
  "clientsecret",
  "clientsecrets",
  "credential",
  "credentials",
  "idtoken",
  "idtokens",
  "oauthtoken",
  "oauthtokens",
  "password",
  "passwords",
  "passwd",
  "refreshtoken",
  "refreshtokens",
  "secret",
  "secrets",
  "securitytoken",
  "securitytokens",
  "sessiontoken",
  "sessiontokens",
  "signature",
  "signatures",
  "token",
  "tokens",
  "xamzcredential",
  "xamzsecuritytoken",
  "xamzsignature",
]);

const protocolValidator =
  protocolValidatorModule as unknown as GeneratedValidator;
const amendmentValidator =
  amendmentValidatorModule as unknown as GeneratedValidator;

function compareDiagnostics(
  left: SchemaDiagnostic,
  right: SchemaDiagnostic,
): number {
  const leftParts = [left.path ?? "", left.message, left.code, left.severity];
  const rightParts = [
    right.path ?? "",
    right.message,
    right.code,
    right.severity,
  ];
  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

function normalizeDiagnostics(
  diagnostics: SchemaDiagnostic[],
): SchemaDiagnostic[] {
  const unique = new Map<string, SchemaDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.path ?? "",
      diagnostic.message,
      diagnostic.code,
      diagnostic.severity,
    ]);
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizeArtifactQueryName(name: string): string {
  return name.toLowerCase().replace(/[\s._-]+/g, "");
}

function appendDuplicateKeyDiagnostics(
  value: unknown,
  key: string,
  arrayPath: string,
  code: DiagnosticCode,
  diagnostics: SchemaDiagnostic[],
): void {
  if (!Array.isArray(value)) return;

  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isJsonRecord(item)) return;
    if (!Object.hasOwn(item, key)) return;
    const keyValue = item[key];
    if (typeof keyValue !== "string") return;

    if (seen.has(keyValue)) {
      diagnostics.push({
        code,
        severity: "error",
        message: `must have unique ${key} values`,
        path: `${arrayPath}/${index}/${escapeJsonPointerToken(key)}`,
      });
    } else {
      seen.add(keyValue);
    }
  });
}

function appendCanonicalObjectDiagnostics(
  value: unknown,
  path: string,
  code: DiagnosticCode,
  diagnostics: SchemaDiagnostic[],
  ancestors: Set<object>,
): void {
  if (typeof value !== "object" || value === null) return;
  if (ancestors.has(value)) return;
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        appendCanonicalObjectDiagnostics(
          item,
          `${path}/${index}`,
          code,
          diagnostics,
          ancestors,
        );
      });
      return;
    }

    if (!isJsonRecord(value)) return;

    if (
      Object.hasOwn(value, "kind") &&
      Object.hasOwn(value, "entries") &&
      value.kind === "object" &&
      Array.isArray(value.entries)
    ) {
      appendDuplicateKeyDiagnostics(
        value.entries,
        "key",
        `${path}/entries`,
        code,
        diagnostics,
      );
    }

    for (const [property, nestedValue] of Object.entries(value)) {
      appendCanonicalObjectDiagnostics(
        nestedValue,
        `${path}/${escapeJsonPointerToken(property)}`,
        code,
        diagnostics,
        ancestors,
      );
    }
  } finally {
    ancestors.delete(value);
  }
}

function appendArtifactUriDiagnostics(
  value: unknown,
  code: DiagnosticCode,
  diagnostics: SchemaDiagnostic[],
): void {
  if (!Array.isArray(value)) return;

  value.forEach((evidence, index) => {
    if (!isJsonRecord(evidence) || !Object.hasOwn(evidence, "artifact")) return;
    const artifact = evidence.artifact;
    if (!isJsonRecord(artifact) || !Object.hasOwn(artifact, "uri")) return;
    const uri = artifact.uri;
    if (typeof uri !== "string") return;

    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      return;
    }

    const hasUserInfo = parsed.username.length > 0 || parsed.password.length > 0;
    const hasCredentialQuery = [...parsed.searchParams.keys()].some((name) =>
      credentialArtifactQueryNames.has(normalizeArtifactQueryName(name)),
    );
    if (!hasUserInfo && !hasCredentialQuery) return;

    diagnostics.push({
      code,
      severity: "error",
      message: hasUserInfo
        ? "must not include URI userinfo"
        : "must not include credential-bearing query parameters",
      path: `/evidence/${index}/artifact/uri`,
    });
  });
}

// JSON Schema's `uniqueItems` compares whole records. These wrapper checks add
// uniqueness projected by protocol identity keys without making the published
// schemas depend on a non-standard runtime keyword.
function validateProtocolSemantics(
  value: unknown,
  code: DiagnosticCode,
): SchemaDiagnostic[] {
  if (!isJsonRecord(value)) return [];

  const diagnostics: SchemaDiagnostic[] = [];
  for (const [field, key] of [
    ["changes", "change_id"],
    ["consumers", "team"],
    ["responses", "response_id"],
    ["evidence", "evidence_id"],
    ["events", "event_id"],
  ] as const) {
    if (!Object.hasOwn(value, field)) continue;
    appendDuplicateKeyDiagnostics(
      value[field],
      key,
      `/${field}`,
      code,
      diagnostics,
    );
  }

  if (Object.hasOwn(value, "changes") && Array.isArray(value.changes)) {
    value.changes.forEach((change, index) => {
      if (!isJsonRecord(change)) return;
      for (const snapshot of ["before", "after"] as const) {
        if (!Object.hasOwn(change, snapshot)) continue;
        appendCanonicalObjectDiagnostics(
          change[snapshot],
          `/changes/${index}/${snapshot}`,
          code,
          diagnostics,
          new Set<object>(),
        );
      }
    });
  }

  if (Object.hasOwn(value, "evidence")) {
    appendArtifactUriDiagnostics(value.evidence, code, diagnostics);
  }

  return diagnostics;
}

function validateAmendmentSemantics(
  value: unknown,
  code: DiagnosticCode,
): SchemaDiagnostic[] {
  if (!isJsonRecord(value) || !Object.hasOwn(value, "consumers")) return [];
  const consumers = value.consumers;
  if (!isJsonRecord(consumers)) return [];

  const diagnostics: SchemaDiagnostic[] = [];
  for (const operation of ["add", "update"] as const) {
    if (!Object.hasOwn(consumers, operation)) continue;
    appendDuplicateKeyDiagnostics(
      consumers[operation],
      "team",
      `/consumers/${operation}`,
      code,
      diagnostics,
    );
  }
  return diagnostics;
}

function validateWith(
  validator: GeneratedValidator,
  value: unknown,
  code: DiagnosticCode,
  validateSemantics?: SemanticValidator,
): SchemaValidationResult {
  try {
    if (validator(value)) {
      const diagnostics = normalizeDiagnostics(
        validateSemantics?.(value, code) ?? [],
      );
      if (diagnostics.length > 0) {
        return {
          ok: false,
          diagnostics,
        };
      }

      return {
        ok: true,
        diagnostics: [],
      };
    }

    const errors = Array.isArray(validator.errors)
      ? [...validator.errors]
      : [];
    const diagnostics = normalizeDiagnostics(
      errors.map((error) => {
        const diagnostic = {
          code,
          severity: "error" as const,
          message: error.message ?? "must satisfy the schema",
        };
        return typeof error.instancePath === "string" &&
          error.instancePath.length > 0
          ? { ...diagnostic, path: error.instancePath }
          : diagnostic;
      }),
    );

    return {
      ok: false,
      diagnostics:
        diagnostics.length > 0
          ? diagnostics
          : [
              {
                code,
                severity: "error",
                message: "schema validation failed",
              },
            ],
    };
  } catch {
    return {
      ok: false,
      diagnostics: [
        {
          code,
          severity: "error",
          message: "schema validation could not be completed",
        },
      ],
    };
  }
}

export function validateProtocolSchema(
  value: unknown,
): SchemaValidationResult {
  return validateWith(
    protocolValidator,
    value,
    "SEIP_PROTOCOL_SCHEMA_INVALID",
    validateProtocolSemantics,
  );
}

export function validateAmendmentSchema(
  value: unknown,
): SchemaValidationResult {
  return validateWith(
    amendmentValidator,
    value,
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
    validateAmendmentSemantics,
  );
}
