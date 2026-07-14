import { isProxy } from "node:util/types";

import type { SeipDeclaration } from "../generated/protocol-types.js";
import { validateDeclaration } from "./declaration.js";
import type { Diagnostic } from "./diagnostics.js";
import { sortChanges, type NormalizedChange } from "./fingerprint.js";
import {
  preflightJsonData,
  type JsonDataLimits,
} from "./json-data.js";

export interface DetectionReport {
  ok: boolean;
  completeness: "complete" | "partial";
  changes: NormalizedChange[];
  diagnostics: Diagnostic[];
  detector: {
    id: string;
    version: string;
    mode: "builtin" | "executed" | "imported";
  };
  source_digests: Record<string, string>;
}

export interface DetectorTrust {
  trusted: boolean;
  mode: "builtin" | "executed" | "operator_import" | "untrusted_import";
  authorization_id?: string;
}

export interface HistoryVerificationResult {
  status: "verified" | "failed" | "not_evaluated";
  base_sha?: string;
  diagnostics: Diagnostic[];
}

export interface EvidenceRequirement {
  mode: "none" | "all_consumers" | "selected";
  selected_teams?: string[];
  required_validator_ids?: string[];
  trusted_validator_ids: string[];
}

export type PolicyPreset = "advisory" | "declared" | "coordinated";
export type PolicyDecision = "pass" | "fail" | "error";

export interface PolicyInput {
  preset: PolicyPreset;
  detection: DetectionReport;
  detector_trust: DetectorTrust;
  declarations: unknown[];
  history?: HistoryVerificationResult;
  evidence: EvidenceRequirement;
}

export interface PolicyResult {
  ok: boolean;
  decision: PolicyDecision;
  diagnostics: Diagnostic[];
  coverage: Array<{
    changeId: string;
    declarationId?: string;
    state: "covered" | "uncovered" | "ambiguous";
  }>;
  history: "verified" | "not_evaluated" | "failed";
}

type JsonRecord = Record<string, unknown>;

interface PreparedInput {
  preset: PolicyPreset;
  detection: DetectionReport;
  detectorTrust: DetectorTrust;
  declarations: unknown[];
  history?: HistoryVerificationResult;
  evidence: EvidenceRequirement;
}

interface PreparationFailure {
  ok: false;
  result: PolicyResult;
}

interface PreparationSuccess {
  ok: true;
  value: PreparedInput;
}

interface ArrayPreparationSuccess {
  ok: true;
  value: unknown[];
}

const genericLimits = {
  maxBytes: 2 * 1024 * 1024,
  maxContainers: 100_000,
  maxDepth: 128,
} as const satisfies JsonDataLimits;
const detectionLimits = {
  arrayLengthLimits: [{ path: ["changes"], maxLength: 10_000 }],
  maxContainers: 100_000,
  maxDepth: 128,
} as const satisfies JsonDataLimits;
const importedDetectionLimits = {
  ...detectionLimits,
  maxBytes: 2 * 1024 * 1024,
} as const satisfies JsonDataLimits;

function diagnostic(
  code: string,
  message: string,
  path?: string,
): Diagnostic {
  return {
    ...(path === undefined ? {} : { path }),
    code,
    severity: "error",
    message,
  };
}

interface DiagnosticGroup {
  diagnostics: readonly Diagnostic[];
  phase: number;
}

const diagnosticFields = [
  "changeId",
  "declarationId",
  "path",
  "code",
  "message",
  "hint",
  "severity",
] as const satisfies readonly (keyof Diagnostic)[];

function normalizeDiagnostics(groups: readonly DiagnosticGroup[]): Diagnostic[] {
  const entries = groups.flatMap((group) =>
    group.diagnostics.map((entry) => ({ entry, phase: group.phase })),
  );
  entries.sort((left, right) => {
    if (left.phase !== right.phase) return left.phase - right.phase;
    for (const field of diagnosticFields) {
      const compared = compareCodeUnits(
        String(left.entry[field] ?? ""),
        String(right.entry[field] ?? ""),
      );
      if (compared !== 0) return compared;
    }
    return 0;
  });
  const seen = new Set<string>();
  const output: Diagnostic[] = [];
  for (const { entry } of entries) {
    const key = JSON.stringify(
      diagnosticFields.map((field) => entry[field] ?? null),
    );
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(entry);
  }
  return output;
}

function errorResult(
  diagnostics: Diagnostic[],
  history: PolicyResult["history"] = "not_evaluated",
  phase = 0,
): PolicyResult {
  return {
    ok: false,
    decision: "error",
    diagnostics: normalizeDiagnostics([{ diagnostics, phase }]),
    coverage: [],
    history,
  };
}

function invalidInput(path?: string): PreparationFailure {
  return {
    ok: false,
    result: errorResult([
      diagnostic(
        "SEIP_POLICY_INPUT_INVALID",
        "Policy input is invalid.",
        path,
      ),
    ]),
  };
}

