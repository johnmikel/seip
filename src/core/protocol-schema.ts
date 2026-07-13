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

function validateWith(
  validator: GeneratedValidator,
  value: unknown,
  code: DiagnosticCode,
): SchemaValidationResult {
  try {
    if (validator(value)) {
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
  );
}

export function validateAmendmentSchema(
  value: unknown,
): SchemaValidationResult {
  return validateWith(
    amendmentValidator,
    value,
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
  );
}
