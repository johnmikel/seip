import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  acceptDeclaration,
  amendDeclaration,
  completeDeclaration,
  computeChangeId,
  proposeDeclaration,
  recordConsumerResponse,
  rejectDeclaration,
  startEnforcement,
  validateDeclaration,
  withdrawDeclaration,
} from "../../dist/core/index.js";

const fixtureUrl = new URL(
  "../fixtures/v1/valid/minimal-declaration.json",
  import.meta.url,
);
const source = JSON.parse(await readFile(fixtureUrl, "utf8"));
const fixtureChangeId = computeChangeId(source.changes[0]);
assert.equal(fixtureChangeId.ok, true);
source.changes[0].change_id = fixtureChangeId.value;
const statuses = [
  "DRAFT",
  "PROPOSED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "ENFORCING",
  "COMPLETED",
  "WITHDRAWN",
  "REJECTED",
];

function jsonContent(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendEvent(declaration, type, from, to, minute, details = {}) {
  declaration.events.push({
    event_id: `evt_fixture_${declaration.events.length}_${type.toLowerCase()}`,
    type,
    declaration_revision: declaration.revision,
    at: `2026-07-13T09:0${minute}:00Z`,
    actor: "fixture-actor",
    from_status: from,
    to_status: to,
    details,
  });
  declaration.status = to;
}

function appendResponse(declaration, decision, minute) {
  const responseId = `rsp_fixture_${declaration.responses.length + 1}`;
  declaration.responses.push({
    response_id: responseId,
    declaration_revision: declaration.revision,
    team: "analytics",
    decision,
    message: `${decision} for fixture state`,
    actor: "analytics-reviewer",
    at: `2026-07-13T09:0${minute}:00Z`,
  });
  const from = declaration.status;
  const to =
    from === "PROPOSED" && decision !== "ACKNOWLEDGED"
      ? "UNDER_REVIEW"
      : from;
  appendEvent(declaration, "CONSUMER_RESPONDED", from, to, minute, {
    response_id: responseId,
    team: "analytics",
    decision,
  });
}

function declarationIn(status) {
  const declaration = structuredClone(source);
  declaration.x_root = { retained: true };

  if (status === "DRAFT") return declaration;
  if (status === "WITHDRAWN") {
    appendEvent(declaration, "WITHDRAWN", "DRAFT", "WITHDRAWN", 1, {
      reason: "Fixture withdrawn",
    });
    return declaration;
  }

  appendEvent(declaration, "PROPOSED", "DRAFT", "PROPOSED", 1);
  if (status === "REJECTED") {
    appendEvent(declaration, "REJECTED", "PROPOSED", "REJECTED", 2, {
      reason: "Fixture rejected",
    });
    return declaration;
  }
  if (status === "UNDER_REVIEW") {
    appendResponse(declaration, "OBJECTED", 2);
    appendResponse(declaration, "ACKNOWLEDGED", 3);
    return declaration;
  }
  if (status === "PROPOSED") {
    appendResponse(declaration, "ACKNOWLEDGED", 2);
    return declaration;
  }

  appendResponse(declaration, "ACKNOWLEDGED", 2);
  appendEvent(declaration, "ACCEPTED", "PROPOSED", "ACCEPTED", 3);
  if (status === "ACCEPTED") return declaration;
  appendEvent(declaration, "ENFORCING", "ACCEPTED", "ENFORCING", 4);
  if (status === "ENFORCING") return declaration;
  appendEvent(declaration, "COMPLETED", "ENFORCING", "COMPLETED", 5);
  return declaration;
}

function context(status, operation) {
  return {
    actor: "lifecycle-actor",
    at: "2026-07-13T10:00:00Z",
    eventId: `evt_${status.toLowerCase()}_${operation}`,
  };
}

const operations = {
  amend: (value, ctx) =>
    amendDeclaration(
      value,
      { intent: { summary: "Materially amended summary" } },
      "Review feedback incorporated",
      ctx,
    ),
  propose: (value, ctx) => proposeDeclaration(value, ctx),
  respond: (value, ctx) =>
    recordConsumerResponse(
      value,
      `rsp_${ctx.eventId}`,
      value?.revision ?? 1,
      "analytics",
      "ACKNOWLEDGED",
      "Reviewed",
      ctx,
    ),
  accept: (value, ctx) => acceptDeclaration(value, ctx),
  start: (value, ctx) => startEnforcement(value, ctx),
  complete: (value, ctx) => completeDeclaration(value, ctx),
  withdraw: (value, ctx) => withdrawDeclaration(value, "No longer needed", ctx),
  reject: (value, ctx) => rejectDeclaration(value, "Not approved", ctx),
};

const allowed = {
  DRAFT: ["amend", "propose", "withdraw"],
  PROPOSED: ["amend", "respond", "accept", "withdraw", "reject"],
  UNDER_REVIEW: ["amend", "respond", "accept", "withdraw", "reject"],
  ACCEPTED: ["start", "withdraw"],
  ENFORCING: ["complete"],
  COMPLETED: [],
  WITHDRAWN: [],
  REJECTED: [],
};

test("implements the exhaustive v1 lifecycle transition matrix immutably", () => {
  for (const status of statuses) {
    const fixture = declarationIn(status);
    assert.equal(validateDeclaration(fixture).ok, true, `${status} fixture`);

    for (const [operation, invoke] of Object.entries(operations)) {
      const input = structuredClone(fixture);
      const before = structuredClone(input);
      const result = invoke(input, context(status, operation));
      const isAllowed = allowed[status].includes(operation);

      assert.equal(result.ok, isAllowed, `${status} -> ${operation}`);
      assert.deepEqual(input, before, `${status} -> ${operation} mutated input`);
      if (result.ok) {
        assert.notEqual(result.value, input, `${status} -> ${operation} aliased input`);
        assert.equal(
          result.value.events.length,
          before.events.length + 1,
          `${status} -> ${operation} did not append exactly one event`,
        );
        assert.deepEqual(jsonContent(result.value.x_root), { retained: true });
      } else {
        assert.ok(
          result.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "SEIP_LIFECYCLE_INVALID_TRANSITION",
          ),
          `${status} -> ${operation} did not report invalid transition`,
        );
      }
    }
  }
});

