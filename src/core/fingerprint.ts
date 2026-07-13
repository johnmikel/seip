import { createHash } from "node:crypto";

import type { CanonicalValue } from "./canonical-value.js";
import { normalizeDecimalLexeme } from "./canonical-value.js";
import { canonicalize } from "./canonicalize.js";
import { failure, type Result } from "./diagnostics.js";
import { preflightJsonData } from "./json-data.js";

export type PathSegment =
  | { type: "property"; name: string }
  | { type: "items" }
  | { type: "tuple_item"; index: number };

export type NormalizedSnapshotValue =
  | null
  | boolean
  | string
  | CanonicalValue
  | NormalizedSnapshotValue[]
  | { [key: string]: NormalizedSnapshotValue };

export interface NormalizedChange {
  change_id: string;
  fingerprint_version: "1";
  schema_kind: string;
  target: { object: string; path: PathSegment[] };
  kind: string;
  compatibility: "compatible" | "breaking" | "unknown";
  before?: NormalizedSnapshotValue;
  after?: NormalizedSnapshotValue;
  [extension: string]: unknown;
}

type JsonRecord = Record<string, unknown>;

interface ValidatedChange {
  record: JsonRecord;
  schemaKind: string;
  objectName: string;
  path: PathSegment[];
  kind: string;
  before?: NormalizedSnapshotValue;
  after?: NormalizedSnapshotValue;
}

interface SortableChange {
  original: unknown;
  sortKey: [string, string, string, string, string];
}

type OutputContainer = JsonRecord | unknown[];
type NormalizationMode = "snapshot" | "canonical";

interface OutputSlot {
  target: OutputContainer;
  key: string | number;
}

interface NormalizationFrame {
  mode: NormalizationMode;
  value: unknown;
  slot: OutputSlot;
}

const addKinds = new Set(["add", "object_add"]);
const removeKinds = new Set(["remove", "object_remove"]);
const beforeAndAfterKinds = new Set([
  "rename",
  "retype",
  "make_required",
  "make_optional",
  "make_non_nullable",
  "make_nullable",
  "enum_narrow",
  "enum_widen",
  "format_change",
  "constraint_change",
  "deprecate",
]);
const standardKinds = new Set([
  ...addKinds,
  ...removeKinds,
  ...beforeAndAfterKinds,
  "unknown",
]);
const canonicalKinds = new Set([
  "null",
  "boolean",
  "string",
  "number",
  "array",
  "object",
]);
const changeIdPattern = /^chg_sha256_[0-9a-f]{64}$/;
const namespacedKindPattern = /^[^:]+:.+$/;

function invalidChange(): Result<never> {
  return failure(
    "SEIP_PROTOCOL_CHANGE_INVALID",
    "Value must be a valid normalized change.",
  );
}

function invalidChangeArray(): Result<never> {
  return failure(
    "SEIP_PROTOCOL_CHANGE_INVALID",
    "Value must be an array of valid normalized changes.",
  );
}

function changeIdMismatch(changeId: string): Result<never> {
  return failure(
    "SEIP_PROTOCOL_CHANGE_ID_MISMATCH",
    "The supplied change_id does not match the normalized change.",
    { changeId },
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.hasOwn(record, key);
}

function hasExactKeys(record: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record);
  return (
    actual.length === keys.length && keys.every((key) => hasOwn(record, key))
  );
}

function isNamespacedKind(kind: string): boolean {
  return namespacedKindPattern.test(kind);
}

function createRecord(): JsonRecord {
  return Object.create(null) as JsonRecord;
}

function setOutput(slot: OutputSlot, value: unknown): void {
  if (Array.isArray(slot.target)) {
    slot.target[slot.key as number] = value;
    return;
  }
  slot.target[slot.key as string] = value;
}

function pushChildren(
  pending: NormalizationFrame[],
  source: JsonRecord | unknown[],
  target: OutputContainer,
  mode: NormalizationMode,
): void {
  if (Array.isArray(source)) {
    for (let index = source.length - 1; index >= 0; index -= 1) {
      pending.push({
        mode,
        value: source[index],
        slot: { target, key: index },
      });
    }
    return;
  }

  const keys = Object.keys(source);
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const key = keys[index];
    if (key === undefined) continue;
    pending.push({ mode, value: source[key], slot: { target, key } });
  }
}

