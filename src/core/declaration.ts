import type {
  DeclarationStatus,
  LifecycleEvent,
  SeipDeclaration,
} from "../generated/protocol-types.js";
import { normalizeDecimalLexeme } from "./canonical-value.js";
import { canonicalize } from "./canonicalize.js";
import type { Diagnostic, Result } from "./diagnostics.js";
import { computeChangeId } from "./fingerprint.js";
import { sortChanges } from "./fingerprint.js";
import {
  preflightJsonData,
  type JsonDataIssue,
  type JsonDataLimits,
} from "./json-data.js";
import { prepareProtocolSchema } from "./protocol-schema.js";
import { validateProtocolVersion } from "./protocol-version.js";

type JsonRecord = Record<string, unknown>;

interface ParsedTimestamp {
  fraction: string;
  leapSecond: boolean;
  seconds: bigint;
}

const RFC3339_PARTS =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2}):(\d{2}))$/;
const terminalStatuses = new Set<DeclarationStatus>([
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
]);
const amendableStatuses = new Set<DeclarationStatus>([
  "DRAFT",
  "PROPOSED",
  "UNDER_REVIEW",
]);
const DECLARATION_JSON_LIMITS = {
  arrayLengthLimits: [{ path: ["changes"], maxLength: 10_000 }],
  maxBytes: 2 * 1024 * 1024,
  maxDepth: 128,
} as const satisfies JsonDataLimits;

export interface CreateDeclarationInput {
  [extension: string]: unknown;
  protocol_version: SeipDeclaration["protocol_version"];
  declaration_id: SeipDeclaration["declaration_id"];
  producer: SeipDeclaration["producer"];
  changes: SeipDeclaration["changes"];
  intent: SeipDeclaration["intent"];
  consumers: SeipDeclaration["consumers"];
  /** Input-only actor recorded on the CREATED event, not at declaration root. */
  actor: string;
  created_at?: never;
  revision?: never;
  status?: never;
  responses?: never;
  evidence?: never;
  events?: never;
}

export interface CreationContext {
  createdAt: string;
  createdEventId: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  let epochSeconds = BigInt(
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
    const offsetSeconds = BigInt(offsetHour * 3_600 + offsetMinute * 60);
    epochSeconds += sign === "+" ? -offsetSeconds : offsetSeconds;
  }

  return {
    seconds: epochSeconds,
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

  const fractionLength = Math.max(
    leftParsed.fraction.length,
    rightParsed.fraction.length,
  );
  const leftFraction = leftParsed.fraction.padEnd(fractionLength, "0");
  const rightFraction = rightParsed.fraction.padEnd(fractionLength, "0");
  return leftFraction < rightFraction
    ? -1
    : leftFraction > rightFraction
      ? 1
      : 0;
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const leftParts = [
    left.path ?? "",
    left.code,
    left.changeId ?? "",
    left.declarationId ?? "",
    left.message,
    left.hint ?? "",
    left.severity,
  ];
  const rightParts = [
    right.path ?? "",
    right.code,
    right.changeId ?? "",
    right.declarationId ?? "",
    right.message,
    right.hint ?? "",
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

function normalizeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const unique = new Map<string, Diagnostic>();
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify(diagnostic);
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics);
}

function appendChangeDiagnostic(
  declaration: SeipDeclaration,
  index: number,
  path: string,
  diagnostics: Diagnostic[],
): void {
  const change = declaration.changes[index];
  diagnostics.push({
    code: "SEIP_PROTOCOL_CHANGE_INVALID",
    severity: "error",
    message: `Standard change kind "${change?.kind ?? ""}" has invalid snapshot semantics.`,
    path: `/changes/${index}${path}`,
    ...(change === undefined ? {} : { changeId: change.change_id }),
    declarationId: declaration.declaration_id,
  });
}

function isNormalizedType(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  if (!Array.isArray(value) || value.length === 0) return false;

  let previous: string | undefined;
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) return false;
    if (previous !== undefined && previous >= item) return false;
    previous = item;
  }
  return true;
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function isCanonicalValue(value: unknown): boolean {
  const pending: unknown[] = [value];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!isRecord(current) || typeof current.kind !== "string") return false;

    switch (current.kind) {
      case "null":
        if (!hasExactKeys(current, ["kind"])) return false;
        break;
      case "boolean":
        if (
          !hasExactKeys(current, ["kind", "value"]) ||
          typeof current.value !== "boolean"
        ) {
          return false;
        }
        break;
      case "string":
        if (
          !hasExactKeys(current, ["kind", "value"]) ||
          typeof current.value !== "string"
        ) {
          return false;
        }
        break;
      case "number": {
        if (
          !hasExactKeys(current, ["kind", "decimal"]) ||
          typeof current.decimal !== "string"
        ) {
          return false;
        }
        const normalized = normalizeDecimalLexeme(current.decimal);
        if (!normalized.ok || normalized.value !== current.decimal) return false;
        break;
      }
      case "array":
        if (
          !hasExactKeys(current, ["kind", "items"]) ||
          !Array.isArray(current.items)
        ) {
          return false;
        }
        for (const item of current.items) pending.push(item);
        break;
      case "object": {
        if (
          !hasExactKeys(current, ["kind", "entries"]) ||
          !Array.isArray(current.entries)
        ) {
          return false;
        }
        let previousKey: string | undefined;
        for (const entry of current.entries) {
          if (
            !isRecord(entry) ||
            !hasExactKeys(entry, ["key", "value"]) ||
            typeof entry.key !== "string" ||
            (previousKey !== undefined && previousKey >= entry.key)
          ) {
            return false;
          }
          previousKey = entry.key;
          pending.push(entry.value);
        }
        break;
      }
      default:
        return false;
    }
  }

  return true;
}