test("lifecycle operations are total for non-object and schema-invalid input", () => {
  for (const value of [null, 42, [], {}]) {
    for (const [operation, invoke] of Object.entries(operations)) {
      assert.doesNotThrow(() => {
        const result = invoke(value, context("DRAFT", operation));
        assert.equal(result.ok, false);
        assert.ok(result.diagnostics.length > 0);
      }, `${operation} threw for ${JSON.stringify(value)}`);
    }
  }
});

function proposedWithConsumers(consumers) {
  const declaration = structuredClone(source);
  declaration.consumers = structuredClone(consumers);
  appendEvent(declaration, "PROPOSED", "DRAFT", "PROPOSED", 1);
  return declaration;
}

test("explicitly accepts zero consumers and gates consumer declarations", () => {
  const zeroConsumers = proposedWithConsumers([]);
  const zeroBefore = structuredClone(zeroConsumers);
  const acceptedZero = acceptDeclaration(
    zeroConsumers,
    context("PROPOSED", "accept_zero"),
  );
  assert.equal(acceptedZero.ok, true);
  assert.deepEqual(zeroConsumers, zeroBefore);
  assert.equal(acceptedZero.value.status, "ACCEPTED");
  assert.equal(acceptedZero.value.events.length, zeroConsumers.events.length + 1);

  const pending = proposedWithConsumers([{ team: "analytics" }]);
  const blocked = acceptDeclaration(
    pending,
    context("PROPOSED", "accept_pending"),
  );
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION",
    ),
  );

  const acknowledged = recordConsumerResponse(
    pending,
    "rsp_current_ack",
    1,
    "analytics",
    "ACKNOWLEDGED",
    "Approved",
    context("PROPOSED", "ack_current"),
  );
  assert.equal(acknowledged.ok, true);
  const accepted = acceptDeclaration(
    acknowledged.value,
    context("PROPOSED", "accept_acknowledged"),
  );
  assert.equal(accepted.ok, true);
});

