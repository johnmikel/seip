export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  changeId?: string;
  declarationId?: string;
  hint?: string;
}

export type Result<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export function failure(
  code: string,
  message: string,
  extras: Partial<Diagnostic> = {},
): Result<never> {
  return {
    ok: false,
    diagnostics: [{ ...extras, code, severity: "error", message }],
  };
}