function appendCanonicalEnumDiagnostics(
  declaration: SeipDeclaration,
  changeIndex: number,
  snapshotName: "before" | "after",
  snapshot: JsonRecord | undefined,
  diagnostics: Diagnostic[],
): void {
  const path = `/${snapshotName}/enum`;
  if (snapshot === undefined || !Array.isArray(snapshot.enum)) {
    appendChangeDiagnostic(declaration, changeIndex, path, diagnostics);
    return;
  }

  const encodings: string[] = [];
  for (let index = 0; index < snapshot.enum.length; index += 1) {
    const item = snapshot.enum[index];
    if (!isCanonicalValue(item)) {
      appendChangeDiagnostic(
        declaration,
        changeIndex,
        `${path}/${index}`,
        diagnostics,
      );
      continue;
    }

    const encoded = canonicalize(item);
    if (!encoded.ok) {
      appendChangeDiagnostic(
        declaration,
        changeIndex,
        `${path}/${index}`,
        diagnostics,
      );
      continue;
    }
    encodings.push(encoded.value);
  }

  if (
    encodings.length === snapshot.enum.length &&
    encodings.some(
      (encoding, index) => index > 0 && (encodings[index - 1] ?? "") >= encoding,
    )
  ) {
    appendChangeDiagnostic(declaration, changeIndex, path, diagnostics);
  }
}

