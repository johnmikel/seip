export { normalizeDecimalLexeme } from "./canonical-value.js";
export type { CanonicalValue } from "./canonical-value.js";
export { canonicalize } from "./canonicalize.js";
export { createDeclaration, validateDeclaration } from "./declaration.js";
export type {
  CreateDeclarationInput,
  CreationContext,
} from "./declaration.js";
export type {
  Diagnostic,
  DiagnosticSeverity,
  Result,
} from "./diagnostics.js";
export { computeChangeId, sortChanges } from "./fingerprint.js";
export type {
  NormalizedChange,
  NormalizedSnapshotValue,
  PathSegment,
} from "./fingerprint.js";
export {
  acceptDeclaration,
  amendDeclaration,
  completeDeclaration,
  proposeDeclaration,
  recordConsumerResponse,
  rejectDeclaration,
  startEnforcement,
  withdrawDeclaration,
} from "./lifecycle.js";
export type {
  AmendmentPatch,
  ConsumerUpdate,
  TransitionContext,
} from "./lifecycle.js";
export { evaluatePolicy } from "./policy.js";
export type {
  DetectionReport,
  DetectorTrust,
  EvidenceRequirement,
  HistoryVerificationResult,
  PolicyDecision,
  PolicyInput,
  PolicyPreset,
  PolicyResult,
} from "./policy.js";
export { validateProtocolSchema } from "./protocol-schema.js";
export type { SchemaValidationResult } from "./protocol-schema.js";
export { validateProtocolVersion } from "./protocol-version.js";
export type {
  Consumer,
  ConsumerResponse,
  ConsumerResponseDecision,
  DeclarationStatus,
  LifecycleEvent,
  SeipDeclaration,
  ValidationEvidence,
} from "../generated/protocol-types.js";
