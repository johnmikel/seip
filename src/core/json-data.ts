import { isProxy } from "node:util/types";

export interface InvalidJsonDataIssue {
  message: "must be JSON data";
  path?: string;
}

export interface JsonDataResourceLimitIssue {
  kind: "resource_limit";
  message: "exceeds JSON resource limits";
  path?: string;
  resource:
    | "bytes"
    | "collection"
    | "containers"
    | "depth"
    | "shared_expansion";
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
  maxContainers?: number;
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

interface JsonDataInspection {
  containerCount: number;
  issue?: InvalidJsonDataIssue;
}

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

function ownDataMaxContainersHint(
  limits: JsonDataLimits | undefined,
): number | undefined {
  if (
    limits === undefined ||
    (typeof limits !== "object" && typeof limits !== "function") ||
    limits === null ||
    isProxy(limits)
  ) {
    return undefined;
  }

  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(
      limits,
      "maxContainers",
    );
    if (descriptor === undefined || !("value" in descriptor)) {
      return undefined;
    }
    const configured = descriptor.value;
    return Number.isSafeInteger(configured) &&
      configured >= 0 &&
      configured < Number.MAX_SAFE_INTEGER
      ? configured
      : undefined;
  } catch {
    return undefined;
  }
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
 * Inspects the JavaScript value model before schema validation without
 * invoking user code. Shared acyclic references are valid; back-edges are not.
 * A valid container-limit hint bounds completed empty-container identity state
 * after the result is already known to exceed that limit.
 */
function inspectJsonData(
  value: unknown,
  maxContainersHint?: number,
): JsonDataInspection {
  const state = new WeakMap<object, "visiting" | "visited">();
  const frames: Frame[] = [{ kind: "visit", value }];
  let containerCount = 0;
  let activePath: string | undefined;
  const invalid = (path?: string): JsonDataInspection => ({
    containerCount,
    issue: issue(path),
  });

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
            return invalid(appendPath(frame.path, key));
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
              return invalid(appendPath(frame.path, key));
            }
            continue;
          }
          if (typeof child !== "object") {
            return invalid(appendPath(frame.path, key));
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
        if (!scheduledChild) {
          const saturated =
            maxContainersHint !== undefined &&
            containerCount > maxContainersHint;
          if (saturated && length === 0) {
            state.delete(frame.value);
          } else {
            state.set(frame.value, "visited");
          }
        }
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
        if (!Number.isFinite(current)) return invalid(path);
        continue;
      }
      if (typeof current !== "object") return invalid(path);
      if (isProxy(current)) return invalid(path);

      const currentState = state.get(current);
      if (currentState === "visiting") return invalid(path);
      if (currentState === "visited") continue;

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          return invalid(path);
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
        if (hasSymbol) return invalid(path);
        if (firstExtraKey !== undefined) {
          return invalid(appendPath(path, firstExtraKey));
        }

        let expectedIndex = 0;
        for (const key of keys) {
          if (typeof key !== "string" || key === "length") continue;
          if (Number(key) !== expectedIndex) {
            return invalid(appendPath(path, String(expectedIndex)));
          }

          const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return invalid(appendPath(path, key));
          }
          expectedIndex += 1;
        }
        if (expectedIndex !== current.length) {
          return invalid(appendPath(path, String(expectedIndex)));
        }

        if (
          maxContainersHint === undefined ||
          containerCount <= maxContainersHint
        ) {
          containerCount += 1;
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
          return invalid(path);
        }

        const keys = Reflect.ownKeys(current);
        if (keys.some((key) => typeof key === "symbol")) return invalid(path);
        const stringKeys = (keys as string[]).sort();
        for (const key of stringKeys) {
          const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return invalid(appendPath(path, key));
          }
        }

        if (
          maxContainersHint === undefined ||
          containerCount <= maxContainersHint
        ) {
          containerCount += 1;
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
    return invalid(activePath);
  }

  return { containerCount };
}

type JsonContainer = unknown[] | Record<string, unknown>;

interface ChildCursor {
  container: object;
  index: number;
  keys?: readonly PropertyKey[];
}

interface CloneFrame {
  index: number;
  keys?: readonly string[];
  source: object;
  target: JsonContainer;
}

interface DepthFrame {
  cursor: ChildCursor;
  depth: number;
}

interface MetricFrame {
  cursor: ChildCursor;
}

interface ExpansionFrame {
  cursor: ChildCursor;
  pendingChild?: object;
  visits: number;
}

function createSanitizedContainer(source: object): JsonContainer {
  return Array.isArray(source)
    ? []
    : (Object.create(null) as Record<string, unknown>);
}

function jsonRecordKeys(container: object): string[] {
  return (Reflect.ownKeys(container) as string[]).sort();
}

function createChildCursor(container: object): ChildCursor {
  return Array.isArray(container)
    ? { container, index: 0 }
    : { container, index: 0, keys: Reflect.ownKeys(container) };
}

function nextObjectChild(cursor: ChildCursor): object | undefined {
  const length =
    cursor.keys === undefined
      ? (cursor.container as unknown[]).length
      : cursor.keys.length;
  while (cursor.index < length) {
    const key =
      cursor.keys === undefined
        ? String(cursor.index)
        : cursor.keys[cursor.index];
    cursor.index += 1;
    if (key === undefined) continue;

    const descriptor = Reflect.getOwnPropertyDescriptor(cursor.container, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("validated JSON data changed during work estimation");
    }
    if (typeof descriptor.value === "object" && descriptor.value !== null) {
      return descriptor.value;
    }
  }
  return undefined;
}