function resourceFailure(path: string): PreparationFailure {
  return {
    ok: false,
    result: errorResult([
      diagnostic(
        "SEIP_PROTOCOL_RESOURCE_LIMIT",
        "exceeds JSON resource limits",
        path,
      ),
    ]),
  };
}

function configurationFailure(path: string): PreparationFailure {
  return {
    ok: false,
    result: errorResult([
      diagnostic(
        "SEIP_POLICY_CONFIGURATION_INVALID",
        "Policy configuration is invalid.",
        path,
      ),
    ]),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: JsonRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function readClosedShell(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): JsonRecord | undefined {
  if (!isRecord(value) || isProxy(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    return undefined;
  }
  const shell: JsonRecord = Object.create(null) as JsonRecord;
  for (const key of required) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      return undefined;
    }
    shell[key] = descriptor.value;
  }
  for (const key of optional) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (descriptor.enumerable !== true || !("value" in descriptor)) {
      return undefined;
    }
    shell[key] = descriptor.value;
  }
  return shell;
}

function readBoundedArrayShell(
  value: unknown,
  maxLength: number,
  path: string,
): ArrayPreparationSuccess | PreparationFailure {
  try {
    if (
      (typeof value !== "object" && typeof value !== "function") ||
      value === null ||
      isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return invalidInput(path);
    }
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return invalidInput(path);
    }
    const length = lengthDescriptor.value as number;
    if (length > maxLength) return resourceFailure(path);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") return invalidInput(path);
      if (key === "length") continue;
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= length ||
        String(index) !== key
      ) {
        return invalidInput(path);
      }
    }

    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        return invalidInput(path);
      }
      output.push(descriptor.value);
    }
    return { ok: true, value: output };
  } catch {
    return invalidInput(path);
  }
}

function preflightSection(
  value: unknown,
  limits: JsonDataLimits,
  path: string,
): { ok: true; value: unknown } | PreparationFailure {
  const prepared = preflightJsonData(value, limits);
  if (prepared.ok) return prepared;
  if ("kind" in prepared.issue && prepared.issue.kind === "resource_limit") {
    return resourceFailure(
      prepared.issue.path === undefined
        ? path
        : `${path}${prepared.issue.path}`,
    );
  }
  return invalidInput(
    prepared.issue.path === undefined
      ? path
      : `${path}${prepared.issue.path}`,
  );
}

function validDiagnostic(value: unknown): value is Diagnostic {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, ["code", "severity", "message"], [
      "path",
      "changeId",
      "declarationId",
      "hint",
    ])
  ) {
    return false;
  }
  if (
    typeof value.code !== "string" ||
    typeof value.message !== "string" ||
    (value.severity !== "error" &&
      value.severity !== "warning" &&
      value.severity !== "info")
  ) {
    return false;
  }
  return ["path", "changeId", "declarationId", "hint"].every(
    (key) => !Object.hasOwn(value, key) || typeof value[key] === "string",
  );
}

function validStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function validateDetection(value: unknown): value is DetectionReport {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "ok",
      "completeness",
      "changes",
      "diagnostics",
      "detector",
      "source_digests",
    ]) ||
    typeof value.ok !== "boolean" ||
    (value.completeness !== "complete" && value.completeness !== "partial") ||
    !Array.isArray(value.changes) ||
    !Array.isArray(value.diagnostics) ||
    !value.diagnostics.every(validDiagnostic) ||
    !validStringRecord(value.source_digests) ||
    !isRecord(value.detector) ||
    !hasExactKeys(value.detector, ["id", "version", "mode"]) ||
    typeof value.detector.id !== "string" ||
    typeof value.detector.version !== "string" ||
    (value.detector.mode !== "builtin" &&
      value.detector.mode !== "executed" &&
      value.detector.mode !== "imported")
  ) {
    return false;
  }
  return true;
}

function validateTrust(value: unknown): value is DetectorTrust {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["trusted", "mode"], ["authorization_id"]) &&
    typeof value.trusted === "boolean" &&
    (value.mode === "builtin" ||
      value.mode === "executed" ||
      value.mode === "operator_import" ||
      value.mode === "untrusted_import") &&
    (!Object.hasOwn(value, "authorization_id") ||
      typeof value.authorization_id === "string")
  );
}

function validateEvidence(value: unknown): value is EvidenceRequirement {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, ["mode", "trusted_validator_ids"], [
      "selected_teams",
      "required_validator_ids",
    ]) ||
    (value.mode !== "none" &&
      value.mode !== "all_consumers" &&
      value.mode !== "selected") ||
    !Array.isArray(value.trusted_validator_ids) ||
    !value.trusted_validator_ids.every((entry) => typeof entry === "string")
  ) {
    return false;
  }
  return ["selected_teams", "required_validator_ids"].every(
    (key) =>
      !Object.hasOwn(value, key) ||
      (Array.isArray(value[key]) &&
        value[key].every((entry) => typeof entry === "string")),
  );
}