function normalizeSnapshotValue(
  value: unknown,
): NormalizedSnapshotValue | undefined {
  const holder = createRecord();
  const pending: NormalizationFrame[] = [
    {
      mode: "snapshot",
      value,
      slot: { target: holder, key: "value" },
    },
  ];
  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) break;
    const current = frame.value;

    if (frame.mode === "snapshot") {
      if (
        current === null ||
        typeof current === "boolean" ||
        typeof current === "string"
      ) {
        setOutput(frame.slot, current);
        continue;
      }
      if (typeof current !== "object") return undefined;

      if (Array.isArray(current)) {
        const arrayOutput = new Array<unknown>(current.length);
        setOutput(frame.slot, arrayOutput);
        pushChildren(pending, current, arrayOutput, "snapshot");
        continue;
      }
      if (!isRecord(current)) return undefined;
      if (
        hasOwn(current, "kind") &&
        typeof current.kind === "string" &&
        canonicalKinds.has(current.kind)
      ) {
        pending.push({ ...frame, mode: "canonical" });
        continue;
      }

      const recordOutput = createRecord();
      setOutput(frame.slot, recordOutput);
      pushChildren(pending, current, recordOutput, "snapshot");
      continue;
    }

    if (!isRecord(current) || typeof current.kind !== "string") {
      return undefined;
    }
    const canonicalOutput = createRecord();
    canonicalOutput.kind = current.kind;
    switch (current.kind) {
      case "null":
        if (!hasExactKeys(current, ["kind"])) return undefined;
        setOutput(frame.slot, canonicalOutput);
        break;
      case "boolean":
        if (
          !hasExactKeys(current, ["kind", "value"]) ||
          typeof current.value !== "boolean"
        ) {
          return undefined;
        }
        canonicalOutput.value = current.value;
        setOutput(frame.slot, canonicalOutput);
        break;
      case "string":
        if (
          !hasExactKeys(current, ["kind", "value"]) ||
          typeof current.value !== "string"
        ) {
          return undefined;
        }
        canonicalOutput.value = current.value;
        setOutput(frame.slot, canonicalOutput);
        break;
      case "number": {
        if (
          !hasExactKeys(current, ["kind", "decimal"]) ||
          typeof current.decimal !== "string"
        ) {
          return undefined;
        }
        const normalized = normalizeDecimalLexeme(current.decimal);
        if (!normalized.ok || normalized.value !== current.decimal) {
          return undefined;
        }
        canonicalOutput.decimal = current.decimal;
        setOutput(frame.slot, canonicalOutput);
        break;
      }
      case "array": {
        if (
          !hasExactKeys(current, ["kind", "items"]) ||
          !Array.isArray(current.items)
        ) {
          return undefined;
        }
        const items = new Array<unknown>(current.items.length);
        canonicalOutput.items = items;
        setOutput(frame.slot, canonicalOutput);
        pushChildren(pending, current.items, items, "canonical");
        break;
      }
      case "object": {
        if (
          !hasExactKeys(current, ["kind", "entries"]) ||
          !Array.isArray(current.entries)
        ) {
          return undefined;
        }
        const entries: Array<JsonRecord & { key: string }> = [];
        for (const entry of current.entries) {
          if (
            !isRecord(entry) ||
            !hasExactKeys(entry, ["key", "value"]) ||
            typeof entry.key !== "string"
          ) {
            return undefined;
          }
          entries.push(entry as JsonRecord & { key: string });
        }
        entries.sort((left, right) =>
          left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
        );
        for (let index = 1; index < entries.length; index += 1) {
          if (entries[index - 1]?.key === entries[index]?.key) return undefined;
        }

        const entryOutputs = new Array<unknown>(entries.length);
        canonicalOutput.entries = entryOutputs;
        setOutput(frame.slot, canonicalOutput);
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const entry = entries[index];
          if (entry === undefined) continue;
          const entryOutput = createRecord();
          entryOutput.key = entry.key;
          entryOutputs[index] = entryOutput;
          pending.push({
            mode: "canonical",
            value: entry.value,
            slot: { target: entryOutput, key: "value" },
          });
        }
        break;
      }
      default:
        return undefined;
    }
  }

  return holder.value as NormalizedSnapshotValue;
}

function validatePath(value: unknown): PathSegment[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const path: PathSegment[] = [];
  for (const segment of value) {
    if (!isRecord(segment) || typeof segment.type !== "string") {
      return undefined;
    }

    if (segment.type === "items") {
      if (!hasExactKeys(segment, ["type"])) return undefined;
      path.push({ type: "items" });
      continue;
    }
    if (segment.type === "property") {
      if (
        !hasExactKeys(segment, ["type", "name"]) ||
        typeof segment.name !== "string"
      ) {
        return undefined;
      }
      path.push({ type: "property", name: segment.name });
      continue;
    }
    if (segment.type === "tuple_item") {
      if (
        !hasExactKeys(segment, ["type", "index"]) ||
        typeof segment.index !== "number" ||
        !Number.isSafeInteger(segment.index) ||
        segment.index < 0
      ) {
        return undefined;
      }
      path.push({ type: "tuple_item", index: segment.index });
      continue;
    }
    return undefined;
  }

  return path;
}