function appendStandardChangeDiagnostics(
  declaration: SeipDeclaration,
  index: number,
  diagnostics: Diagnostic[],
): void {
  const change = declaration.changes[index];
  if (change === undefined) return;
  const before = isRecord(change.before) ? change.before : undefined;
  const after = isRecord(change.after) ? change.after : undefined;

  switch (change.kind) {
    case "object_add":
    case "object_remove":
      if (change.target.path.length !== 0) {
        appendChangeDiagnostic(declaration, index, "/target/path", diagnostics);
      }
      break;
    case "rename": {
      const beforeName = before?.name;
      const afterName = after?.name;
      if (typeof beforeName !== "string") {
        appendChangeDiagnostic(declaration, index, "/before/name", diagnostics);
      }
      if (typeof afterName !== "string") {
        appendChangeDiagnostic(declaration, index, "/after/name", diagnostics);
      } else if (typeof beforeName === "string" && beforeName === afterName) {
        appendChangeDiagnostic(declaration, index, "/after/name", diagnostics);
      }
      break;
    }
    case "retype":
      if (!isNormalizedType(before?.type)) {
        appendChangeDiagnostic(declaration, index, "/before/type", diagnostics);
      }
      if (!isNormalizedType(after?.type)) {
        appendChangeDiagnostic(declaration, index, "/after/type", diagnostics);
      }
      break;
    case "make_required":
    case "make_optional": {
      const beforeRequired = before?.required;
      const afterRequired = after?.required;
      if (typeof beforeRequired !== "boolean") {
        appendChangeDiagnostic(
          declaration,
          index,
          "/before/required",
          diagnostics,
        );
      }
      if (typeof afterRequired !== "boolean") {
        appendChangeDiagnostic(
          declaration,
          index,
          "/after/required",
          diagnostics,
        );
      } else if (
        typeof beforeRequired === "boolean" &&
        beforeRequired === afterRequired
      ) {
        appendChangeDiagnostic(
          declaration,
          index,
          "/after/required",
          diagnostics,
        );
      }
      break;
    }
    case "make_non_nullable":
    case "make_nullable": {
      const beforeNullable = before?.nullable;
      const afterNullable = after?.nullable;
      if (typeof beforeNullable !== "boolean") {
        appendChangeDiagnostic(
          declaration,
          index,
          "/before/nullable",
          diagnostics,
        );
      }
      if (typeof afterNullable !== "boolean") {
        appendChangeDiagnostic(
          declaration,
          index,
          "/after/nullable",
          diagnostics,
        );
      } else if (
        typeof beforeNullable === "boolean" &&
        beforeNullable === afterNullable
      ) {
        appendChangeDiagnostic(
          declaration,
          index,
          "/after/nullable",
          diagnostics,
        );
      }
      break;
    }
    case "enum_narrow":
    case "enum_widen":
      appendCanonicalEnumDiagnostics(
        declaration,
        index,
        "before",
        before,
        diagnostics,
      );
      appendCanonicalEnumDiagnostics(
        declaration,
        index,
        "after",
        after,
        diagnostics,
      );
      break;
    case "format_change": {
      const hasBefore = before !== undefined && Object.hasOwn(before, "format");
      const hasAfter = after !== undefined && Object.hasOwn(after, "format");
      if (!hasBefore) {
        appendChangeDiagnostic(declaration, index, "/before/format", diagnostics);
      }
      if (!hasAfter) {
        appendChangeDiagnostic(declaration, index, "/after/format", diagnostics);
      } else if (hasBefore) {
        const beforeEncoding = canonicalize(before?.format);
        const afterEncoding = canonicalize(after?.format);
        if (
          beforeEncoding.ok &&
          afterEncoding.ok &&
          beforeEncoding.value === afterEncoding.value
        ) {
          appendChangeDiagnostic(
            declaration,
            index,
            "/after/format",
            diagnostics,
          );
        }
      }
      break;
    }
    case "deprecate":
      if (after?.deprecated !== true) {
        appendChangeDiagnostic(
          declaration,
          index,
          "/after/deprecated",
          diagnostics,
        );
      }
      break;
    default:
      // constraint_change has no approved snapshot field identifying its
      // keyword, so requiring an invented field here would reject valid v1
      // extensions. Its structural before/after contract remains enforced.
      break;
  }
}

function appendTimelineDiagnostics(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
): void {
  const timeline = declaration.intent.timeline;
  if (
    timeline.deprecation_at === undefined ||
    timeline.removal_at === undefined
  ) {
    return;
  }

  const message =
    "Timeline dates must satisfy target_enforcement_at <= deprecation_at <= removal_at.";
  if (
    compareTimestamps(
      timeline.target_enforcement_at,
      timeline.deprecation_at,
    ) > 0
  ) {
    diagnostics.push({
      code: "SEIP_PROTOCOL_TIMELINE_INVALID",
      severity: "error",
      message,
      path: "/intent/timeline/deprecation_at",
      declarationId: declaration.declaration_id,
    });
  }
  if (compareTimestamps(timeline.deprecation_at, timeline.removal_at) > 0) {
    diagnostics.push({
      code: "SEIP_PROTOCOL_TIMELINE_INVALID",
      severity: "error",
      message,
      path: "/intent/timeline/removal_at",
      declarationId: declaration.declaration_id,
    });
  }
}

function appendChronologyDiagnostics(
  declaration: SeipDeclaration,
  field: "responses" | "evidence" | "events",
  diagnostics: Diagnostic[],
): void {
  const entries = declaration[field];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      compareTimestamps(previous.at, current.at) > 0
    ) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_CHRONOLOGY_INVALID",
        severity: "error",
        message: `${field} must be append-ordered by timestamp.`,
        path: `/${field}/${index}/at`,
        declarationId: declaration.declaration_id,
      });
    }
  }
}

