export { normalizeDecimalLexeme } from "./canonical-value.js";
export type { CanonicalValue } from "./canonical-value.js";
export { canonicalize } from "./canonicalize.js";
export * from "./declaration.js";
export * from "./diagnostics.js";
export * from "./lifecycle.js";
export { computeChangeId, sortChanges } from "./fingerprint.js";
export type {
  NormalizedChange,
  NormalizedSnapshotValue,
  PathSegment,
} from "./fingerprint.js";
export * from "./policy.js";
export * from "./protocol-version.js";