function validIdentifierList(
  values: readonly string[] | undefined,
  requireNonempty: boolean,
): boolean {
  if (values === undefined) return !requireNonempty;
  if (requireNonempty && values.length === 0) return false;
  const seen = new Set<string>();
  for (const value of values) {
    if (
      value.length === 0 ||
      value.length > 128 ||
      value.trim() !== value ||
      seen.has(value)
    ) {
      return false;
    }
    seen.add(value);
  }
  return true;
}

function validEvidenceConfiguration(value: EvidenceRequirement): boolean {
  const hasSelectedTeams = Object.hasOwn(value, "selected_teams");
  if (value.mode === "selected") {
    if (!validIdentifierList(value.selected_teams, true)) return false;
  } else if (hasSelectedTeams) {
    return false;
  }
  if (!validIdentifierList(value.trusted_validator_ids, false)) return false;
  if (!validIdentifierList(value.required_validator_ids, false)) return false;
  if (
    value.mode !== "none" &&
    value.trusted_validator_ids.length === 0
  ) {
    return false;
  }
  const trusted = new Set(value.trusted_validator_ids);
  return (value.required_validator_ids ?? []).every((id) => trusted.has(id));
}

function validateHistory(value: unknown): value is HistoryVerificationResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["status", "diagnostics"], ["base_sha"]) &&
    (value.status === "verified" ||
      value.status === "failed" ||
      value.status === "not_evaluated") &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(validDiagnostic) &&
    (!Object.hasOwn(value, "base_sha") || typeof value.base_sha === "string")
  );
}

function prepareInput(input: unknown): PreparationSuccess | PreparationFailure {
  try {
    const shell = readClosedShell(
      input,
      ["preset", "detection", "detector_trust", "declarations", "evidence"],
      ["history"],
    );
    if (shell === undefined) return invalidInput();
    if (
      shell.preset !== "advisory" &&
      shell.preset !== "declared" &&
      shell.preset !== "coordinated"
    ) {
      return configurationFailure("/preset");
    }

    const preparedDeclarations = readBoundedArrayShell(
      shell.declarations,
      5_000,
      "/declarations",
    );
    if (!preparedDeclarations.ok) return preparedDeclarations;

    const detectionShell = readClosedShell(shell.detection, [
      "ok",
      "completeness",
      "changes",
      "diagnostics",
      "detector",
      "source_digests",
    ]);
    if (detectionShell === undefined) return invalidInput("/detection");
    const detectorShell = readClosedShell(detectionShell.detector, [
      "id",
      "version",
      "mode",
    ]);
    if (detectorShell === undefined) {
      return invalidInput("/detection/detector");
    }
    const preparedChanges = readBoundedArrayShell(
      detectionShell.changes,
      10_000,
      "/detection/changes",
    );
    if (!preparedChanges.ok) return preparedChanges;
    const imported = detectorShell.mode === "imported";
    const preparedDetection = preflightSection(
      shell.detection,
      imported ? importedDetectionLimits : detectionLimits,
      "/detection",
    );
    if (!preparedDetection.ok) return preparedDetection;
    if (!validateDetection(preparedDetection.value)) {
      return invalidInput("/detection");
    }

    const preparedTrust = preflightSection(
      shell.detector_trust,
      genericLimits,
      "/detector_trust",
    );
    if (!preparedTrust.ok) return preparedTrust;
    if (!validateTrust(preparedTrust.value)) {
      return invalidInput("/detector_trust");
    }

    const preparedEvidence = preflightSection(
      shell.evidence,
      genericLimits,
      "/evidence",
    );
    if (!preparedEvidence.ok) return preparedEvidence;
    if (!validateEvidence(preparedEvidence.value)) {
      return configurationFailure("/evidence");
    }
    if (!validEvidenceConfiguration(preparedEvidence.value)) {
      return configurationFailure("/evidence");
    }

    let history: HistoryVerificationResult | undefined;
    if (Object.hasOwn(shell, "history")) {
      const preparedHistory = preflightSection(
        shell.history,
        genericLimits,
        "/history",
      );
      if (!preparedHistory.ok) return preparedHistory;
      if (!validateHistory(preparedHistory.value)) {
        return invalidInput("/history");
      }
      history = preparedHistory.value;
    }

    return {
      ok: true,
      value: {
        preset: shell.preset as PolicyPreset,
        detection: preparedDetection.value,
        detectorTrust: preparedTrust.value,
        declarations: preparedDeclarations.value,
        ...(history === undefined ? {} : { history }),
        evidence: preparedEvidence.value,
      },
    };
  } catch {
    return invalidInput();
  }
}

