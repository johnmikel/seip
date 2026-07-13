import { createHash } from "node:crypto";

import type {
  Consumer,
  ConsumerResponseDecision,
  DeclarationStatus,
  LifecycleEvent,
  SeipDeclaration,
} from "../generated/protocol-types.js";
import { canonicalize } from "./canonicalize.js";
import { validateDeclaration } from "./declaration.js";
import { failure, type Result } from "./diagnostics.js";
import {
  preflightJsonData,
  type JsonDataIssue,
  type JsonDataLimits,
} from "./json-data.js";
import { validateAmendmentSchema } from "./protocol-schema.js";

type JsonRecord = Record<string, unknown>;

export interface TransitionContext {
  actor: string;
  at: string;
  eventId: string;
}

export interface ConsumerUpdate {
  team: string;
  contact?: string;
  dependencies?: string[];
}

export interface AmendmentPatch {
  intent?: JsonRecord;
  consumers?: {
    add?: Consumer[];
    update?: ConsumerUpdate[];
  };
}

interface PreparedTransition {
  declaration: SeipDeclaration;
  effects: TransitionContext;
}

interface MergeResult {
  changedPaths: string[];
  value: JsonRecord;
}

const amendableStatuses = new Set<DeclarationStatus>([
  "DRAFT",
  "PROPOSED",
  "UNDER_REVIEW",
]);
const responseStatuses = new Set<DeclarationStatus>([
  "PROPOSED",
  "UNDER_REVIEW",
]);
const withdrawableStatuses = new Set<DeclarationStatus>([
  "DRAFT",
  "PROPOSED",
  "UNDER_REVIEW",
  "ACCEPTED",
]);
const rejectableStatuses = new Set<DeclarationStatus>([
  "PROPOSED",
  "UNDER_REVIEW",
]);
const lifecycleInputLimits = {
  maxBytes: 2 * 1024 * 1024,
  maxContainers: 100_000,
  maxDepth: 128,
} as const satisfies JsonDataLimits;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createRecord(): JsonRecord {
  return Object.create(null) as JsonRecord;
}

function setOwn(record: JsonRecord, key: string, value: unknown): void {
  const defined = Reflect.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) throw new Error("could not define lifecycle record property");
}

function copyRecord(source: JsonRecord): JsonRecord {
  const copy = createRecord();
  for (const key of Object.keys(source)) setOwn(copy, key, source[key]);
  return copy;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function appendPointer(path: string, token: string): string {
  return `${path}/${escapePointerToken(token)}`;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => jsonEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;

  const leftKeys = Object.keys(left).sort(compareCodeUnits);
  const rightKeys = Object.keys(right).sort(compareCodeUnits);
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey === undefined || leftKey !== rightKey) return false;
    if (!jsonEqual(left[leftKey], right[rightKey])) return false;
  }
  return true;
}

function mergeObjectPatch(
  target: unknown,
  patch: JsonRecord,
  path: string,
): MergeResult {
  const targetWasRecord = isRecord(target);
  const output = targetWasRecord ? copyRecord(target) : createRecord();
  const changedPaths: string[] = [];

  for (const key of Object.keys(patch).sort(compareCodeUnits)) {
    const childPath = appendPointer(path, key);
    const patchValue = patch[key];
    const hadTargetValue = Object.hasOwn(output, key);
    const targetValue = hadTargetValue ? output[key] : undefined;

    if (patchValue === null) {
      if (hadTargetValue) {
        Reflect.deleteProperty(output, key);
        changedPaths.push(childPath);
      }
      continue;
    }

    if (isRecord(patchValue)) {
      const merged = mergeObjectPatch(targetValue, patchValue, childPath);
      setOwn(output, key, merged.value);
      if (!isRecord(targetValue)) {
        changedPaths.push(childPath);
      } else {
        changedPaths.push(...merged.changedPaths);
      }
      continue;
    }

    if (!hadTargetValue || !jsonEqual(targetValue, patchValue)) {
      setOwn(output, key, patchValue);
      changedPaths.push(childPath);
    }
  }

  return {
    changedPaths:
      !targetWasRecord && !jsonEqual(target, output) ? [path] : changedPaths,
    value: output,
  };
}