test("records response revision and event linkage without auto-accepting", () => {
  for (const decision of ["OBJECTED", "EXTENSION_REQUESTED"]) {
    const proposed = proposedWithConsumers([{ team: "analytics" }]);
    const before = structuredClone(proposed);
    const responseId = `rsp_${decision.toLowerCase()}`;
    const result = recordConsumerResponse(
      proposed,
      responseId,
      1,
      "analytics",
      decision,
      "Needs follow-up",
      context("PROPOSED", decision.toLowerCase()),
    );

    assert.equal(result.ok, true, decision);
    assert.deepEqual(proposed, before);
    assert.equal(result.value.status, "UNDER_REVIEW");
    assert.deepEqual(jsonContent(result.value.responses.at(-1)), {
      response_id: responseId,
      declaration_revision: 1,
      team: "analytics",
      decision,
      message: "Needs follow-up",
      actor: "lifecycle-actor",
      at: "2026-07-13T10:00:00Z",
    });
    assert.deepEqual(jsonContent(result.value.events.at(-1)), {
      event_id: `evt_proposed_${decision.toLowerCase()}`,
      type: "CONSUMER_RESPONDED",
      declaration_revision: 1,
      at: "2026-07-13T10:00:00Z",
      actor: "lifecycle-actor",
      from_status: "PROPOSED",
      to_status: "UNDER_REVIEW",
      details: { response_id: responseId, team: "analytics", decision },
    });

    const resolved = recordConsumerResponse(
      result.value,
      `${responseId}_resolved`,
      1,
      "analytics",
      "ACKNOWLEDGED",
      "Resolved",
      {
        actor: "lifecycle-actor",
        at: "2026-07-13T10:01:00Z",
        eventId: `evt_${decision.toLowerCase()}_resolved`,
      },
    );
    assert.equal(resolved.ok, true);
    assert.equal(resolved.value.status, "UNDER_REVIEW");
    assert.equal(resolved.value.events.at(-1).to_status, "UNDER_REVIEW");
  }
});

