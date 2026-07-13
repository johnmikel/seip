import { isProxy } from "node:util/types";

export interface InvalidJsonDataIssue {
  message: "must be JSON data";
  path?: string;
}

export interface JsonDataResourceLimitIssue {
  kind: "resource_limit";
  message: "exceeds JSON resource limits";
  path?: string;
  resource: "bytes" | "collection" | "depth" | "shared_expansion";
}

export type JsonDataIssue =
  | InvalidJsonDataIssue
  | JsonDataResourceLimitIssue;

export interface JsonDataLimits {
  arrayLengthLimits?: readonly {
    path: readonly string[];
    maxLength: number;
  }[];
  maxBytes?: number;
  maxDepth?: number;
}

export type JsonDataPreflightResult =
  | { ok: true; value: unknown }
  | { ok: false; issue: JsonDataIssue };

interface VisitFrame {
  kind: "visit";
  value: unknown;
  path?: string;
}

interface ContainerFrame {
  index: number;
  keys?: string[];
  kind: "container";
  path?: string;
  value: object;
}

type Frame = ContainerFrame | VisitFrame;

const invalidJsonMessage = "must be JSON data" as const;
const resourceLimitMessage = "exceeds JSON resource limits" as const;

// Bounds work amplification caused only by identity sharing. Containers that
// occur once contribute equally to unfolded and unique counts, so ordinary
// large JSON trees do not spend this budget.
const MAX_SHARED_EXPANSION_OVERHEAD = 4_096;

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function appendPath(path: string | undefined, token: string): string {
  return `${path ?? ""}/${escapeJsonPointerToken(token)}`;
}

function issue(path?: string): InvalidJsonDataIssue {
  return path === undefined
    ? { message: invalidJsonMessage }
    : { message: invalidJsonMessage, path };
}

function resourceIssue(
  resource: JsonDataResourceLimitIssue["resource"],
  path?: string,
): JsonDataResourceLimitIssue {
  const result: JsonDataResourceLimitIssue = {
    kind: "resource_limit",
    message: resourceLimitMessage,
    resource,
  };
  if (path !== undefined) result.path = path;
  return result;
}

function arrayIndex(key: string): number | undefined {
  if (key === "0") return 0;
  if (!/^[1-9][0-9]*$/.test(key)) return undefined;

  const index = Number(key);
  return Number.isSafeInteger(index) && index < 4_294_967_295
    ? index
    : undefined;
}

/**
 * Checks the JavaScript value model before schema validation without invoking
 * user code. Shared acyclic references are valid; back-edges are not.
 */
function findJsonDataIssue(value: unknown): JsonDataIssue | undefined {
  const state = new WeakMap<object, "visiting" | "visited">();
  const frames: Frame[] = [{ kind: "visit", value }];
  let activePath: string | undefined;

  try {
    while (frames.length > 0) {
      const frame = frames.pop();
      if (frame === undefined) break;

      activePath = frame.path;
      if (frame.kind === "container") {
        const keys = frame.keys;
        const length =
          keys === undefined
            ? (frame.value as unknown[]).length
            : keys.length;
        let scheduledChild = false;
        while (frame.index < length) {
          const key =
            keys === undefined ? String(frame.index) : keys[frame.index];
          frame.index += 1;
          if (key === undefined) continue;

          const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return issue(appendPath(frame.path, key));
          }

          const child = descriptor.value;
          if (
            child === null ||
            typeof child === "string" ||
            typeof child === "boolean"
          ) {
            continue;
          }
          if (typeof child === "number") {
            if (!Number.isFinite(child)) {
              return issue(appendPath(frame.path, key));
            }
            continue;
          }
          if (typeof child !== "object") {
            return issue(appendPath(frame.path, key));
          }

          const childPath = appendPath(frame.path, key);
          frames.push(frame, {
            kind: "visit",
            value: child,
            path: childPath,
          });
          scheduledChild = true;
          break;
        }
        if (!scheduledChild) state.set(frame.value, "visited");
        continue;
      }

      const { path, value: current } = frame;
      if (
        current === null ||
        typeof current === "string" ||
        typeof current === "boolean"
      ) {
        continue;
      }
      if (typeof current === "number") {
        if (!Number.isFinite(current)) return issue(path);
        continue;
      }
      if (typeof current !== "object") return issue(path);
      if (isProxy(current)) return issue(path);

      const currentState = state.get(current);
      if (currentState === "visiting") return issue(path);
      if (currentState === "visited") continue;

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          return issue(path);
        }

        const keys = Reflect.ownKeys(current);
        let hasSymbol = false;
        let firstExtraKey: string | undefined;
        for (const key of keys) {
          if (typeof key === "symbol") {
            hasSymbol = true;
            continue;
          }
          if (key === "length") continue;

          const index = arrayIndex(key);
          if (index === undefined || index >= current.length) {
            if (firstExtraKey === undefined || key < firstExtraKey) {
              firstExtraKey = key;
            }
          }
        }
        if (hasSymbol) return issue(path);
        if (firstExtraKey !== undefined) {
          return issue(appendPath(path, firstExtraKey));
        }

        let expectedIndex = 0;
        for (const key of keys) {
          if (typeof key !== "string" || key === "length") continue;
          if (Number(key) !== expectedIndex) {
            return issue(appendPath(path, String(expectedIndex)));
          }

          const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return issue(appendPath(path, key));
          }
          expectedIndex += 1;
        }
        if (expectedIndex !== current.length) {
          return issue(appendPath(path, String(expectedIndex)));
        }

        state.set(current, "visiting");
        frames.push({
          index: 0,
          kind: "container",
          ...(path === undefined ? {} : { path }),
          value: current,
        });
      } else {
        const prototype = Object.getPrototypeOf(current);
        if (prototype !== Object.prototype && prototype !== null) {
          return issue(path);
        }

        const keys = Reflect.ownKeys(current);
        if (keys.some((key) => typeof key === "symbol")) return issue(path);
        const stringKeys = (keys as string[]).sort();
        for (const key of stringKeys) {
          const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return issue(appendPath(path, key));
          }
        }

        state.set(current, "visiting");
        frames.push({
          index: 0,
          keys: stringKeys,
          kind: "container",
          ...(path === undefined ? {} : { path }),
          value: current,
        });
      }
    }
  } catch {
    return issue(activePath);
  }

  return undefined;
}