function appendReferenceDiagnostics(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
): void {
  const consumerTeams = new Set(
    declaration.consumers.map((consumer) => consumer.team),
  );
  const changeIds = new Set(declaration.changes.map((change) => change.change_id));
  const message =
    "Reference must identify a declared consumer, change, or valid declaration revision.";

  declaration.responses.forEach((response, index) => {
    if (!consumerTeams.has(response.team)) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_REFERENCE_INVALID",
        severity: "error",
        message,
        path: `/responses/${index}/team`,
        declarationId: declaration.declaration_id,
      });
    }
    if (response.declaration_revision > declaration.revision) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_REFERENCE_INVALID",
        severity: "error",
        message,
        path: `/responses/${index}/declaration_revision`,
        declarationId: declaration.declaration_id,
      });
    }
  });

  declaration.evidence.forEach((evidence, index) => {
    if (!consumerTeams.has(evidence.team)) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_REFERENCE_INVALID",
        severity: "error",
        message,
        path: `/evidence/${index}/team`,
        declarationId: declaration.declaration_id,
      });
    }
    if (evidence.declaration_revision > declaration.revision) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_REFERENCE_INVALID",
        severity: "error",
        message,
        path: `/evidence/${index}/declaration_revision`,
        declarationId: declaration.declaration_id,
      });
    }
    evidence.change_ids.forEach((changeId, changeIndex) => {
      if (!changeIds.has(changeId)) {
        diagnostics.push({
          code: "SEIP_PROTOCOL_REFERENCE_INVALID",
          severity: "error",
          message,
          path: `/evidence/${index}/change_ids/${changeIndex}`,
          changeId,
          declarationId: declaration.declaration_id,
        });
      }
    });
  });
}

function isAllowedEventTransition(event: LifecycleEvent): boolean {
  const { from_status: from, to_status: to } = event;
  switch (event.type) {
    case "CREATED":
      return from === null && to === "DRAFT";
    case "DECLARATION_UPDATED":
      return from !== null && amendableStatuses.has(from) && to === from;
    case "EVIDENCE_RECORDED":
      return from !== null && to === from;
    case "CONSUMER_RESPONDED":
      if (from === "UNDER_REVIEW") return to === "UNDER_REVIEW";
      if (from !== "PROPOSED") return false;
      // Approved lifecycle semantics make objection/extension responses the
      // sole non-status-event exception to status preservation.
      return event.details.decision === "ACKNOWLEDGED"
        ? to === "PROPOSED"
        : to === "UNDER_REVIEW";
    case "PROPOSED":
      return from === "DRAFT" && to === "PROPOSED";
    case "ACCEPTED":
      return (
        (from === "PROPOSED" || from === "UNDER_REVIEW") && to === "ACCEPTED"
      );
    case "ENFORCING":
      return from === "ACCEPTED" && to === "ENFORCING";
    case "COMPLETED":
      return from === "ENFORCING" && to === "COMPLETED";
    case "WITHDRAWN":
      return (
        (from === "DRAFT" ||
          from === "PROPOSED" ||
          from === "UNDER_REVIEW" ||
          from === "ACCEPTED") &&
        to === "WITHDRAWN"
      );
    case "REJECTED":
      return (
        (from === "PROPOSED" || from === "UNDER_REVIEW") && to === "REJECTED"
      );
  }
}

function appendEventDiagnostic(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
  code:
    | "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION"
    | "SEIP_LIFECYCLE_EVENT_INVALID"
    | "SEIP_LIFECYCLE_INVALID_TRANSITION"
    | "SEIP_LIFECYCLE_REVISION_INVALID"
    | "SEIP_LIFECYCLE_STATUS_MISMATCH",
  path: string,
  message: string,
): void {
  diagnostics.push({
    code,
    severity: "error",
    message,
    path,
    declarationId: declaration.declaration_id,
  });
}