function createCloneFrame(source: object, target: JsonContainer): CloneFrame {
  return Array.isArray(source)
    ? { index: 0, source, target }
    : { index: 0, keys: jsonRecordKeys(source), source, target };
}

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
  if (maxDepth < 1) return true;

  const deepestVisits = new WeakMap<object, number>();
  deepestVisits.set(value, 1);
  const frames: DepthFrame[] = [
    { cursor: createChildCursor(value), depth: 1 },
  ];
  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    const child = nextObjectChild(frame.cursor);
    if (child === undefined) continue;
    frames.push(frame);

    const childDepth = frame.depth + 1;
    if (childDepth > maxDepth) return true;
    const previousDepth = deepestVisits.get(child);
    if (previousDepth !== undefined && previousDepth >= childDepth) continue;
    deepestVisits.set(child, childDepth);
    frames.push({ cursor: createChildCursor(child), depth: childDepth });
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

  const keys = jsonRecordKeys(container);
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
  active.add(value);
  const frames: MetricFrame[] = [{ cursor: createChildCursor(value) }];
  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    const child = nextObjectChild(frame.cursor);
    if (child !== undefined) {
      frames.push(frame);
      if (sizes.has(child)) continue;
      if (active.has(child)) {
        throw new Error("validated JSON data became cyclic during measurement");
      }
      active.add(child);
      frames.push({ cursor: createChildCursor(child) });
      continue;
    }

    const container = frame.cursor.container;
    sizes.set(container, containerJsonBytes(container, sizes, maxBytes));
    active.delete(container);
  }

  return (sizes.get(value) ?? maxBytes + 1) > maxBytes;
}

function findJsonResourceIssue(
  value: unknown,
  limits: JsonDataLimits,
  containerCount: number,
): JsonDataResourceLimitIssue | undefined {
  const maxContainers = limits.maxContainers;
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
  if (maxContainers !== undefined) {
    validateLimit(maxContainers);
    if (containerCount > maxContainers) {
      return resourceIssue("containers");
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

// Evaluate visits(node) = 1 + sum(visits(child)) with a memoized cursor walk.
// Parallel edges are encountered separately, preserving unfolded multiplicity
// without retaining the whole identity graph or all siblings at once.
function exceedsSharedExpansionBudget(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;

  const active = new WeakSet<object>();
  const unfoldedVisits = new WeakMap<object, number>();
  let uniqueContainerCount = 1;
  active.add(value);
  const frames: ExpansionFrame[] = [
    { cursor: createChildCursor(value), visits: 1 },
  ];

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    if (frame.pendingChild !== undefined) {
      const childVisits = unfoldedVisits.get(frame.pendingChild);
      if (childVisits === undefined) return true;
      frame.visits = saturatedAdd(
        frame.visits,
        childVisits,
        Number.MAX_SAFE_INTEGER - 1,
      );
      delete frame.pendingChild;
    }

    let child = nextObjectChild(frame.cursor);
    while (child !== undefined) {
      const childVisits = unfoldedVisits.get(child);
      if (childVisits !== undefined) {
        frame.visits = saturatedAdd(
          frame.visits,
          childVisits,
          Number.MAX_SAFE_INTEGER - 1,
        );
        child = nextObjectChild(frame.cursor);
        continue;
      }
      if (active.has(child)) return true;

      uniqueContainerCount += 1;
      active.add(child);
      frame.pendingChild = child;
      frames.push(frame, {
        cursor: createChildCursor(child),
        visits: 1,
      });
      break;
    }

    if (child === undefined && frame.pendingChild === undefined) {
      const container = frame.cursor.container;
      unfoldedVisits.set(container, frame.visits);
      active.delete(container);
    }
  }

  return (
    (unfoldedVisits.get(value) ?? Number.MAX_SAFE_INTEGER) -
      uniqueContainerCount >
    MAX_SHARED_EXPANSION_OVERHEAD
  );
}

function cloneJsonData(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  const clones = new WeakMap<object, JsonContainer>();
  const root = createSanitizedContainer(value);
  const frames: CloneFrame[] = [createCloneFrame(value, root)];
  clones.set(value, root);

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;

    const length =
      frame.keys === undefined
        ? (frame.source as unknown[]).length
        : frame.keys.length;
    while (frame.index < length) {
      const key =
        frame.keys === undefined
          ? String(frame.index)
          : frame.keys[frame.index];
      frame.index += 1;
      if (key === undefined) continue;

      const descriptor = Reflect.getOwnPropertyDescriptor(frame.source, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new Error("validated JSON data changed during sanitization");
      }

      let clonedValue = descriptor.value;
      let childFrame: CloneFrame | undefined;
      if (typeof descriptor.value === "object" && descriptor.value !== null) {
        const existing = clones.get(descriptor.value);
        if (existing !== undefined) {
          clonedValue = existing;
        } else {
          const nestedClone = createSanitizedContainer(descriptor.value);
          clones.set(descriptor.value, nestedClone);
          clonedValue = nestedClone;
          childFrame = createCloneFrame(descriptor.value, nestedClone);
        }
      }

      const defined = Reflect.defineProperty(frame.target, key, {
        configurable: true,
        enumerable: true,
        value: clonedValue,
        writable: true,
      });
      if (!defined) {
        throw new Error("could not sanitize validated JSON data");
      }

      if (childFrame !== undefined) {
        frames.push(frame, childFrame);
        break;
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
  const inspection = inspectJsonData(value, ownDataMaxContainersHint(limits));
  if (inspection.issue !== undefined) {
    return { ok: false, issue: inspection.issue };
  }

  try {
    if (limits !== undefined) {
      const resourceLimitIssue = findJsonResourceIssue(
        value,
        limits,
        inspection.containerCount,
      );
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