type JsonContainer = unknown[] | Record<string, unknown>;

interface CloneFrame {
  source: object;
  target: JsonContainer;
}

function createSanitizedContainer(source: object): JsonContainer {
  return Array.isArray(source)
    ? []
    : (Object.create(null) as Record<string, unknown>);
}

function jsonContainerKeys(container: object): string[] {
  return Array.isArray(container)
    ? Array.from({ length: container.length }, (_, index) => String(index))
    : (Reflect.ownKeys(container) as string[]).sort();
}

function jsonContainerChildren(container: object): object[] {
  const children: object[] = [];
  // Native own-key order is deterministic. Avoid sorting here so estimation
  // remains linear in the unique container graph; cloning retains sorted keys.
  for (const key of Reflect.ownKeys(container)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("validated JSON data changed during work estimation");
    }
    if (typeof descriptor.value === "object" && descriptor.value !== null) {
      children.push(descriptor.value);
    }
  }
  return children;
}

interface MetricVisitFrame {
  kind: "visit";
  value: object;
}

interface MetricCompleteFrame {
  kind: "complete";
  value: object;
}

type MetricFrame = MetricVisitFrame | MetricCompleteFrame;

function validateLimit(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError("JSON data limits must be non-negative safe integers");
  }
}

function saturatedAdd(left: number, right: number, limit: number): number {
  if (left > limit || right > limit || left > limit - right) {
    return limit + 1;
  }
  return left + right;
}

function jsonStringUtf8Bytes(value: string, limit: number): number {
  let bytes = 2;
  if (bytes > limit) return limit + 1;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    let addition: number;
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      addition = 2;
    } else if (
      codeUnit === 0x08 ||
      codeUnit === 0x09 ||
      codeUnit === 0x0a ||
      codeUnit === 0x0c ||
      codeUnit === 0x0d
    ) {
      addition = 2;
    } else if (codeUnit <= 0x1f) {
      addition = 6;
    } else if (codeUnit <= 0x7f) {
      addition = 1;
    } else if (codeUnit <= 0x7ff) {
      addition = 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        addition = 4;
        index += 1;
      } else {
        addition = 6;
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      addition = 6;
    } else {
      addition = 3;
    }

    bytes = saturatedAdd(bytes, addition, limit);
    if (bytes > limit) return bytes;
  }

  return bytes;
}

function jsonScalarBytes(value: unknown, limit: number): number {
  if (value === null) return Math.min(4, limit + 1);
  if (typeof value === "boolean") {
    return Math.min(value ? 4 : 5, limit + 1);
  }
  if (typeof value === "number") {
    return Math.min(String(value).length, limit + 1);
  }
  if (typeof value === "string") return jsonStringUtf8Bytes(value, limit);
  throw new Error("validated JSON scalar changed during resource measurement");
}