function appendEventReplayDiagnostics(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
): void {
  const { events } = declaration;
  const consumerTeams = new Set(
    declaration.consumers.map((consumer) => consumer.team),
  );
  const responsesById = new Map(
    declaration.responses.map((response, index) => [
      response.response_id,
      { index, response },
    ]),
  );
  const latestResponses = new Map<
    string,
    {
      decision: SeipDeclaration["responses"][number]["decision"];
      index: number;
    }
  >();
  let replayRevision = 1;
  if (events.length === 0) {
    appendEventDiagnostic(
      declaration,
      diagnostics,
      "SEIP_LIFECYCLE_EVENT_INVALID",
      "/events",
      "Event history must begin with exactly one CREATED event.",
    );
  }

  let updateCount = 0;
  events.forEach((current, index) => {
    if (current.type === "DECLARATION_UPDATED") {
      updateCount += 1;
      latestResponses.clear();
    }

    if (index === 0) {
      if (current.type !== "CREATED") {
        appendEventDiagnostic(
          declaration,
          diagnostics,
          "SEIP_LIFECYCLE_EVENT_INVALID",
          "/events/0/type",
          "The first event must be CREATED.",
        );
        return;
      }
      if (current.declaration_revision !== 1) {
        appendEventDiagnostic(
          declaration,
          diagnostics,
          "SEIP_LIFECYCLE_EVENT_INVALID",
          "/events/0/declaration_revision",
          "CREATED must use declaration revision 1.",
        );
      }
      if (current.from_status !== null) {
        appendEventDiagnostic(
          declaration,
          diagnostics,
          "SEIP_LIFECYCLE_EVENT_INVALID",
          "/events/0/from_status",
          "CREATED must start from a null status.",
        );
      }
      if (current.to_status !== "DRAFT") {
        appendEventDiagnostic(
          declaration,
          diagnostics,
          "SEIP_LIFECYCLE_EVENT_INVALID",
          "/events/0/to_status",
          "CREATED must transition to DRAFT.",
        );
      }
      return;
    }

    const previous = events[index - 1];
    if (previous === undefined) return;
    if (current.type === "CREATED") {
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_EVENT_INVALID",
        `/events/${index}/type`,
        "CREATED may appear only once and first.",
      );
    }
    if (current.from_status !== previous.to_status) {
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_EVENT_INVALID",
        `/events/${index}/from_status`,
        "Event from_status must equal the preceding to_status.",
      );
    }
    if (
      previous.to_status !== null &&
      terminalStatuses.has(previous.to_status)
    ) {
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_EVENT_INVALID",
        `/events/${index}/type`,
        "No events may follow a terminal status.",
      );
    }

    const expectedRevision =
      previous.declaration_revision +
      (current.type === "DECLARATION_UPDATED" ? 1 : 0);
    const hasExpectedRevision = current.declaration_revision === expectedRevision;
    if (current.declaration_revision !== expectedRevision) {
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_REVISION_INVALID",
        `/events/${index}/declaration_revision`,
        "Only DECLARATION_UPDATED may increment revision, exactly by one.",
      );
    }

    if (current.type === "DECLARATION_UPDATED" && hasExpectedRevision) {
      replayRevision = current.declaration_revision;
    } else if (current.type === "CONSUMER_RESPONDED") {
      const responseEntry = responsesById.get(current.details.response_id);
      const response = responseEntry?.response;
      if (
        response !== undefined &&
        responseEntry !== undefined &&
        current.declaration_revision === replayRevision &&
        response.declaration_revision === current.declaration_revision &&
        response.team === current.details.team &&
        response.decision === current.details.decision &&
        consumerTeams.has(response.team)
      ) {
        const latest = latestResponses.get(response.team);
        if (latest === undefined || responseEntry.index > latest.index) {
          latestResponses.set(response.team, {
            decision: response.decision,
            index: responseEntry.index,
          });
        }
      }
    } else if (
      current.type === "ACCEPTED" &&
      declaration.consumers.some(
        (consumer) =>
          latestResponses.get(consumer.team)?.decision !== "ACKNOWLEDGED",
      )
    ) {
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION",
        `/events/${index}/type`,
        "ACCEPTED requires every declared consumer's latest current-revision response to be ACKNOWLEDGED.",
      );
    }

    if (current.type !== "CREATED" && !isAllowedEventTransition(current)) {
      const statusPreserving =
        current.type === "DECLARATION_UPDATED" ||
        current.type === "CONSUMER_RESPONDED" ||
        current.type === "EVIDENCE_RECORDED";
      appendEventDiagnostic(
        declaration,
        diagnostics,
        "SEIP_LIFECYCLE_INVALID_TRANSITION",
        `/events/${index}/${statusPreserving ? "to_status" : "type"}`,
        "Event transition is not allowed by the v1 lifecycle.",
      );
    }
  });

  const expectedCurrentRevision = 1 + updateCount;
  if (declaration.revision !== expectedCurrentRevision) {
    appendEventDiagnostic(
      declaration,
      diagnostics,
      "SEIP_LIFECYCLE_REVISION_INVALID",
      "/revision",
      "Current revision must equal one plus the update-event count.",
    );
  }

  const latest = events.at(-1);
  if (latest !== undefined && latest.to_status !== declaration.status) {
    appendEventDiagnostic(
      declaration,
      diagnostics,
      "SEIP_LIFECYCLE_STATUS_MISMATCH",
      "/status",
      "Current status must equal the latest event status.",
    );
  }
}