function lifecycleFailure(
  code: string,
  message: string,
  declaration?: SeipDeclaration,
  path?: string,
): Result<never> {
  return failure(code, message, {
    ...(declaration === undefined
      ? {}
      : { declarationId: declaration.declaration_id }),
    ...(path === undefined ? {} : { path }),
  });
}

function invalidTransition(declaration: SeipDeclaration): Result<never> {
  return lifecycleFailure(
    "SEIP_LIFECYCLE_INVALID_TRANSITION",
    "The requested operation is not allowed from the current lifecycle state.",
    declaration,
    "/status",
  );
}

function preflightFailure(
  code: string,
  label: string,
  issue?: JsonDataIssue,
): Result<never> {
  const issuePath = issue?.path;
  return lifecycleFailure(
    code,
    issue?.message ?? `${label} must be a JSON object.`,
    undefined,
    issuePath === undefined ? `/${label}` : `/${label}${issuePath}`,
  );
}

function prepareDeclaration(
  value: unknown,
  allowedStatuses: ReadonlySet<DeclarationStatus>,
): Result<SeipDeclaration> {
  const validated = validateDeclaration(value);
  if (!validated.ok) return validated;
  return allowedStatuses.has(validated.value.status)
    ? validated
    : invalidTransition(validated.value);
}

function prepareContext(context: unknown): Result<TransitionContext> {
  const prepared = preflightJsonData(context, lifecycleInputLimits);
  if (!prepared.ok) {
    return preflightFailure(
      "SEIP_LIFECYCLE_CONTEXT_INVALID",
      "context",
      prepared.issue,
    );
  }
  if (!isRecord(prepared.value)) {
    return preflightFailure("SEIP_LIFECYCLE_CONTEXT_INVALID", "context");
  }
  return {
    ok: true,
    value: prepared.value as unknown as TransitionContext,
    diagnostics: [],
  };
}

function prepareTransition(
  value: unknown,
  allowedStatuses: ReadonlySet<DeclarationStatus>,
  context: unknown,
): Result<PreparedTransition> {
  const declaration = prepareDeclaration(value, allowedStatuses);
  if (!declaration.ok) return declaration;
  const effects = prepareContext(context);
  if (!effects.ok) return effects;
  return {
    ok: true,
    value: { declaration: declaration.value, effects: effects.value },
    diagnostics: [],
  };
}

function appendEvent(
  declaration: SeipDeclaration,
  effects: TransitionContext,
  type: LifecycleEvent["type"],
  toStatus: DeclarationStatus,
  details: JsonRecord,
  revision = declaration.revision,
): void {
  declaration.events.push({
    event_id: effects.eventId,
    type,
    declaration_revision: revision,
    at: effects.at,
    actor: effects.actor,
    from_status: declaration.status,
    to_status: toStatus,
    details,
  } as LifecycleEvent);
  declaration.status = toStatus;
}

function runStatusTransition(
  value: unknown,
  context: unknown,
  allowedStatuses: ReadonlySet<DeclarationStatus>,
  type: LifecycleEvent["type"],
  toStatus: DeclarationStatus,
  details: JsonRecord = createRecord(),
): Result<SeipDeclaration> {
  const prepared = prepareTransition(value, allowedStatuses, context);
  if (!prepared.ok) return prepared;
  const { declaration, effects } = prepared.value;
  appendEvent(declaration, effects, type, toStatus, details);
  return validateDeclaration(declaration);
}

export function proposeDeclaration(
  value: unknown,
  context: TransitionContext,
): Result<SeipDeclaration> {
  return runStatusTransition(
    value,
    context,
    new Set<DeclarationStatus>(["DRAFT"]),
    "PROPOSED",
    "PROPOSED",
  );
}