function exceedsDepthLimit(value: unknown, maxDepth: number): boolean {
  if (typeof value !== "object" || value === null) return false;

  const deepestVisits = new WeakMap<object, number>();
  const pending = [{ value, depth: 1 }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.depth > maxDepth) return true;

    const previousDepth = deepestVisits.get(current.value);
    if (previousDepth !== undefined && previousDepth >= current.depth) continue;
    deepestVisits.set(current.value, current.depth);
    for (const child of jsonContainerChildren(current.value)) {
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return false;
}

function containerJsonBytes(
  container: object,
  sizes: WeakMap<object, number>,
  maxBytes: number,
): number {
  let bytes = 2;
  if (Array.isArray(container)) {
    for (let index = 0; index < container.length; index += 1) {
      if (index > 0) bytes = saturatedAdd(bytes, 1, maxBytes);
      const descriptor = Reflect.getOwnPropertyDescriptor(
        container,
        String(index),
      );
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new Error("validated JSON array changed during measurement");
      }
      const itemBytes =
        typeof descriptor.value === "object" && descriptor.value !== null
          ? sizes.get(descriptor.value)
          : jsonScalarBytes(descriptor.value, maxBytes);
      if (itemBytes === undefined) {
        throw new Error("JSON child size was not available");
      }
      bytes = saturatedAdd(bytes, itemBytes, maxBytes);
      if (bytes > maxBytes) return bytes;
    }
    return bytes;
  }

  const keys = jsonContainerKeys(container);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (index > 0) bytes = saturatedAdd(bytes, 1, maxBytes);
    bytes = saturatedAdd(
      bytes,
      jsonStringUtf8Bytes(key, maxBytes),
      maxBytes,
    );
    bytes = saturatedAdd(bytes, 1, maxBytes);
    const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("validated JSON record changed during measurement");
    }
    const valueBytes =
      typeof descriptor.value === "object" && descriptor.value !== null
        ? sizes.get(descriptor.value)
        : jsonScalarBytes(descriptor.value, maxBytes);
    if (valueBytes === undefined) {
      throw new Error("JSON child size was not available");
    }
    bytes = saturatedAdd(bytes, valueBytes, maxBytes);
    if (bytes > maxBytes) return bytes;
  }
  return bytes;
}

function exceedsByteLimit(value: unknown, maxBytes: number): boolean {
  if (typeof value !== "object" || value === null) {
    return jsonScalarBytes(value, maxBytes) > maxBytes;
  }

  const sizes = new WeakMap<object, number>();
  const active = new WeakSet<object>();
  const frames: MetricFrame[] = [{ kind: "visit", value }];
  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    if (frame.kind === "complete") {
      sizes.set(
        frame.value,
        containerJsonBytes(frame.value, sizes, maxBytes),
      );
      active.delete(frame.value);
      continue;
    }
    if (sizes.has(frame.value)) continue;
    if (active.has(frame.value)) {
      throw new Error("validated JSON data became cyclic during measurement");
    }

    active.add(frame.value);
    frames.push({ kind: "complete", value: frame.value });
    for (const child of jsonContainerChildren(frame.value)) {
      if (!sizes.has(child)) frames.push({ kind: "visit", value: child });
    }
  }

  return (sizes.get(value) ?? maxBytes + 1) > maxBytes;
}