function trustState(
  detection: DetectionReport,
  trust: DetectorTrust,
): "trusted" | "untrusted" | "invalid" {
  const hasAuthorization = Object.hasOwn(trust, "authorization_id");
  if (detection.detector.mode === "builtin") {
    return trust.mode === "builtin" && trust.trusted && !hasAuthorization
      ? "trusted"
      : "invalid";
  }
  if (detection.detector.mode === "executed") {
    return trust.mode === "executed" && trust.trusted && !hasAuthorization
      ? "trusted"
      : "invalid";
  }
  if (
    trust.mode === "operator_import" &&
    trust.trusted &&
    typeof trust.authorization_id === "string" &&
    trust.authorization_id.length > 0 &&
    trust.authorization_id.trim() === trust.authorization_id
  ) {
    return "trusted";
  }
  if (
    trust.mode === "untrusted_import" &&
    !trust.trusted &&
    !hasAuthorization
  ) {
    return "untrusted";
  }
  return "invalid";
}

function finding(
  code: string,
  message: string,
  severity: "error" | "warning",
  changeId?: string,
): Diagnostic {
  return {
    ...(changeId === undefined ? {} : { changeId }),
    code,
    severity,
    message,
  };
}

function validateDeclarations(
  values: readonly unknown[],
):
  | { ok: true; value: SeipDeclaration[] }
  | { ok: false; diagnostics: Diagnostic[] } {
  const declarations: SeipDeclaration[] = [];
  const diagnostics: Diagnostic[] = [];
  const validations = new WeakMap<
    object,
    ReturnType<typeof validateDeclaration>
  >();
  for (let index = 0; index < values.length; index += 1) {
    const candidate = values[index];
    let result: ReturnType<typeof validateDeclaration>;
    if (typeof candidate === "object" && candidate !== null) {
      const cached = validations.get(candidate);
      if (cached === undefined) {
        result = validateDeclaration(candidate);
        validations.set(candidate, result);
      } else {
        result = cached;
      }
    } else {
      result = validateDeclaration(candidate);
    }
    if (result.ok) {
      declarations.push(result.value);
      continue;
    }
    diagnostics.push(
      ...result.diagnostics.map((entry) => ({
        ...entry,
        path:
          entry.path === undefined
            ? `/declarations/${index}`
            : `/declarations/${index}${entry.path}`,
      })),
    );
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const seen = new Set<string>();
  for (let index = 0; index < declarations.length; index += 1) {
    const declaration = declarations[index];
    if (declaration === undefined) continue;
    if (seen.has(declaration.declaration_id)) {
      diagnostics.push({
        code: "SEIP_POLICY_INPUT_INVALID",
        severity: "error",
        message: "Declaration identifiers must be unique.",
        path: `/declarations/${index}/declaration_id`,
        declarationId: declaration.declaration_id,
      });
    } else {
      seen.add(declaration.declaration_id);
    }
  }
  return diagnostics.length === 0
    ? { ok: true, value: declarations }
    : { ok: false, diagnostics };
}

const activeStatuses = new Set([
  "DRAFT",
  "PROPOSED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "ENFORCING",
]);
const declaredStatuses = new Set([
  "PROPOSED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "ENFORCING",
  "COMPLETED",
]);
const coordinatedStatuses = new Set([
  "ACCEPTED",
  "ENFORCING",
  "COMPLETED",
]);

interface ParsedTimestamp {
  fraction: string;
  leapSecond: boolean;
  seconds: bigint;
}

interface CoverageCandidates {
  active: SeipDeclaration[];
  completed: SeipDeclaration[];
}

const RFC3339_PARTS =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2}):(\d{2}))$/;

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function parseTimestamp(value: string): ParsedTimestamp | undefined {
  const match = RFC3339_PARTS.exec(value);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zone = match[8];
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    zone === undefined
  ) {
    return undefined;
  }
  let seconds = BigInt(
    daysFromCivil(year, month, day) * 86_400 +
      hour * 3_600 +
      minute * 60 +
      Math.min(second, 59),
  );
  if (zone !== "Z" && zone !== "z") {
    const sign = match[9];
    const offsetHour = Number(match[10]);
    const offsetMinute = Number(match[11]);
    if (
      (sign !== "+" && sign !== "-") ||
      !Number.isInteger(offsetHour) ||
      !Number.isInteger(offsetMinute)
    ) {
      return undefined;
    }
    const offset = BigInt(offsetHour * 3_600 + offsetMinute * 60);
    seconds += sign === "+" ? -offset : offset;
  }
  return {
    seconds,
    fraction: match[7] ?? "",
    leapSecond: second === 60,
  };
}