test("lets final declaration validation own response reference failures", () => {
  const proposed = proposedWithConsumers([{ team: "analytics" }]);
  const stale = recordConsumerResponse(
    proposed,
    "rsp_stale",
    2,
    "analytics",
    "ACKNOWLEDGED",
    "Stale",
    context("PROPOSED", "stale"),
  );
  assert.equal(stale.ok, false);
  assert.ok(
    stale.diagnostics.some(
      (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_REFERENCE_INVALID",
    ),
  );

  const undeclared = recordConsumerResponse(
    proposed,
    "rsp_unknown_team",
    1,
    "not-declared",
    "ACKNOWLEDGED",
    "Unknown team",
    context("PROPOSED", "unknown_team"),
  );
  assert.equal(undeclared.ok, false);
  assert.ok(
    undeclared.diagnostics.some(
      (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_REFERENCE_INVALID",
    ),
  );
});

const validAmendmentPatch = {
  intent: {
    summary: "Clarify the dual-read migration",
    extension_note: { source: "review" },
  },
  consumers: {
    add: [
      {
        team: "risk",
        contact: "risk@example.com",
        dependencies: ["orders-api"],
      },
    ],
    update: [
      {
        team: "analytics",
        contact: "analytics-oncall@example.com",
        dependencies: ["orders-api", "orders-events"],
      },
    ],
  },
};

test("amends mutable sections with deterministic paths and digest vectors", () => {
  const draft = structuredClone(source);
  draft.x_root = { retained: true };
  const before = structuredClone(draft);
  const patch = structuredClone(validAmendmentPatch);
  const patchBefore = structuredClone(patch);
  const ctx = context("DRAFT", "amend_vector");
  const contextBefore = structuredClone(ctx);

  const result = amendDeclaration(
    draft,
    patch,
    "Clarify review intent and ownership",
    ctx,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(draft, before);
  assert.deepEqual(patch, patchBefore);
  assert.deepEqual(ctx, contextBefore);
  assert.equal(result.value.revision, 2);
  assert.equal(result.value.status, "DRAFT");
  assert.deepEqual(
    jsonContent(result.value.consumers.map((consumer) => consumer.team)),
    ["analytics", "risk"],
  );
  assert.deepEqual(jsonContent(result.value.x_root), { retained: true });
  assert.deepEqual(jsonContent(result.value.events.at(-1)), {
    event_id: "evt_draft_amend_vector",
    type: "DECLARATION_UPDATED",
    declaration_revision: 2,
    at: "2026-07-13T10:00:00Z",
    actor: "lifecycle-actor",
    from_status: "DRAFT",
    to_status: "DRAFT",
    details: {
      reason: "Clarify review intent and ownership",
      changed_paths: [
        "/consumers/by-team/analytics/contact",
        "/consumers/by-team/analytics/dependencies",
        "/consumers/by-team/risk",
        "/intent/extension_note",
        "/intent/summary",
      ],
      before_digest:
        "25eb38d78704cffa78721ee86c3694542c30f1ca5403f7ec3b9422c08e099f75",
      after_digest:
        "54da2c9800bb803f1d52af5b674b71dffd97d7d90084048d0bbb8677ca2888c7",
    },
  });
});

test("retains old response and evidence history but makes it revision-stale", () => {
  const proposed = declarationIn("PROPOSED");
  const changeId = proposed.changes[0].change_id;
  proposed.evidence.push({
    evidence_id: "evd_fixture_1",
    declaration_revision: 1,
    team: "analytics",
    validator_id: "orders-contract-test",
    change_ids: [changeId],
    source_digests: {
      before: "a".repeat(64),
      after: "b".repeat(64),
    },
    result: "PASSED",
    at: "2026-07-13T09:03:00Z",
    summary: "Consumer suite passed",
  });
  appendEvent(
    proposed,
    "EVIDENCE_RECORDED",
    "PROPOSED",
    "PROPOSED",
    3,
    { evidence_id: "evd_fixture_1", team: "analytics", result: "PASSED" },
  );
  assert.equal(validateDeclaration(proposed).ok, true);
  const beforeResponses = structuredClone(proposed.responses);
  const beforeEvidence = structuredClone(proposed.evidence);

  const amended = amendDeclaration(
    proposed,
    { intent: { summary: "New revision summary" } },
    "Material review update",
    context("PROPOSED", "amend_revision"),
  );
  assert.equal(amended.ok, true);
  assert.equal(amended.value.status, "PROPOSED");
  assert.equal(amended.value.revision, 2);
  assert.deepEqual(jsonContent(amended.value.responses), beforeResponses);
  assert.deepEqual(jsonContent(amended.value.evidence), beforeEvidence);

  const blocked = acceptDeclaration(
    amended.value,
    {
      actor: "lifecycle-actor",
      at: "2026-07-13T10:01:00Z",
      eventId: "evt_accept_stale_revision",
    },
  );
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION",
    ),
  );
});

test("rejects closed, no-op, and invalid consumer amendments", () => {
  const draft = structuredClone(source);
  const cases = [
    [{ changes: [] }, "immutable changes"],
    [{ producer: { team: "other" } }, "immutable producer"],
    [{ declaration_id: "other" }, "immutable identity"],
    [{ protocol_version: "1.1.0" }, "immutable protocol"],
    [{ intent: { summary: source.intent.summary } }, "no-op"],
    [{ consumers: { add: [{ team: "analytics" }] } }, "existing add"],
    [
      { consumers: { update: [{ team: "not-declared", contact: "x" }] } },
      "missing update",
    ],
    [{ consumers: { remove: ["analytics"] } }, "unsupported removal"],
    [{ consumers: { rename: { from: "analytics", to: "other" } } }, "rename"],
    [{ intent: { missing_extension: null } }, "absent deletion no-op"],
  ];

  for (const [patch, label] of cases) {
    const before = structuredClone(draft);
    const result = amendDeclaration(
      draft,
      patch,
      "Invalid amendment case",
      context("DRAFT", `amend_${label.replaceAll(" ", "_")}`),
    );
    assert.equal(result.ok, false, label);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_LIFECYCLE_AMENDMENT_INVALID",
      ),
      label,
    );
    assert.deepEqual(draft, before, label);
  }
});