interface RecordingEvent {
  event: LifecycleEvent;
  index: number;
}

function appendLinkDiagnostic(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
  path: string,
): void {
  diagnostics.push({
    code: "SEIP_PROTOCOL_EVENT_LINK_INVALID",
    severity: "error",
    message:
      "Each response and evidence entry must have exactly one matching recording event.",
    path,
    declarationId: declaration.declaration_id,
  });
}

function appendRecordingLinkDiagnostics(
  declaration: SeipDeclaration,
  diagnostics: Diagnostic[],
): void {
  const responses = new Map(
    declaration.responses.map((response, index) => [
      response.response_id,
      { response, index },
    ]),
  );
  const evidence = new Map(
    declaration.evidence.map((entry, index) => [
      entry.evidence_id,
      { evidence: entry, index },
    ]),
  );
  const responseEvents = new Map<string, RecordingEvent[]>();
  const evidenceEvents = new Map<string, RecordingEvent[]>();

  declaration.events.forEach((event, index) => {
    if (event.type === "CONSUMER_RESPONDED") {
      const id = event.details.response_id;
      const matches = responseEvents.get(id) ?? [];
      matches.push({ event, index });
      responseEvents.set(id, matches);
      if (!responses.has(id)) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${index}/details/response_id`,
        );
      }
    } else if (event.type === "EVIDENCE_RECORDED") {
      const id = event.details.evidence_id;
      const matches = evidenceEvents.get(id) ?? [];
      matches.push({ event, index });
      evidenceEvents.set(id, matches);
      if (!evidence.has(id)) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${index}/details/evidence_id`,
        );
      }
    }
  });

  for (const [id, entry] of responses) {
    const matches = responseEvents.get(id) ?? [];
    if (matches.length === 0) {
      appendLinkDiagnostic(
        declaration,
        diagnostics,
        `/responses/${entry.index}/response_id`,
      );
      continue;
    }
    matches.slice(1).forEach((match) => {
      appendLinkDiagnostic(
        declaration,
        diagnostics,
        `/events/${match.index}/details/response_id`,
      );
    });
    for (const match of matches) {
      if (match.event.type !== "CONSUMER_RESPONDED") continue;
      if (
        match.event.declaration_revision !== entry.response.declaration_revision
      ) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/declaration_revision`,
        );
      }
      if (match.event.details.team !== entry.response.team) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/details/team`,
        );
      }
      if (match.event.details.decision !== entry.response.decision) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/details/decision`,
        );
      }
    }
  }

  for (const [id, entry] of evidence) {
    const matches = evidenceEvents.get(id) ?? [];
    if (matches.length === 0) {
      appendLinkDiagnostic(
        declaration,
        diagnostics,
        `/evidence/${entry.index}/evidence_id`,
      );
      continue;
    }
    matches.slice(1).forEach((match) => {
      appendLinkDiagnostic(
        declaration,
        diagnostics,
        `/events/${match.index}/details/evidence_id`,
      );
    });
    for (const match of matches) {
      if (match.event.type !== "EVIDENCE_RECORDED") continue;
      if (
        match.event.declaration_revision !== entry.evidence.declaration_revision
      ) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/declaration_revision`,
        );
      }
      if (match.event.details.team !== entry.evidence.team) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/details/team`,
        );
      }
      if (match.event.details.result !== entry.evidence.result) {
        appendLinkDiagnostic(
          declaration,
          diagnostics,
          `/events/${match.index}/details/result`,
        );
      }
    }
  }
}

export function validateDeclaration(value: unknown): Result<SeipDeclaration> {
  const prepared = prepareProtocolSchema(value, {
    limits: DECLARATION_JSON_LIMITS,
  });
  if (!prepared.ok) {
    return { ok: false, diagnostics: prepared.diagnostics };
  }

  // Semantic reads operate on the sanitized clone so inherited accessors on
  // otherwise ordinary input objects can never execute after schema preflight.
  const declaration = prepared.value as SeipDeclaration;
  const diagnostics: Diagnostic[] = [];

  const versionResult = validateProtocolVersion(declaration.protocol_version);
  if (!versionResult.ok) diagnostics.push(...versionResult.diagnostics);

  declaration.changes.forEach((change, index) => {
    const computed = computeChangeId(change);
    if (!computed.ok) {
      diagnostics.push(
        ...computed.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          path: `/changes/${index}`,
          declarationId: declaration.declaration_id,
        })),
      );
      return;
    }
    if (computed.value !== change.change_id) {
      diagnostics.push({
        code: "SEIP_PROTOCOL_CHANGE_ID_MISMATCH",
        severity: "error",
        message: "The supplied change_id does not match the normalized change.",
        path: `/changes/${index}/change_id`,
        changeId: change.change_id,
        declarationId: declaration.declaration_id,
      });
    }
    appendStandardChangeDiagnostics(declaration, index, diagnostics);
  });
  appendTimelineDiagnostics(declaration, diagnostics);
  appendReferenceDiagnostics(declaration, diagnostics);
  appendChronologyDiagnostics(declaration, "responses", diagnostics);
  appendChronologyDiagnostics(declaration, "evidence", diagnostics);
  appendChronologyDiagnostics(declaration, "events", diagnostics);
  appendEventReplayDiagnostics(declaration, diagnostics);
  appendRecordingLinkDiagnostics(declaration, diagnostics);

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: normalizeDiagnostics(diagnostics) };
  }

  return {
    ok: true,
    value: declaration,
    diagnostics: [],
  };
}

function invalidCreationData(
  message: string,
  issue?: JsonDataIssue,
  pathPrefix = "",
): Result<never> {
  const resourceLimited = issue !== undefined && "kind" in issue;
  const issuePath = issue?.path;
  const path =
    issuePath === undefined
      ? pathPrefix || undefined
      : `${pathPrefix}${issuePath}`;
  return {
    ok: false,
    diagnostics: [
      {
        code: resourceLimited
          ? "SEIP_PROTOCOL_RESOURCE_LIMIT"
          : "SEIP_PROTOCOL_SCHEMA_INVALID",
        severity: "error",
        message: resourceLimited
          ? "Declaration exceeds configured protocol resource limits."
          : message,
        ...(path === undefined ? {} : { path }),
      },
    ],
  };
}

export function createDeclaration(
  input: CreateDeclarationInput,
  context: CreationContext,
): Result<SeipDeclaration> {
  const inputPreflight = preflightJsonData(input, DECLARATION_JSON_LIMITS);
  if (!inputPreflight.ok) {
    return invalidCreationData(inputPreflight.issue.message, inputPreflight.issue);
  }
  const contextPreflight = preflightJsonData(context, DECLARATION_JSON_LIMITS);
  if (!contextPreflight.ok) {
    return invalidCreationData(
      contextPreflight.issue.message,
      contextPreflight.issue,
      "/context",
    );
  }
  if (!isRecord(inputPreflight.value)) {
    return invalidCreationData("Creation input must be a JSON object.");
  }
  if (!isRecord(contextPreflight.value)) {
    return invalidCreationData(
      "Creation context must be a JSON object.",
      undefined,
      "/context",
    );
  }

  const source = inputPreflight.value;
  const effects = contextPreflight.value;

  const extensions = { ...source };
  for (const managedOrKnownField of [
    "protocol_version",
    "declaration_id",
    "producer",
    "changes",
    "intent",
    "consumers",
    "actor",
    "created_at",
    "revision",
    "status",
    "responses",
    "evidence",
    "events",
  ]) {
    delete extensions[managedOrKnownField];
  }

  const sorted = sortChanges(source.changes);
  const declaration = {
    ...extensions,
    protocol_version: source.protocol_version,
    declaration_id: source.declaration_id,
    created_at: effects.createdAt,
    revision: 1,
    status: "DRAFT",
    producer: source.producer,
    changes: sorted.ok ? sorted.value : source.changes,
    intent: source.intent,
    consumers: source.consumers,
    responses: [],
    evidence: [],
    events: [
      {
        event_id: effects.createdEventId,
        type: "CREATED",
        declaration_revision: 1,
        at: effects.createdAt,
        actor: source.actor,
        from_status: null,
        to_status: "DRAFT",
        details: {},
      },
    ],
  } as unknown as SeipDeclaration;

  const validated = validateDeclaration(declaration);
  if (!validated.ok) return validated;
  if (!sorted.ok) return sorted;
  return validated;
}
