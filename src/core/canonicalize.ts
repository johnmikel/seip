import { failure, type Result } from "./diagnostics.js";
import { preflightJsonData } from "./json-data.js";

interface ValueFrame {
  kind: "value";
  value: unknown;
  path?: string;
}

interface TextFrame {
  kind: "text";
  value: string;
}

type SerializationFrame = ValueFrame | TextFrame;

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function appendPath(path: string | undefined, token: string): string {
  return `${path ?? ""}/${escapeJsonPointerToken(token)}`;
}

function invalidCanonicalJson(path?: string): Result<never> {
  return failure(
    "SEIP_CANONICAL_JSON_INVALID",
    "Value must be finite, reflection-safe JSON data with safe integer numbers.",
    path === undefined ? {} : { path },
  );
}

function serialize(value: unknown): Result<string> {
  const output: string[] = [];
  const frames: SerializationFrame[] = [{ kind: "value", value }];

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) break;
    if (frame.kind === "text") {
      output.push(frame.value);
      continue;
    }

    const current = frame.value;
    if (current === null) {
      output.push("null");
      continue;
    }
    if (typeof current === "boolean") {
      output.push(current ? "true" : "false");
      continue;
    }
    if (typeof current === "string") {
      output.push(JSON.stringify(current));
      continue;
    }
    if (typeof current === "number") {
      if (
        !Number.isFinite(current) ||
        (Number.isInteger(current) && !Number.isSafeInteger(current))
      ) {
        return invalidCanonicalJson(frame.path);
      }
      output.push(JSON.stringify(current));
      continue;
    }

    if (Array.isArray(current)) {
      output.push("[");
      frames.push({ kind: "text", value: "]" });
      for (let index = current.length - 1; index >= 0; index -= 1) {
        if (index < current.length - 1) {
          frames.push({ kind: "text", value: "," });
        }
        frames.push({
          kind: "value",
          value: current[index],
          path: appendPath(frame.path, String(index)),
        });
      }
      continue;
    }

    if (typeof current !== "object") return invalidCanonicalJson(frame.path);
    const record = current as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    output.push("{");
    frames.push({ kind: "text", value: "}" });
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key === undefined) continue;
      if (index < keys.length - 1) {
        frames.push({ kind: "text", value: "," });
      }
      frames.push({
        kind: "value",
        value: record[key],
        path: appendPath(frame.path, key),
      });
      frames.push({ kind: "text", value: ":" });
      frames.push({ kind: "text", value: JSON.stringify(key) });
    }
  }

  return { ok: true, value: output.join(""), diagnostics: [] };
}

export function canonicalize(value: unknown): Result<string> {
  try {
    const preflight = preflightJsonData(value);
    if (!preflight.ok) return invalidCanonicalJson(preflight.issue.path);
    return serialize(preflight.value);
  } catch {
    return invalidCanonicalJson();
  }
}