test("uses RFC 7396 merge semantics and canonical escaped paths", () => {
  const draft = structuredClone(source);
  draft.consumers = [
    { team: "z-existing", x_order: 1 },
    { team: "analytics", dependencies: ["orders-api"], x_order: 2 },
  ];
  draft.intent[""] = "old-empty-token";
  draft.intent["a/b"] = "old-slash";
  draft.intent["til~de"] = "old-tilde";
  draft.intent.array_extension = [1, 2];
  draft.intent.scalar_extension = "replace-me";
  draft.intent.nested_extension = { keep: true, remove: true };

  const patch = JSON.parse(`{
    "intent": {
      "": "new-empty-token",
      "__proto__": {},
      "a/b": "new-slash",
      "absent_object": {},
      "array_extension": [1, 3],
      "missing_extension": null,
      "nested_extension": { "added": true, "remove": null },
      "scalar_extension": {},
      "til~de": "new-tilde"
    },
    "consumers": {
      "add": [
        { "team": "😀" },
        { "team": "é" },
        { "team": "risk/~team" },
        { "team": "é" },
        { "team": "A" }
      ]
    }
  }`);

  const result = amendDeclaration(
    draft,
    patch,
    "Exercise canonical merge paths",
    context("DRAFT", "amend_paths"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    jsonContent(result.value.consumers.map((consumer) => consumer.team)),
    ["z-existing", "analytics", "A", "é", "risk/~team", "é", "😀"],
  );
  assert.deepEqual(
    jsonContent(result.value.events.at(-1).details.changed_paths),
    [
      "/consumers/by-team/A",
      "/consumers/by-team/é",
      "/consumers/by-team/risk~1~0team",
      "/consumers/by-team/é",
      "/consumers/by-team/😀",
      "/intent/",
      "/intent/__proto__",
      "/intent/absent_object",
      "/intent/array_extension",
      "/intent/a~1b",
      "/intent/nested_extension/added",
      "/intent/nested_extension/remove",
      "/intent/scalar_extension",
      "/intent/til~0de",
    ],
  );
  assert.equal(Object.hasOwn(result.value.intent, "missing_extension"), false);
  assert.equal(Object.hasOwn(result.value.intent, "__proto__"), true);
  assert.deepEqual(jsonContent(result.value.intent.__proto__), {});
  assert.deepEqual(jsonContent(result.value.intent.scalar_extension), {});
  assert.deepEqual(jsonContent(result.value.intent.absent_object), {});
  assert.deepEqual(jsonContent(result.value.intent.array_extension), [1, 3]);
  assert.deepEqual(jsonContent(result.value.intent.nested_extension), {
    added: true,
    keep: true,
  });
  assert.equal(Object.prototype.polluted, undefined);
});

function addStaticExtensions(declaration) {
  declaration.x_root = { layer: "root" };
  declaration.producer.x_producer = { layer: "producer" };
  declaration.changes[0].x_change = { layer: "change" };
  declaration.changes[0].target.x_target = { layer: "target" };
  declaration.intent.x_intent = { layer: "intent" };
  declaration.intent.migration.x_migration = { layer: "migration" };
  declaration.intent.timeline.x_timeline = { layer: "timeline" };
  declaration.consumers[0].x_consumer = { layer: "consumer" };
  declaration.events[0].x_event = { layer: "event" };
  declaration.events[0].details.x_details = { layer: "details" };
}

function extendedProposed() {
  const declaration = declarationIn("PROPOSED");
  addStaticExtensions(declaration);
  declaration.responses[0].x_response = { layer: "response" };
  declaration.evidence.push({
    evidence_id: "evd_extensions_1",
    declaration_revision: 1,
    team: "analytics",
    validator_id: "orders-contract-test",
    change_ids: [declaration.changes[0].change_id],
    source_digests: {
      before: "c".repeat(64),
      after: "d".repeat(64),
    },
    result: "PASSED",
    at: "2026-07-13T09:03:00Z",
    summary: "Extended evidence",
    artifact: {
      uri: "https://example.com/evidence/1",
      sha256: "e".repeat(64),
      x_artifact: { layer: "artifact" },
    },
    x_evidence: { layer: "evidence" },
  });
  appendEvent(
    declaration,
    "EVIDENCE_RECORDED",
    "PROPOSED",
    "PROPOSED",
    3,
    {
      evidence_id: "evd_extensions_1",
      team: "analytics",
      result: "PASSED",
    },
  );
  return declaration;
}

function extensionSnapshot(declaration) {
  return jsonContent({
    root: declaration.x_root,
    producer: declaration.producer.x_producer,
    change: declaration.changes[0].x_change,
    target: declaration.changes[0].target.x_target,
    intent: declaration.intent.x_intent,
    migration: declaration.intent.migration.x_migration,
    timeline: declaration.intent.timeline.x_timeline,
    consumer: declaration.consumers[0].x_consumer,
    response: declaration.responses[0]?.x_response,
    evidence: declaration.evidence[0]?.x_evidence,
    artifact: declaration.evidence[0]?.artifact?.x_artifact,
    event: declaration.events[0].x_event,
    details: declaration.events[0].details.x_details,
  });
}

test("preserves every nested extensible record through successful operations", () => {
  const proposed = extendedProposed();
  assert.equal(validateDeclaration(proposed).ok, true);
  const expected = extensionSnapshot(proposed);
  const successful = {
    amend: (value) =>
      amendDeclaration(
        value,
        { intent: { summary: "Extension-preserving amendment" } },
        "Preserve extensions",
        context("PROPOSED", "extensions_amend"),
      ),
    respond: (value) =>
      recordConsumerResponse(
        value,
        "rsp_extensions_2",
        1,
        "analytics",
        "ACKNOWLEDGED",
        "Still approved",
        context("PROPOSED", "extensions_respond"),
      ),
    accept: (value) =>
      acceptDeclaration(value, context("PROPOSED", "extensions_accept")),
    withdraw: (value) =>
      withdrawDeclaration(
        value,
        "Withdraw extended declaration",
        context("PROPOSED", "extensions_withdraw"),
      ),
    reject: (value) =>
      rejectDeclaration(
        value,
        "Reject extended declaration",
        context("PROPOSED", "extensions_reject"),
      ),
  };

  for (const [operation, invoke] of Object.entries(successful)) {
    const result = invoke(structuredClone(proposed));
    assert.equal(result.ok, true, operation);
    assert.deepEqual(extensionSnapshot(result.value), expected, operation);
  }

  const accepted = successful.accept(structuredClone(proposed));
  assert.equal(accepted.ok, true);
  const enforcing = startEnforcement(accepted.value, {
    actor: "lifecycle-actor",
    at: "2026-07-13T10:01:00Z",
    eventId: "evt_extensions_enforcing",
  });
  assert.equal(enforcing.ok, true);
  assert.deepEqual(extensionSnapshot(enforcing.value), expected);
  const completed = completeDeclaration(enforcing.value, {
    actor: "lifecycle-actor",
    at: "2026-07-13T10:02:00Z",
    eventId: "evt_extensions_completed",
  });
  assert.equal(completed.ok, true);
  assert.deepEqual(extensionSnapshot(completed.value), expected);

  const draft = structuredClone(source);
  addStaticExtensions(draft);
  const draftExpected = extensionSnapshot(draft);
  const proposedResult = proposeDeclaration(
    draft,
    context("DRAFT", "extensions_propose"),
  );
  assert.equal(proposedResult.ok, true);
  assert.deepEqual(extensionSnapshot(proposedResult.value), draftExpected);
});

test("contains malformed contexts, effect arguments, and hostile patches", () => {
  const accepted = declarationIn("ACCEPTED");
  const enforcing = declarationIn("ENFORCING");
  const proposed = proposedWithConsumers([]);
  const malformedContextCalls = [
    () => proposeDeclaration(structuredClone(source), null),
    () =>
      amendDeclaration(
        structuredClone(source),
        { intent: { summary: "Changed" } },
        "Reason",
        null,
      ),
    () =>
      recordConsumerResponse(
        declarationIn("PROPOSED"),
        "rsp_bad_context",
        1,
        "analytics",
        "ACKNOWLEDGED",
        "Approved",
        null,
      ),
    () => acceptDeclaration(proposed, null),
    () => startEnforcement(accepted, null),
    () => completeDeclaration(enforcing, null),
    () => withdrawDeclaration(structuredClone(source), "Reason", null),
    () => rejectDeclaration(declarationIn("PROPOSED"), "Reason", null),
  ];
  for (const invoke of malformedContextCalls) {
    assert.doesNotThrow(() => {
      const result = invoke();
      assert.equal(result.ok, false);
      assert.ok(result.diagnostics.length > 0);
    });
  }

  let contextGetterReads = 0;
  const getterContext = {
    at: "2026-07-13T10:00:00Z",
    eventId: "evt_hostile_context",
  };
  Object.defineProperty(getterContext, "actor", {
    enumerable: true,
    get() {
      contextGetterReads += 1;
      throw new Error("must not execute context getter");
    },
  });
  const contextResult = proposeDeclaration(
    structuredClone(source),
    getterContext,
  );
  assert.equal(contextResult.ok, false);
  assert.equal(contextGetterReads, 0);

  let proxyTraps = 0;
  const proxyPatch = new Proxy(
    {},
    {
      get() {
        proxyTraps += 1;
        throw new Error("must not read proxy patch");
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error("must not enumerate proxy patch");
      },
    },
  );
  const proxyResult = amendDeclaration(
    structuredClone(source),
    proxyPatch,
    "Reason",
    context("DRAFT", "proxy_patch"),
  );
  assert.equal(proxyResult.ok, false);
  assert.equal(proxyTraps, 0);

  let patchGetterReads = 0;
  const getterPatch = {};
  Object.defineProperty(getterPatch, "intent", {
    enumerable: true,
    get() {
      patchGetterReads += 1;
      throw new Error("must not execute patch getter");
    },
  });
  const getterResult = amendDeclaration(
    structuredClone(source),
    getterPatch,
    "Reason",
    context("DRAFT", "getter_patch"),
  );
  assert.equal(getterResult.ok, false);
  assert.equal(patchGetterReads, 0);

  const malformedResponses = [
    [undefined, 1, "analytics", "ACKNOWLEDGED", "Approved"],
    ["rsp_bad_revision", 1n, "analytics", "ACKNOWLEDGED", "Approved"],
    ["rsp_bad_team", 1, null, "ACKNOWLEDGED", "Approved"],
    ["rsp_bad_decision", 1, "analytics", "MAYBE", "Approved"],
    ["rsp_bad_message", 1, "analytics", "ACKNOWLEDGED", undefined],
  ];
  for (const args of malformedResponses) {
    assert.doesNotThrow(() => {
      const result = recordConsumerResponse(
        declarationIn("PROPOSED"),
        ...args,
        context("PROPOSED", String(args[0] ?? "missing_id")),
      );
      assert.equal(result.ok, false);
      assert.ok(result.diagnostics.length > 0);
    });
  }

  for (const result of [
    amendDeclaration(
      structuredClone(source),
      { intent: { summary: "Changed" } },
      undefined,
      context("DRAFT", "missing_amend_reason"),
    ),
    withdrawDeclaration(
      structuredClone(source),
      undefined,
      context("DRAFT", "missing_withdraw_reason"),
    ),
    rejectDeclaration(
      declarationIn("PROPOSED"),
      undefined,
      context("PROPOSED", "missing_reject_reason"),
    ),
  ]) {
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.length > 0);
  }
});