function findJsonResourceIssue(
  value: unknown,
  limits: JsonDataLimits,
): JsonDataResourceLimitIssue | undefined {
  for (const limit of limits.arrayLengthLimits ?? []) {
    validateLimit(limit.maxLength);
    let current = value;
    let path: string | undefined;
    let found = true;
    for (const token of limit.path) {
      if (typeof current !== "object" || current === null) {
        found = false;
        break;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(current, token);
      if (descriptor === undefined || !("value" in descriptor)) {
        found = false;
        break;
      }
      current = descriptor.value;
      path = appendPath(path, token);
    }
    if (found && Array.isArray(current) && current.length > limit.maxLength) {
      return resourceIssue("collection", path);
    }
  }
  if (limits.maxDepth !== undefined) {
    validateLimit(limits.maxDepth);
    if (exceedsDepthLimit(value, limits.maxDepth)) {
      return resourceIssue("depth");
    }
  }
  if (limits.maxBytes !== undefined) {
    validateLimit(limits.maxBytes);
    if (exceedsByteLimit(value, limits.maxBytes)) {
      return resourceIssue("bytes");
    }
  }
  return undefined;
}

// Build the unique identity graph once, then evaluate
// visits(node) = 1 + sum(visits(child)) in reverse topological order. Parallel
// edges remain in adjacency so sharing is counted without unfolding the DAG.
function exceedsSharedExpansionBudget(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;

  const adjacency = new Map<object, object[]>();
  const indegree = new Map<object, number>([[value, 0]]);
  const seen = new WeakSet<object>();
  const pending = [value];
  const nodes: object[] = [];

  while (pending.length > 0) {
    const container = pending.pop();
    if (container === undefined || seen.has(container)) continue;
    seen.add(container);
    nodes.push(container);

    const children = jsonContainerChildren(container);
    adjacency.set(container, children);
    for (const child of children) {
      indegree.set(child, (indegree.get(child) ?? 0) + 1);
      if (!seen.has(child)) pending.push(child);
    }
  }

  const topological: object[] = [];
  const ready = nodes.filter((node) => indegree.get(node) === 0);
  for (let index = 0; index < ready.length; index += 1) {
    const container = ready[index];
    if (container === undefined) continue;
    topological.push(container);

    for (const child of adjacency.get(container) ?? []) {
      const remaining = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, remaining);
      if (remaining === 0) ready.push(child);
    }
  }
  if (topological.length !== nodes.length) return true;

  const uniqueContainerCount = nodes.length;
  const saturationLimit =
    uniqueContainerCount + MAX_SHARED_EXPANSION_OVERHEAD + 1;
  const unfoldedVisits = new Map<object, number>();
  for (let index = topological.length - 1; index >= 0; index -= 1) {
    const container = topological[index];
    if (container === undefined) continue;

    let visits = 1;
    for (const child of adjacency.get(container) ?? []) {
      const childVisits = unfoldedVisits.get(child);
      if (childVisits === undefined) return true;
      visits =
        visits >= saturationLimit - childVisits
          ? saturationLimit
          : visits + childVisits;
    }
    unfoldedVisits.set(container, visits);
  }

  return (
    (unfoldedVisits.get(value) ?? saturationLimit) - uniqueContainerCount >
    MAX_SHARED_EXPANSION_OVERHEAD
  );
}

function cloneJsonData(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  const clones = new WeakMap<object, JsonContainer>();
  const root = createSanitizedContainer(value);
  const frames: CloneFrame[] = [{ source: value, target: root }];
  clones.set(value, root);

  const cloneValue = (nestedValue: unknown): unknown => {
    if (typeof nestedValue !== "object" || nestedValue === null) {
      return nestedValue;
    }

    const existing = clones.get(nestedValue);
    if (existing !== undefined) return existing;

    const nestedClone = createSanitizedContainer(nestedValue);
    clones.set(nestedValue, nestedClone);
    frames.push({ source: nestedValue, target: nestedClone });
    return nestedClone;
  };

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    for (const key of jsonContainerKeys(frame.source)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(frame.source, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new Error("validated JSON data changed during sanitization");
      }

      const defined = Reflect.defineProperty(frame.target, key, {
        configurable: true,
        enumerable: true,
        value: cloneValue(descriptor.value),
        writable: true,
      });
      if (!defined) {
        throw new Error("could not sanitize validated JSON data");
      }
    }
  }

  return root;
}

/**
 * Validates and sanitizes JSON data before schema code sees it. Records are
 * cloned with null prototypes so inherited getters cannot execute during Ajv
 * property reads; shared acyclic references retain their identity.
 */
export function preflightJsonData(
  value: unknown,
  limits?: JsonDataLimits,
): JsonDataPreflightResult {
  const jsonDataIssue = findJsonDataIssue(value);
  if (jsonDataIssue !== undefined) {
    return { ok: false, issue: jsonDataIssue };
  }

  try {
    if (limits !== undefined) {
      const resourceLimitIssue = findJsonResourceIssue(value, limits);
      if (resourceLimitIssue !== undefined) {
        return { ok: false, issue: resourceLimitIssue };
      }
    }
    if (exceedsSharedExpansionBudget(value)) {
      return {
        ok: false,
        issue:
          limits === undefined ? issue() : resourceIssue("shared_expansion"),
      };
    }
    return { ok: true, value: cloneJsonData(value) };
  } catch {
    return { ok: false, issue: issue() };
  }
}
