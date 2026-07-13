import { failure, type Result } from "./diagnostics.js";

export type CanonicalValue =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "number"; decimal: string }
  | { kind: "array"; items: CanonicalValue[] }
  | {
      kind: "object";
      entries: Array<{ key: string; value: CanonicalValue }>;
    };

const decimalLexemePattern =
  /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?)([0-9]+))?$/;

function invalidDecimal(): Result<never> {
  return failure(
    "SEIP_CANONICAL_DECIMAL_INVALID",
    "Decimal lexeme must be a strict JSON number string.",
  );
}

export function normalizeDecimalLexeme(lexeme: unknown): Result<string> {
  if (typeof lexeme !== "string") return invalidDecimal();

  const match = decimalLexemePattern.exec(lexeme);
  if (match === null) return invalidDecimal();

  const sign = match[1] ?? "";
  const integer = match[2];
  const fraction = match[3] ?? "";
  const exponentSign = match[4] ?? "";
  const exponentDigits = match[5];
  if (integer === undefined) return invalidDecimal();

  const digits = `${integer}${fraction}`;
  const withoutLeadingZeros = digits.replace(/^0+/, "");
  if (withoutLeadingZeros.length === 0) {
    return { ok: true, value: "0e0", diagnostics: [] };
  }

  const trailingZeros = /0+$/.exec(withoutLeadingZeros)?.[0].length ?? 0;
  const coefficient =
    trailingZeros === 0
      ? withoutLeadingZeros
      : withoutLeadingZeros.slice(0, -trailingZeros);

  let exponent = 0n;
  if (exponentDigits !== undefined) {
    exponent = BigInt(exponentDigits);
    if (exponentSign === "-") exponent = -exponent;
  }
  exponent -= BigInt(fraction.length);
  exponent += BigInt(trailingZeros);

  return {
    ok: true,
    value: `${sign}${coefficient}e${exponent.toString()}`,
    diagnostics: [],
  };
}