function validateChange(value: unknown): ValidatedChange | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.fingerprint_version !== "1" ||
    typeof value.schema_kind !== "string" ||
    value.schema_kind.length === 0 ||
    typeof value.kind !== "string" ||
    value.kind.length === 0 ||
    (!standardKinds.has(value.kind) && !isNamespacedKind(value.kind)) ||
    (value.compatibility !== "compatible" &&
      value.compatibility !== "breaking" &&
      value.compatibility !== "unknown") ||
    !isRecord(value.target) ||
    typeof value.target.object !== "string" ||
    value.target.object.length === 0
  ) {
    return undefined;
  }

  const path = validatePath(value.target.path);
  if (path === undefined) return undefined;

  const hasBefore = hasOwn(value, "before");
  const hasAfter = hasOwn(value, "after");
  let before: NormalizedSnapshotValue | undefined;
  let after: NormalizedSnapshotValue | undefined;
  if (hasBefore) {
    before = normalizeSnapshotValue(value.before);
    if (before === undefined) return undefined;
  }
  if (hasAfter) {
    after = normalizeSnapshotValue(value.after);
    if (after === undefined) return undefined;
  }

  if (addKinds.has(value.kind)) {
    if (hasBefore || !hasAfter) return undefined;
  } else if (removeKinds.has(value.kind)) {
    if (!hasBefore || hasAfter) return undefined;
  } else if (beforeAndAfterKinds.has(value.kind)) {
    if (!hasBefore || !hasAfter) return undefined;
  } else if (value.kind === "unknown" && !hasBefore && !hasAfter) {
    return undefined;
  }

  return {
    record: value,
    schemaKind: value.schema_kind,
    objectName: value.target.object,
    path,
    kind: value.kind,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

function fingerprintValidatedChange(change: ValidatedChange): Result<string> {
  const preimage: JsonRecord = {
    fingerprint_version: "1",
    schema_kind: change.schemaKind,
    target: { object: change.objectName, path: change.path },
    kind: change.kind,
  };
  if (change.before !== undefined) preimage.before = change.before;
  if (change.after !== undefined) preimage.after = change.after;

  const serialized = canonicalize(preimage);
  if (!serialized.ok) return invalidChange();
  const digest = createHash("sha256").update(serialized.value, "utf8").digest("hex");
  return {
    ok: true,
    value: `chg_sha256_${digest}`,
    diagnostics: [],
  };
}

function canonicalSortKey(
  change: ValidatedChange,
  changeId: string,
): SortableChange["sortKey"] | undefined {
  const fields = [
    canonicalize(change.schemaKind),
    canonicalize(change.objectName),
    canonicalize(change.path),
    canonicalize(change.kind),
  ];
  if (fields.some((field) => !field.ok)) return undefined;

  return [
    fields[0]?.ok === true ? fields[0].value : "",
    fields[1]?.ok === true ? fields[1].value : "",
    fields[2]?.ok === true ? fields[2].value : "",
    fields[3]?.ok === true ? fields[3].value : "",
    changeId,
  ];
}

function compareSortKeys(
  left: SortableChange["sortKey"],
  right: SortableChange["sortKey"],
): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined || rightPart === undefined) continue;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

export function computeChangeId(value: unknown): Result<string> {
  try {
    const preflight = preflightJsonData(value);
    if (!preflight.ok) return invalidChange();
    const change = validateChange(preflight.value);
    return change === undefined ? invalidChange() : fingerprintValidatedChange(change);
  } catch {
    return invalidChange();
  }
}

export function sortChanges(value: unknown): Result<NormalizedChange[]> {
  try {
    const preflight = preflightJsonData(value);
    if (!preflight.ok || !Array.isArray(preflight.value)) {
      return invalidChangeArray();
    }

    const originals = value as unknown[];
    const sortable: SortableChange[] = [];
    for (let index = 0; index < preflight.value.length; index += 1) {
      const sanitized = preflight.value[index];
      const change = validateChange(sanitized);
      if (change === undefined) return invalidChangeArray();

      const changeId = change.record.change_id;
      if (typeof changeId !== "string" || !changeIdPattern.test(changeId)) {
        return invalidChangeArray();
      }
      const computed = fingerprintValidatedChange(change);
      if (!computed.ok) return invalidChangeArray();
      if (computed.value !== changeId) return changeIdMismatch(changeId);

      const sortKey = canonicalSortKey(change, changeId);
      if (sortKey === undefined) return invalidChangeArray();
      sortable.push({ original: originals[index], sortKey });
    }

    sortable.sort((left, right) => compareSortKeys(left.sortKey, right.sortKey));
    return {
      ok: true,
      value: sortable.map((entry) => entry.original as NormalizedChange),
      diagnostics: [],
    };
  } catch {
    return invalidChangeArray();
  }
}
