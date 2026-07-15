import assert from "node:assert/strict";
import test from "node:test";

import * as api from "../../dist/index.js";

const approvedRuntimeExports = [
  "acceptDeclaration",
  "amendDeclaration",
  "canonicalize",
  "completeDeclaration",
  "computeChangeId",
  "createDeclaration",
  "evaluatePolicy",
  "normalizeDecimalLexeme",
  "proposeDeclaration",
  "recordConsumerResponse",
  "rejectDeclaration",
  "sortChanges",
  "startEnforcement",
  "validateDeclaration",
  "validateProtocolSchema",
  "validateProtocolVersion",
  "withdrawDeclaration",
];

test("exports exactly the approved pure v1 runtime boundary", () => {
  assert.deepEqual(Object.keys(api).sort(), approvedRuntimeExports);
});

test("does not export legacy, storage, delivery, cwd, or CLI effects", () => {
  const forbiddenExports = [
    "buildNotificationModel",
    "complete",
    "defaultConfig",
    "diffSchemas",
    "enforce",
    "ensureSeipDir",
    "ensureSeipRoot",
    "generateGitHubMarkdown",
    "generateSlackPayload",
    "getConfig",
    "getConfigPath",
    "getSeipDir",
    "getSeipRoot",
    "listDeclarations",
    "loadConfig",
    "loadDeclaration",
    "main",
    "propose",
    "reject",
    "respond",
    "runCli",
    "runNotificationAdapter",
    "saveConfig",
    "saveDeclaration",
    "sendToSlack",
    "validate",
    "withdraw",
  ];

  for (const name of forbiddenExports) {
    assert.equal(Object.hasOwn(api, name), false, name);
  }
});
