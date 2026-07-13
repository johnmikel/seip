import { failure, type Result } from "./diagnostics.js";

const SEMVER_PATTERN =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const DIAGNOSTIC_PATH = "/protocol_version";

export function validateProtocolVersion(value: unknown): Result<string> {
  if (typeof value !== "string") {
    return invalidProtocolVersion();
  }

  const match = SEMVER_PATTERN.exec(value);
  if (match === null) {
    return invalidProtocolVersion();
  }

  const major = match[1];
  const prerelease = match[4];
  if (major !== "1" || prerelease !== undefined) {
    return failure(
      "SEIP_PROTOCOL_VERSION_UNSUPPORTED",
      "Protocol version must be a stable 1.x.y release.",
      { path: DIAGNOSTIC_PATH },
    );
  }

  return { ok: true, value, diagnostics: [] };
}

function invalidProtocolVersion(): Result<never> {
  return failure(
    "SEIP_PROTOCOL_VERSION_INVALID",
    "Protocol version must be a valid SemVer 2.0.0 string.",
    { path: DIAGNOSTIC_PATH },
  );
}