export function recordConsumerResponse(
  value: unknown,
  responseId: string,
  declarationRevision: number,
  team: string,
  decision: ConsumerResponseDecision,
  message: string,
  context: TransitionContext,
): Result<SeipDeclaration> {
  const prepared = prepareTransition(value, responseStatuses, context);
  if (!prepared.ok) return prepared;
  const { declaration, effects } = prepared.value;
  declaration.responses.push({
    response_id: responseId,
    declaration_revision: declarationRevision,
    team,
    decision,
    message,
    actor: effects.actor,
    at: effects.at,
  });
  const toStatus =
    declaration.status === "PROPOSED" && decision !== "ACKNOWLEDGED"
      ? "UNDER_REVIEW"
      : declaration.status;
  const details = createRecord();
  setOwn(details, "response_id", responseId);
  setOwn(details, "team", team);
  setOwn(details, "decision", decision);
  appendEvent(
    declaration,
    effects,
    "CONSUMER_RESPONDED",
    toStatus,
    details,
    declarationRevision,
  );
  return validateDeclaration(declaration);
}

export function acceptDeclaration(
  value: unknown,
  context: TransitionContext,
): Result<SeipDeclaration> {
  return runStatusTransition(
    value,
    context,
    responseStatuses,
    "ACCEPTED",
    "ACCEPTED",
  );
}

export function startEnforcement(
  value: unknown,
  context: TransitionContext,
): Result<SeipDeclaration> {
  return runStatusTransition(
    value,
    context,
    new Set<DeclarationStatus>(["ACCEPTED"]),
    "ENFORCING",
    "ENFORCING",
  );
}

export function completeDeclaration(
  value: unknown,
  context: TransitionContext,
): Result<SeipDeclaration> {
  return runStatusTransition(
    value,
    context,
    new Set<DeclarationStatus>(["ENFORCING"]),
    "COMPLETED",
    "COMPLETED",
  );
}

export function withdrawDeclaration(
  value: unknown,
  reason: string,
  context: TransitionContext,
): Result<SeipDeclaration> {
  const details = createRecord();
  setOwn(details, "reason", reason);
  return runStatusTransition(
    value,
    context,
    withdrawableStatuses,
    "WITHDRAWN",
    "WITHDRAWN",
    details,
  );
}

export function rejectDeclaration(
  value: unknown,
  reason: string,
  context: TransitionContext,
): Result<SeipDeclaration> {
  const details = createRecord();
  setOwn(details, "reason", reason);
  return runStatusTransition(
    value,
    context,
    rejectableStatuses,
    "REJECTED",
    "REJECTED",
    details,
  );
}

function amendmentFailure(
  declaration: SeipDeclaration,
  message: string,
  path?: string,
): Result<never> {
  return lifecycleFailure(
    "SEIP_LIFECYCLE_AMENDMENT_INVALID",
    message,
    declaration,
    path,
  );
}

function prepareAmendmentPatch(
  declaration: SeipDeclaration,
  patch: unknown,
): Result<AmendmentPatch> {
  const prepared = preflightJsonData(patch, lifecycleInputLimits);
  if (!prepared.ok || !isRecord(prepared.value)) {
    return amendmentFailure(
      declaration,
      prepared.ok ? "Amendment patch must be a JSON object." : prepared.issue.message,
      prepared.ok || prepared.issue.path === undefined
        ? "/patch"
        : `/patch${prepared.issue.path}`,
    );
  }
  const schema = validateAmendmentSchema(prepared.value);
  if (!schema.ok) {
    return {
      ok: false,
      diagnostics: schema.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        ...(diagnostic.path === undefined
          ? { path: "/patch" }
          : { path: `/patch${diagnostic.path}` }),
        declarationId: declaration.declaration_id,
      })),
    };
  }
  return {
    ok: true,
    value: prepared.value as unknown as AmendmentPatch,
    diagnostics: [],
  };
}

function mutableDigest(declaration: SeipDeclaration): Result<string> {
  const consumers = [...declaration.consumers].sort((left, right) =>
    compareCodeUnits(left.team, right.team),
  );
  const serialized = canonicalize({ intent: declaration.intent, consumers });
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    value: createHash("sha256")
      .update(serialized.value, "utf8")
      .digest("hex"),
    diagnostics: [],
  };
}