function compareTimestamps(left: string, right: string): number {
  const leftParsed = parseTimestamp(left);
  const rightParsed = parseTimestamp(right);
  if (leftParsed === undefined || rightParsed === undefined) return 0;
  if (leftParsed.seconds < rightParsed.seconds) return -1;
  if (leftParsed.seconds > rightParsed.seconds) return 1;
  if (leftParsed.leapSecond !== rightParsed.leapSecond) {
    return leftParsed.leapSecond ? 1 : -1;
  }
  const length = Math.max(
    leftParsed.fraction.length,
    rightParsed.fraction.length,
  );
  const leftFraction = leftParsed.fraction.padEnd(length, "0");
  const rightFraction = rightParsed.fraction.padEnd(length, "0");
  return leftFraction < rightFraction
    ? -1
    : leftFraction > rightFraction
      ? 1
      : 0;
}

function completedAt(declaration: SeipDeclaration): string {
  for (let index = declaration.events.length - 1; index >= 0; index -= 1) {
    const event = declaration.events[index];
    if (event?.type === "COMPLETED") return event.at;
  }
  return declaration.created_at;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function buildCoverageIndex(
  declarations: readonly SeipDeclaration[],
): Map<string, CoverageCandidates> {
  const index = new Map<string, CoverageCandidates>();
  for (const declaration of declarations) {
    const destination = activeStatuses.has(declaration.status)
      ? "active"
      : declaration.status === "COMPLETED"
        ? "completed"
        : undefined;
    if (destination === undefined) continue;
    for (const change of declaration.changes) {
      let candidates = index.get(change.change_id);
      if (candidates === undefined) {
        candidates = { active: [], completed: [] };
        index.set(change.change_id, candidates);
      }
      candidates[destination].push(declaration);
    }
  }
  return index;
}

function eligibleStatus(
  preset: PolicyPreset,
  declaration: SeipDeclaration,
): boolean {
  if (preset === "advisory") return true;
  return (preset === "declared" ? declaredStatuses : coordinatedStatuses).has(
    declaration.status,
  );
}

function evaluateCoverage(
  changes: readonly NormalizedChange[],
  declarations: readonly SeipDeclaration[],
  preset: PolicyPreset,
): {
  coverage: PolicyResult["coverage"];
  diagnostics: Diagnostic[];
  selected: Map<string, SeipDeclaration>;
} {
  const coverage: PolicyResult["coverage"] = [];
  const diagnostics: Diagnostic[] = [];
  const selectedByChange = new Map<string, SeipDeclaration>();
  const severity = preset === "advisory" ? "warning" : "error";
  const index = buildCoverageIndex(declarations);

  for (const change of changes) {
    const candidates = index.get(change.change_id) ?? {
      active: [],
      completed: [],
    };
    const active = candidates.active;
    if (active.length > 1) {
      coverage.push({ changeId: change.change_id, state: "ambiguous" });
      diagnostics.push(
        finding(
          "SEIP_POLICY_AMBIGUOUS_COVERAGE",
          "More than one active declaration references this change.",
          severity,
          change.change_id,
        ),
      );
      continue;
    }

    let selected = active[0];
    if (selected === undefined) {
      const completed = [...candidates.completed].sort((left, right) => {
        const instant = compareTimestamps(completedAt(right), completedAt(left));
        return instant === 0
          ? compareCodeUnits(left.declaration_id, right.declaration_id)
          : instant;
      });
      selected = completed[0];
      if (selected !== undefined && completed.length > 1) {
        const alternatives = completed
          .slice(1)
          .sort((left, right) =>
            compareCodeUnits(left.declaration_id, right.declaration_id),
          );
        for (const alternative of alternatives) {
          diagnostics.push({
            code: "SEIP_POLICY_COMPLETED_HISTORY",
            severity: "info",
            message: "An older completed declaration also references this change.",
            changeId: change.change_id,
            declarationId: alternative.declaration_id,
          });
        }
      }
    }

    if (selected === undefined) {
      coverage.push({ changeId: change.change_id, state: "uncovered" });
      diagnostics.push(
        finding(
          "SEIP_POLICY_UNCOVERED_CHANGE",
          "Change has no eligible declaration coverage.",
          severity,
          change.change_id,
        ),
      );
      continue;
    }

    if (!eligibleStatus(preset, selected)) {
      coverage.push({
        changeId: change.change_id,
        declarationId: selected.declaration_id,
        state: "uncovered",
      });
      diagnostics.push({
        code: "SEIP_POLICY_STATUS_INELIGIBLE",
        severity,
        message: "Selected declaration status is ineligible for this preset.",
        changeId: change.change_id,
        declarationId: selected.declaration_id,
      });
      continue;
    }

    coverage.push({
      changeId: change.change_id,
      declarationId: selected.declaration_id,
      state: "covered",
    });
    selectedByChange.set(change.change_id, selected);
  }
  return { coverage, diagnostics, selected: selectedByChange };
}

function coordinatedHistory(
  history: HistoryVerificationResult | undefined,
):
  | { ok: true; diagnostics: Diagnostic[] }
  | {
      ok: false;
      diagnostics: Diagnostic[];
      history: PolicyResult["history"];
    } {
  if (history === undefined || history.status === "not_evaluated") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "SEIP_HISTORY_BASE_REQUIRED",
          "Coordinated policy requires an explicit verified base.",
          "/history",
        ),
      ],
      history: "not_evaluated",
    };
  }
  if (history.status === "failed") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "SEIP_HISTORY_BASE_UNAVAILABLE",
          "History verification failed.",
          "/history",
        ),
        ...history.diagnostics,
      ],
      history: "failed",
    };
  }
  if (history.diagnostics.some((entry) => entry.severity === "error")) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "SEIP_HISTORY_BASE_UNAVAILABLE",
          "History verification reported an error.",
          "/history",
        ),
        ...history.diagnostics,
      ],
      history: "failed",
    };
  }
  if (
    typeof history.base_sha !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(history.base_sha)
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "SEIP_HISTORY_BASE_REQUIRED",
          "Verified history requires a lowercase Git object identifier.",
          "/history/base_sha",
        ),
      ],
      history: "not_evaluated",
    };
  }
  return { ok: true, diagnostics: history.diagnostics };
}