test("validates the declaration before inspecting patch or context", () => {
  let patchReads = 0;
  let contextReads = 0;
  const patch = {};
  const ctx = {};
  Object.defineProperty(patch, "intent", {
    enumerable: true,
    get() {
      patchReads += 1;
      return { summary: "Changed" };
    },
  });
  Object.defineProperty(ctx, "actor", {
    enumerable: true,
    get() {
      contextReads += 1;
      return "actor";
    },
  });

  const result = amendDeclaration({}, patch, "Reason", ctx);
  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.every(
      (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_SCHEMA_INVALID",
    ),
  );
  assert.equal(patchReads, 0);
  assert.equal(contextReads, 0);
});

test("applies only the sanitized amendment patch clone", () => {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, "consumers");
  let inheritedReads = 0;
  Object.defineProperty(Object.prototype, "consumers", {
    configurable: true,
    get() {
      inheritedReads += 1;
      throw new Error("must not read inherited patch properties");
    },
  });

  try {
    const patch = { intent: { summary: "Sanitized patch only" } };
    const result = amendDeclaration(
      structuredClone(source),
      patch,
      "Use sanitized patch",
      context("DRAFT", "sanitized_patch"),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.intent.summary, "Sanitized patch only");
    assert.equal(inheritedReads, 0);
  } finally {
    if (previous === undefined) {
      delete Object.prototype.consumers;
    } else {
      Object.defineProperty(Object.prototype, "consumers", previous);
    }
  }
});
