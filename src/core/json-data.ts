import { isProxy } from "node:util/types";

export interface JsonDataIssue {
  message: "must be JSON data";
  path?: string;
}

export type JsonDataPreflightResult =
  | { ok: true; value: unknown }
  | { ok: false; issue: JsonDataIssue };

interface VisitFrame {
  kind: "visit";
  value: unknown;
  path?: string;
}

interface LeaveFrame {
  kind: "leave";
  value: object;
}

type Frame = VisitFrame | LeaveFrame;

const invalidJsonMessage = "must be JSON data" as const;

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

function issue(path?: string): JsonDataIssue {
  return path === undefined
    ? { message: invalidJsonMessage }
    : { message: invalidJsonMessage, path };
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

      if (frame.kind === "leave") {
        state.set(frame.value, "visited");
        continue;
      }

      const { path, value: current } = frame;
      activePath = path;
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

      const children: VisitFrame[] = [];
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          return issue(path);
        }

        const keys = Reflect.ownKeys(current);
        if (keys.some((key) => typeof key === "symbol")) return issue(path);
        const indices: number[] = [];
        const extraKeys: string[] = [];
        for (const key of keys as string[]) {
          if (key === "length") continue;

          const index = arrayIndex(key);
          if (index === undefined || index >= current.length) {
            extraKeys.push(key);
            continue;
          }
          indices.push(index);
        }
        if (extraKeys.length > 0) {
          extraKeys.sort();
          const extraKey = extraKeys[0];
          if (extraKey !== undefined) {
            return issue(appendPath(path, extraKey));
          }
        }
        indices.sort((left, right) => left - right);

        let expectedIndex = 0;
        for (const index of indices) {
          if (index !== expectedIndex) {
            return issue(appendPath(path, String(expectedIndex)));
          }

          const key = String(index);
          const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
          if (
            descriptor === undefined ||
            descriptor.enumerable !== true ||
            !("value" in descriptor)
          ) {
            return issue(appendPath(path, key));
          }
          children.push({
            kind: "visit",
            value: descriptor.value,
            path: appendPath(path, key),
          });
          expectedIndex += 1;
        }
        if (expectedIndex !== current.length) {
          return issue(appendPath(path, String(expectedIndex)));
        }
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
          children.push({
            kind: "visit",
            value: descriptor.value,
            path: appendPath(path, key),
          });
        }
      }

      state.set(current, "visiting");
      frames.push({ kind: "leave", value: current });
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) frames.push(child);
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
export function preflightJsonData(value: unknown): JsonDataPreflightResult {
  const jsonDataIssue = findJsonDataIssue(value);
  if (jsonDataIssue !== undefined) {
    return { ok: false, issue: jsonDataIssue };
  }

  try {
    if (exceedsSharedExpansionBudget(value)) {
      return { ok: false, issue: issue() };
    }
    return { ok: true, value: cloneJsonData(value) };
  } catch {
    return { ok: false, issue: issue() };
  }
}