function selectedTeamsAreKnown(
  requirement: EvidenceRequirement,
  declarations: readonly SeipDeclaration[],
): boolean {
  if (requirement.mode !== "selected") return true;
  const known = new Set<string>();
  for (const declaration of declarations) {
    for (const consumer of declaration.consumers) known.add(consumer.team);
  }
  return (requirement.selected_teams ?? []).every((team) => known.has(team));
}

function applyAcknowledgements(
  evaluated: ReturnType<typeof evaluateCoverage>,
  preset: PolicyPreset,
): Diagnostic[] {
  if (preset !== "coordinated") return [];
  const diagnostics: Diagnostic[] = [];
  const checked = new Map<string, boolean>();
  for (const declaration of evaluated.selected.values()) {
    if (checked.has(declaration.declaration_id)) continue;
    const latest = new Map<string, SeipDeclaration["responses"][number]>();
    for (const response of declaration.responses) {
      if (response.declaration_revision !== declaration.revision) continue;
      latest.set(response.team, response);
    }
    const acknowledged = declaration.consumers.every((consumer) => {
      const response = latest.get(consumer.team);
      return response?.decision === "ACKNOWLEDGED";
    });
    checked.set(declaration.declaration_id, acknowledged);
    if (!acknowledged) {
      diagnostics.push({
        code: "SEIP_POLICY_ACKNOWLEDGEMENT_REQUIRED",
        severity: "error",
        message: "Every consumer must acknowledge the current revision.",
        declarationId: declaration.declaration_id,
      });
    }
  }
  if (diagnostics.length > 0) {
    const failed = new Set(
      diagnostics
        .map((entry) => entry.declarationId)
        .filter((entry): entry is string => entry !== undefined),
    );
    for (const entry of evaluated.coverage) {
      if (
        entry.declarationId !== undefined &&
        failed.has(entry.declarationId)
      ) {
        entry.state = "uncovered";
      }
    }
  }
  return diagnostics;
}

function sourceDigestsEqual(
  candidate: Record<string, string>,
  expected: Record<string, string>,
  expectedKeyCount: number,
): boolean {
  const candidateKeys = Object.keys(candidate);
  return (
    candidateKeys.length === expectedKeyCount &&
    candidateKeys.every(
      (key) => Object.hasOwn(expected, key) && candidate[key] === expected[key],
    )
  );
}

type EvidenceResults = Map<
  string,
  Map<string, Map<string, "PASSED" | "FAILED">>
>;

function latestEligibleEvidence(
  declaration: SeipDeclaration,
  requiredTeams: ReadonlySet<string>,
  trustedValidators: ReadonlySet<string>,
  sourceDigests: Record<string, string>,
  sourceDigestKeyCount: number,
): EvidenceResults {
  const declaredChanges = new Set(
    declaration.changes.map((change) => change.change_id),
  );
  const results: EvidenceResults = new Map();
  for (const evidence of declaration.evidence) {
    if (
      evidence.declaration_revision !== declaration.revision ||
      !requiredTeams.has(evidence.team) ||
      !trustedValidators.has(evidence.validator_id) ||
      !sourceDigestsEqual(
        evidence.source_digests,
        sourceDigests,
        sourceDigestKeyCount,
      )
    ) {
      continue;
    }
    let validators = results.get(evidence.team);
    if (validators === undefined) {
      validators = new Map();
      results.set(evidence.team, validators);
    }
    let changes = validators.get(evidence.validator_id);
    if (changes === undefined) {
      changes = new Map();
      validators.set(evidence.validator_id, changes);
    }
    for (const changeId of evidence.change_ids) {
      if (declaredChanges.has(changeId)) changes.set(changeId, evidence.result);
    }
  }
  return results;
}