function applyConsumerOperations(
  declaration: SeipDeclaration,
  operations: AmendmentPatch["consumers"],
): Result<string[]> {
  if (operations === undefined) {
    return { ok: true, value: [], diagnostics: [] };
  }

  const indexes = new Map(
    declaration.consumers.map((consumer, index) => [consumer.team, index]),
  );
  const changedPaths: string[] = [];

  for (const update of operations.update ?? []) {
    const index = indexes.get(update.team);
    if (index === undefined) {
      return amendmentFailure(
        declaration,
        `Consumer update requires an existing team: ${update.team}.`,
        "/patch/consumers/update",
      );
    }
    const current = declaration.consumers[index];
    if (current === undefined) continue;
    const updated = copyRecord(current as JsonRecord) as Consumer;
    for (const field of ["contact", "dependencies"] as const) {
      if (!Object.hasOwn(update, field)) continue;
      if (!jsonEqual(current[field], update[field])) {
        setOwn(updated as JsonRecord, field, update[field]);
        changedPaths.push(
          `/consumers/by-team/${escapePointerToken(update.team)}/${field}`,
        );
      }
    }
    declaration.consumers[index] = updated;
  }

  const additions = [...(operations.add ?? [])].sort((left, right) =>
    compareCodeUnits(left.team, right.team),
  );
  for (const consumer of additions) {
    if (indexes.has(consumer.team)) {
      return amendmentFailure(
        declaration,
        `Consumer add requires a new team: ${consumer.team}.`,
        "/patch/consumers/add",
      );
    }
    indexes.set(consumer.team, declaration.consumers.length);
    declaration.consumers.push(consumer);
    changedPaths.push(
      `/consumers/by-team/${escapePointerToken(consumer.team)}`,
    );
  }

  return { ok: true, value: changedPaths, diagnostics: [] };
}

export function amendDeclaration(
  value: unknown,
  patch: AmendmentPatch,
  reason: string,
  context: TransitionContext,
): Result<SeipDeclaration> {
  const preparedDeclaration = prepareDeclaration(value, amendableStatuses);
  if (!preparedDeclaration.ok) return preparedDeclaration;
  const declaration = preparedDeclaration.value;

  const preparedPatch = prepareAmendmentPatch(declaration, patch);
  if (!preparedPatch.ok) return preparedPatch;
  const effects = prepareContext(context);
  if (!effects.ok) return effects;

  const beforeDigest = mutableDigest(declaration);
  if (!beforeDigest.ok) {
    return amendmentFailure(
      declaration,
      "Mutable declaration sections could not be canonicalized.",
    );
  }

  const changedPaths: string[] = [];
  const sanitizedPatch = preparedPatch.value;
  if (sanitizedPatch.intent !== undefined) {
    const merged = mergeObjectPatch(
      declaration.intent,
      sanitizedPatch.intent,
      "/intent",
    );
    declaration.intent = merged.value as SeipDeclaration["intent"];
    changedPaths.push(...merged.changedPaths);
  }

  const consumerResult = applyConsumerOperations(
    declaration,
    sanitizedPatch.consumers,
  );
  if (!consumerResult.ok) return consumerResult;
  changedPaths.push(...consumerResult.value);

  const sortedPaths = [...new Set(changedPaths)].sort(compareCodeUnits);
  if (sortedPaths.length === 0) {
    return amendmentFailure(
      declaration,
      "Amendment patch must make at least one material change.",
      "/patch",
    );
  }

  const afterDigest = mutableDigest(declaration);
  if (!afterDigest.ok) {
    return amendmentFailure(
      declaration,
      "Mutable declaration sections could not be canonicalized.",
    );
  }

  declaration.revision += 1;
  const details = createRecord();
  setOwn(details, "reason", reason);
  setOwn(details, "changed_paths", sortedPaths);
  setOwn(details, "before_digest", beforeDigest.value);
  setOwn(details, "after_digest", afterDigest.value);
  appendEvent(
    declaration,
    effects.value,
    "DECLARATION_UPDATED",
    declaration.status,
    details,
    declaration.revision,
  );
  return validateDeclaration(declaration);
}
