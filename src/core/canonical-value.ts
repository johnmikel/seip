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

interface SignedDecimalInteger {
  negative: boolean;
  magnitude: string;
}

function invalidDecimal(): Result<never> {
  return failure(
    "SEIP_CANONICAL_DECIMAL_INVALID",
    "Decimal lexeme must be a strict JSON number string.",
  );
}

function normalizeMagnitude(magnitude: string): string {
  let firstNonZero = 0;
  while (
    firstNonZero < magnitude.length &&
    magnitude.charCodeAt(firstNonZero) === 0x30
  ) {
    firstNonZero += 1;
  }
  return firstNonZero === magnitude.length
    ? "0"
    : magnitude.slice(firstNonZero);
}

function signedDecimalInteger(
  negative: boolean,
  magnitude: string,
): SignedDecimalInteger {
  const normalizedMagnitude = normalizeMagnitude(magnitude);
  return {
    negative: negative && normalizedMagnitude !== "0",
    magnitude: normalizedMagnitude,
  };
}

function compareMagnitudes(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function addMagnitudes(left: string, right: string): string {
  const width = Math.max(left.length, right.length);
  const output = new Array<string>(width + 1);
  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  let outputIndex = width;
  let carry = 0;

  while (outputIndex > 0) {
    const leftDigit =
      leftIndex >= 0 ? left.charCodeAt(leftIndex) - 0x30 : 0;
    const rightDigit =
      rightIndex >= 0 ? right.charCodeAt(rightIndex) - 0x30 : 0;
    const total = leftDigit + rightDigit + carry;
    output[outputIndex] = String(total % 10);
    carry = total >= 10 ? 1 : 0;
    leftIndex -= 1;
    rightIndex -= 1;
    outputIndex -= 1;
  }

  if (carry === 1) {
    output[0] = "1";
    return output.join("");
  }
  return output.slice(1).join("");
}

function subtractMagnitudes(larger: string, smaller: string): string {
  const output = new Array<string>(larger.length);
  let smallerIndex = smaller.length - 1;
  let borrow = 0;

  for (let index = larger.length - 1; index >= 0; index -= 1) {
    const largerDigit = larger.charCodeAt(index) - 0x30;
    const smallerDigit =
      smallerIndex >= 0 ? smaller.charCodeAt(smallerIndex) - 0x30 : 0;
    let difference = largerDigit - smallerDigit - borrow;
    if (difference < 0) {
      difference += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    output[index] = String(difference);
    smallerIndex -= 1;
  }

  return normalizeMagnitude(output.join(""));
}

function addSignedDecimalIntegers(
  left: SignedDecimalInteger,
  right: SignedDecimalInteger,
): SignedDecimalInteger {
  if (left.negative === right.negative) {
    return signedDecimalInteger(
      left.negative,
      addMagnitudes(left.magnitude, right.magnitude),
    );
  }

  const comparison = compareMagnitudes(left.magnitude, right.magnitude);
  if (comparison === 0) return signedDecimalInteger(false, "0");
  const larger = comparison > 0 ? left : right;
  const smaller = comparison > 0 ? right : left;
  return signedDecimalInteger(
    larger.negative,
    subtractMagnitudes(larger.magnitude, smaller.magnitude),
  );
}

function adjustedExponent(
  exponentSign: string,
  exponentDigits: string | undefined,
  adjustment: number,
): string {
  // Only the bounded difference of two JavaScript string lengths becomes a
  // number. The unbounded source exponent remains decimal text throughout.
  const exponent = signedDecimalInteger(
    exponentSign === "-",
    exponentDigits ?? "0",
  );
  const adjustmentInteger = signedDecimalInteger(
    adjustment < 0,
    String(Math.abs(adjustment)),
  );
  const result = addSignedDecimalIntegers(exponent, adjustmentInteger);
  return `${result.negative ? "-" : ""}${result.magnitude}`;
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

  const exponent = adjustedExponent(
    exponentSign,
    exponentDigits,
    trailingZeros - fraction.length,
  );

  return {
    ok: true,
    value: `${sign}${coefficient}e${exponent}`,
    diagnostics: [],
  };
}