function evidenceSatisfied(
  declaration: SeipDeclaration,
  requirement: EvidenceRequirement,
  sourceDigests: Record<string, string>,
  sourceDigestKeyCount: number,
): boolean {
  const declaredTeams = new Set(
    declaration.consumers.map((consumer) => consumer.team),
  );
  const requiredTeams =
    requirement.mode === "all_consumers"
      ? declaredTeams
      : new Set(
          (requirement.selected_teams ?? []).filter((team) =>
            declaredTeams.has(team),
          ),
        );
  if (requiredTeams.size === 0) return true;

  const trusted = new Set(requirement.trusted_validator_ids);
  const requiredValidators = new Set(
    requirement.required_validator_ids ?? [],
  );
  const results = latestEligibleEvidence(
    declaration,
    requiredTeams,
    trusted,
    sourceDigests,
    sourceDigestKeyCount,
  );
  const changeCount = BigInt(declaration.changes.length);

  if (requiredValidators.size > 0) {
    let passed = 0n;
    for (const [team, validators] of results) {
      if (!requiredTeams.has(team)) continue;
      for (const [validator, changes] of validators) {
        if (!requiredValidators.has(validator)) continue;
        for (const result of changes.values()) {
          if (result === "PASSED") passed += 1n;
        }
      }
    }
    const expected =
      BigInt(requiredTeams.size) *
      BigInt(requiredValidators.size) *
      changeCount;
    return passed === expected;
  }

  let passedPairs = 0n;
  for (const team of requiredTeams) {
    const passedChanges = new Set<string>();
    const validators = results.get(team);
    if (validators !== undefined) {
      for (const changes of validators.values()) {
        for (const [changeId, result] of changes) {
          if (result === "PASSED") passedChanges.add(changeId);
        }
      }
    }
    passedPairs += BigInt(passedChanges.size);
  }
  return passedPairs === BigInt(requiredTeams.size) * changeCount;
}

function applyEvidence(
  evaluated: ReturnType<typeof evaluateCoverage>,
  preset: PolicyPreset,
  requirement: EvidenceRequirement,
  sourceDigests: Record<string, string>,
): Diagnostic[] {
  if (requirement.mode === "none") return [];
  const diagnostics: Diagnostic[] = [];
  const checked = new Set<string>();
  const failed = new Set<string>();
  const sourceDigestKeyCount = Object.keys(sourceDigests).length;
  for (const declaration of evaluated.selected.values()) {
    if (checked.has(declaration.declaration_id)) continue;
    checked.add(declaration.declaration_id);
    if (
      !evidenceSatisfied(
        declaration,
        requirement,
        sourceDigests,
        sourceDigestKeyCount,
      )
    ) {
      failed.add(declaration.declaration_id);
      diagnostics.push({
        code: "SEIP_POLICY_EVIDENCE_REQUIRED",
        severity: preset === "advisory" ? "warning" : "error",
        message: "Selected declaration lacks required validation evidence.",
        declarationId: declaration.declaration_id,
      });
    }
  }
  if (failed.size > 0) {
    for (const entry of evaluated.coverage) {
      if (
        entry.declarationId !== undefined &&
        failed.has(entry.declarationId)
      ) {
        entry.state = "uncovered";
      }
    }
  }
  return diagnostics;
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  try {
    const prepared = prepareInput(input);
    if (!prepared.ok) return prepared.result;
    const value = prepared.value;
    const trust = trustState(value.detection, value.detectorTrust);
    if (trust === "invalid") {
      return errorResult(
        [
          diagnostic(
            "SEIP_DETECTOR_TRUST_INVALID",
            "Detector provenance and trust do not match.",
          ),
        ],
        "not_evaluated",
        1,
      );
    }
    if (trust === "untrusted" && value.preset !== "advisory") {
      return errorResult(
        [
          diagnostic(
            "SEIP_DETECTOR_UNTRUSTED_IMPORT",
            "Untrusted imported detection is advisory-only.",
          ),
        ],
        "not_evaluated",
        1,
      );
    }

    const trustDiagnostics: Diagnostic[] =
      trust === "untrusted"
        ? [
            {
              code: "SEIP_DETECTOR_UNTRUSTED_IMPORT",
              severity: "warning",
              message:
                "Untrusted imported detection is coerced to unknown compatibility.",
            },
          ]
        : [];

    const detectorDiagnostics = value.detection.diagnostics.map((entry) => ({
      ...entry,
    }));
    const detectorFailures: Diagnostic[] = [];
    if (
      !value.detection.ok ||
      detectorDiagnostics.some((entry) => entry.severity === "error")
    ) {
      detectorFailures.push(
        diagnostic(
          "SEIP_DETECTOR_FAILED",
          "Detector execution or output reported an error.",
          "/detection",
        ),
      );
    }
    if (value.detection.completeness === "partial") {
      detectorFailures.push(
        diagnostic(
          "SEIP_DETECTOR_INCOMPLETE",
          "Detector output is incomplete.",
        ),
      );
    }
    if (detectorFailures.length > 0) {
      return errorResult(
        [...detectorFailures, ...detectorDiagnostics],
        "not_evaluated",
        2,
      );
    }

    const sorted = sortChanges(value.detection.changes);
    if (!sorted.ok) {
      return errorResult(
        sorted.diagnostics.map((entry) => ({
          ...entry,
          path:
            entry.path === undefined
              ? "/detection/changes"
              : `/detection/changes${entry.path}`,
        })),
        "not_evaluated",
        2,
      );
    }
    const seen = new Set<string>();
    for (let index = 0; index < value.detection.changes.length; index += 1) {
      const change = value.detection.changes[index] as NormalizedChange;
      if (seen.has(change.change_id)) {
        return errorResult(
          [
            diagnostic(
              "SEIP_POLICY_INPUT_INVALID",
              "Detected change identifiers must be unique.",
              `/detection/changes/${index}/change_id`,
            ),
          ],
          "not_evaluated",
          2,
        );
      }
      seen.add(change.change_id);
    }

    const declarations = validateDeclarations(value.declarations);
    if (!declarations.ok) {
      return errorResult(declarations.diagnostics, "not_evaluated", 3);
    }
    if (!selectedTeamsAreKnown(value.evidence, declarations.value)) {
      return errorResult([
        diagnostic(
          "SEIP_POLICY_CONFIGURATION_INVALID",
          "Selected evidence teams must name declared consumers.",
          "/evidence/selected_teams",
        ),
      ]);
    }

    let historyState: PolicyResult["history"] = "not_evaluated";
    let historyDiagnostics: Diagnostic[] = [];
    if (value.preset === "coordinated") {
      const checkedHistory = coordinatedHistory(value.history);
      if (!checkedHistory.ok) {
        return errorResult(
          checkedHistory.diagnostics,
          checkedHistory.history,
          4,
        );
      }
      historyState = "verified";
      historyDiagnostics = checkedHistory.diagnostics;
    }

    const relevant = sorted.value
      .filter(
        (change) =>
          trust === "untrusted" || change.compatibility !== "compatible",
      )
      .sort((left, right) =>
        left.change_id < right.change_id
          ? -1
          : left.change_id > right.change_id
            ? 1
            : 0,
      );
    const evaluated = evaluateCoverage(
      relevant,
      declarations.value,
      value.preset,
    );
    const acknowledgementDiagnostics = applyAcknowledgements(
      evaluated,
      value.preset,
    );
    const evidenceDiagnostics = applyEvidence(
      evaluated,
      value.preset,
      value.evidence,
      value.detection.source_digests,
    );
    const policyDiagnostics = [
      ...evaluated.diagnostics,
      ...acknowledgementDiagnostics,
      ...evidenceDiagnostics,
    ];
    const normalizedDiagnostics = normalizeDiagnostics([
      { diagnostics: trustDiagnostics, phase: 1 },
      { diagnostics: detectorDiagnostics, phase: 2 },
      { diagnostics: historyDiagnostics, phase: 4 },
      {
        diagnostics: evaluated.diagnostics.filter(
          (entry) => entry.code !== "SEIP_POLICY_STATUS_INELIGIBLE",
        ),
        phase: 5,
      },
      {
        diagnostics: evaluated.diagnostics.filter(
          (entry) => entry.code === "SEIP_POLICY_STATUS_INELIGIBLE",
        ),
        phase: 6,
      },
      { diagnostics: acknowledgementDiagnostics, phase: 7 },
      { diagnostics: evidenceDiagnostics, phase: 8 },
    ]);
    if (value.preset === "advisory") {
      return {
        ok: true,
        decision: "pass",
        diagnostics: normalizedDiagnostics,
        coverage: evaluated.coverage,
        history: "not_evaluated",
      };
    }
    if (policyDiagnostics.some((entry) => entry.severity === "error")) {
      return {
        ok: false,
        decision: "fail",
        diagnostics: normalizedDiagnostics,
        coverage: evaluated.coverage,
        history: historyState,
      };
    }
    return {
      ok: true,
      decision: "pass",
      diagnostics: normalizedDiagnostics,
      coverage: evaluated.coverage,
      history: historyState,
    };
  } catch {
    return errorResult([
      diagnostic("SEIP_POLICY_INPUT_INVALID", "Policy input is invalid."),
    ]);
  }
}
