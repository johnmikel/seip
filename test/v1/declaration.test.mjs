import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  computeChangeId,
  sortChanges,
  validateDeclaration,
} from "../../dist/core/index.js";
import * as declarationCore from "../../dist/core/index.js";

const fixtures = new URL("../fixtures/v1/", import.meta.url);

async function loadFixture(path) {
  return JSON.parse(await readFile(new URL(path, fixtures), "utf8"));
}

function refreshChangeId(change) {
  const result = computeChangeId(change);
  assert.equal(result.ok, true);
  change.change_id = result.value;
}

function declarationWithChange(overrides) {
  const declaration = structuredClone(minimalDeclaration);
  const change = declaration.changes[0];
  Object.assign(change, overrides);
  if (overrides.before === undefined) delete change.before;
  if (overrides.after === undefined) delete change.after;
  refreshChangeId(change);
  return declaration;
}

const minimalDeclaration = await loadFixture("valid/minimal-declaration.json");
minimalDeclaration.changes[0].after = { type: "integer" };
refreshChangeId(minimalDeclaration.changes[0]);

function event(overrides) {
  return {
    event_id: "evt_test_001",
    type: "PROPOSED",
    declaration_revision: 1,
    at: "2026-07-13T10:00:00Z",
    actor: "orders-bot",
    from_status: "DRAFT",
    to_status: "PROPOSED",
    details: {},
    ...overrides,
  };
}

function proposedDeclaration() {
  const declaration = structuredClone(minimalDeclaration);
  declaration.status = "PROPOSED";
  declaration.events.push(event());
  return declaration;
}

function validResponse(overrides = {}) {
  return {
    response_id: "rsp_analytics_001",
    declaration_revision: 1,
    team: "analytics",
    decision: "ACKNOWLEDGED",
    message: "Ready.",
    actor: "analytics-bot",
    at: "2026-07-13T11:00:00Z",
    ...overrides,
  };
}

function validEvidence(declaration, overrides = {}) {
  return {
    evidence_id: "evd_analytics_001",
    declaration_revision: declaration.revision,
    team: "analytics",
    validator_id: "schema-checker",
    change_ids: [declaration.changes[0].change_id],
    source_digests: {},
    result: "PASSED",
    at: "2026-07-13T12:00:00Z",
    summary: "The consumer schema is compatible.",
    ...overrides,
  };
}

function completeDeclaration() {
  const declaration = structuredClone(minimalDeclaration);
  const digestA = "a".repeat(64);
  const digestB = "b".repeat(64);
  declaration.revision = 2;
  declaration.status = "COMPLETED";
  declaration.responses = [
    validResponse({
      response_id: "rsp_analytics_objected",
      declaration_revision: 2,
      decision: "OBJECTED",
      at: "2026-07-13T12:00:00Z",
    }),
    validResponse({
      response_id: "rsp_analytics_acknowledged",
      declaration_revision: 2,
      at: "2026-07-13T14:00:00Z",
    }),
  ];
  declaration.evidence = [
    validEvidence(declaration, { at: "2026-07-13T13:00:00Z" }),
  ];
  declaration.events.push(
    event({
      event_id: "evt_updated_001",
      type: "DECLARATION_UPDATED",
      declaration_revision: 2,
      at: "2026-07-13T10:00:00Z",
      from_status: "DRAFT",
      to_status: "DRAFT",
      details: {
        reason: "Clarify rollout.",
        changed_paths: ["/intent/summary"],
        before_digest: digestA,
        after_digest: digestB,
      },
    }),
    event({
      event_id: "evt_proposed_001",
      declaration_revision: 2,
      at: "2026-07-13T11:00:00Z",
    }),
    event({
      event_id: "evt_response_objected",
      type: "CONSUMER_RESPONDED",
      declaration_revision: 2,
      at: "2026-07-13T12:00:00Z",
      from_status: "PROPOSED",
      to_status: "UNDER_REVIEW",
      details: {
        response_id: "rsp_analytics_objected",
        team: "analytics",
        decision: "OBJECTED",
      },
    }),
    event({
      event_id: "evt_evidence_001",
      type: "EVIDENCE_RECORDED",
      declaration_revision: 2,
      at: "2026-07-13T13:00:00Z",
      from_status: "UNDER_REVIEW",
      to_status: "UNDER_REVIEW",
      details: {
        evidence_id: "evd_analytics_001",
        team: "analytics",
        result: "PASSED",
      },
    }),
    event({
      event_id: "evt_response_acknowledged",
      type: "CONSUMER_RESPONDED",
      declaration_revision: 2,
      at: "2026-07-13T14:00:00Z",
      from_status: "UNDER_REVIEW",
      to_status: "UNDER_REVIEW",
      details: {
        response_id: "rsp_analytics_acknowledged",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
    event({
      event_id: "evt_accepted_001",
      type: "ACCEPTED",
      declaration_revision: 2,
      at: "2026-07-13T15:00:00Z",
      from_status: "UNDER_REVIEW",
      to_status: "ACCEPTED",
    }),
    event({
      event_id: "evt_enforcing_001",
      type: "ENFORCING",
      declaration_revision: 2,
      at: "2026-07-13T16:00:00Z",
      from_status: "ACCEPTED",
      to_status: "ENFORCING",
    }),
    event({
      event_id: "evt_completed_001",
      type: "COMPLETED",
      declaration_revision: 2,
      at: "2026-07-13T17:00:00Z",
      from_status: "ENFORCING",
      to_status: "COMPLETED",
    }),
  );
  return declaration;
}

function acceptanceDeclaration({
  consumerTeams = ["analytics"],
  decisions = [],
  updateAfterResponses = false,
} = {}) {
  const declaration = proposedDeclaration();
  declaration.consumers = consumerTeams.map((team) => ({
    team,
    dependencies: [`${team}-api`],
  }));

  let currentRevision = 1;
  let currentStatus = "PROPOSED";
  let nextHour = 11;
  const timestamp = () =>
    `2026-07-13T${String(nextHour++).padStart(2, "0")}:00:00Z`;

  decisions.forEach(({ team, decision }, index) => {
    const response = validResponse({
      response_id: `rsp_${team}_${index + 1}`,
      declaration_revision: currentRevision,
      team,
      decision,
      at: timestamp(),
    });
    declaration.responses.push(response);

    const toStatus =
      currentStatus === "PROPOSED" && decision !== "ACKNOWLEDGED"
        ? "UNDER_REVIEW"
        : currentStatus;
    declaration.events.push(
      event({
        event_id: `evt_response_${team}_${index + 1}`,
        type: "CONSUMER_RESPONDED",
        declaration_revision: currentRevision,
        at: response.at,
        from_status: currentStatus,
        to_status: toStatus,
        details: {
          response_id: response.response_id,
          team,
          decision,
        },
      }),
    );
    currentStatus = toStatus;
  });

  if (updateAfterResponses) {
    currentRevision += 1;
    declaration.events.push(
      event({
        event_id: "evt_updated_before_acceptance",
        type: "DECLARATION_UPDATED",
        declaration_revision: currentRevision,
        at: timestamp(),
        from_status: currentStatus,
        to_status: currentStatus,
        details: {
          reason: "Clarify rollout.",
          changed_paths: ["/intent/summary"],
          before_digest: "a".repeat(64),
          after_digest: "b".repeat(64),
        },
      }),
    );
  }

  declaration.events.push(
    event({
      event_id: "evt_accepted_precondition",
      type: "ACCEPTED",
      declaration_revision: currentRevision,
      at: timestamp(),
      from_status: currentStatus,
      to_status: "ACCEPTED",
    }),
  );
  declaration.revision = currentRevision;
  declaration.status = "ACCEPTED";
  return declaration;
}

function createInput() {
  const source = structuredClone(minimalDeclaration);
  const orderChange = source.changes[0];
  orderChange.change_extension = { owner: "orders" };
  orderChange.target.target_extension = ["orders"];
  const accountChange = structuredClone(orderChange);
  accountChange.target.object = "Account";
  accountChange.change_extension = { owner: "accounts" };
  accountChange.target.target_extension = ["accounts"];
  refreshChangeId(accountChange);

  source.producer.producer_extension = { channel: "orders" };
  source.intent.intent_extension = { ticket: 42 };
  source.intent.migration.migration_extension = { mode: "dual-read" };
  source.intent.timeline.timeline_extension = { timezone: "UTC" };
  source.consumers[0].consumer_extension = { priority: 1 };

  return {
    protocol_version: source.protocol_version,
    declaration_id: source.declaration_id,
    producer: source.producer,
    changes: [orderChange, accountChange],
    intent: source.intent,
    consumers: source.consumers,
    actor: "orders-bot",
    root_extension: { nested: [true, null, "kept"] },
  };
}

test("validateDeclaration is total over null", () => {
  assert.deepEqual(validateDeclaration(null), {
    ok: false,
    diagnostics: [
      {
        code: "SEIP_PROTOCOL_SCHEMA_INVALID",
        severity: "error",
        message: "must be object",
      },
    ],
  });
});

test("accepts a schema-valid minimal declaration with exact fingerprints", () => {
  assert.deepEqual(validateDeclaration(minimalDeclaration), {
    ok: true,
    value: minimalDeclaration,
    diagnostics: [],
  });
});

test("is total over arbitrary primitives, arrays, and null array entries", () => {
  for (const value of [
    undefined,
    false,
    0,
    1n,
    "declaration",
    Symbol("declaration"),
    () => undefined,
    [],
    [null],
    { changes: [null], consumers: [null], events: [null] },
  ]) {
    let result;
    assert.doesNotThrow(() => {
      result = validateDeclaration(value);
    });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.length > 0);
  }
});

test("rejects schema-invalid fixtures through the generated validator", async () => {
  for (const path of [
    "invalid/consumer-status.json",
    "invalid/invalid-created-at.json",
    "invalid/missing-change-id.json",
  ]) {
    const result = validateDeclaration(await loadFixture(path));
    assert.equal(result.ok, false, path);
    assert.ok(
      result.diagnostics.every(
        (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_SCHEMA_INVALID",
      ),
      path,
    );
  }
});

test("rejects unsupported stable protocol versions", () => {
  const declaration = structuredClone(minimalDeclaration);
  declaration.protocol_version = "2.0.0";

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    {
      code: "SEIP_PROTOCOL_VERSION_UNSUPPORTED",
      severity: "error",
      message: "Protocol version must be a stable 1.x.y release.",
      path: "/protocol_version",
    },
  ]);
});

test("never counts a schema-valid declaration with a forged fingerprint as valid", () => {
  const declaration = structuredClone(minimalDeclaration);
  declaration.changes[0].after = { type: "string" };

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some(
      (item) =>
        item.code === "SEIP_PROTOCOL_CHANGE_ID_MISMATCH" &&
        item.path === "/changes/0/change_id",
    ),
  );
});

test("enforces every projected declaration identity and consumer team", () => {
  const cases = [
    ["changes", "change_id"],
    ["consumers", "team"],
    ["responses", "response_id"],
    ["evidence", "evidence_id"],
    ["events", "event_id"],
  ];

  for (const [field, key] of cases) {
    const declaration = structuredClone(minimalDeclaration);
    if (field === "consumers") {
      declaration.consumers.push({
        ...structuredClone(declaration.consumers[0]),
        contact: "different@example.com",
      });
    } else if (field === "changes") {
      declaration.changes.push({
        ...structuredClone(declaration.changes[0]),
        compatibility: "breaking",
      });
    } else if (field === "responses") {
      const response = {
        response_id: "rsp_analytics_001",
        declaration_revision: 1,
        team: "analytics",
        decision: "ACKNOWLEDGED",
        message: "Ready.",
        actor: "analytics-bot",
        at: "2026-07-14T09:00:00Z",
      };
      declaration.responses.push(response, { ...response, message: "Also ready." });
    } else if (field === "evidence") {
      const evidence = {
        evidence_id: "evd_analytics_001",
        declaration_revision: 1,
        team: "analytics",
        validator_id: "schema-checker",
        change_ids: [declaration.changes[0].change_id],
        source_digests: {},
        result: "PASSED",
        at: "2026-07-14T09:00:00Z",
        summary: "Ready.",
      };
      declaration.evidence.push(evidence, { ...evidence, summary: "Also ready." });
    } else {
      declaration.events.push({
        ...structuredClone(declaration.events[0]),
        actor: "another-actor",
      });
    }

    const result = validateDeclaration(declaration);
    assert.equal(result.ok, false, field);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) => diagnostic.path === `/${field}/1/${key}`,
      ),
      field,
    );
  }
});

test("enforces the approved semantic rules for standard change kinds", () => {
  const cases = [
    [
      declarationWithChange({
        kind: "object_add",
        after: { type: "string" },
      }),
      "/changes/0/target/path",
    ],
    [
      declarationWithChange({
        kind: "object_remove",
        before: { type: "string" },
        after: undefined,
      }),
      "/changes/0/target/path",
    ],
    [
      declarationWithChange({
        kind: "rename",
        before: { name: "state" },
        after: { name: "state" },
      }),
      "/changes/0/after/name",
    ],
    [
      declarationWithChange({
        kind: "retype",
        before: { previous_type: "string" },
        after: { type: "integer" },
      }),
      "/changes/0/before/type",
    ],
    [
      declarationWithChange({
        kind: "make_required",
        before: { required: false },
        after: { required: false },
      }),
      "/changes/0/after/required",
    ],
    [
      declarationWithChange({
        kind: "make_non_nullable",
        before: { nullable: true },
        after: { nullable: true },
      }),
      "/changes/0/after/nullable",
    ],
    [
      declarationWithChange({
        kind: "enum_narrow",
        before: { enum: ["pending", "paid"] },
        after: {
          enum: [{ kind: "string", value: "paid" }],
        },
      }),
      "/changes/0/before/enum/0",
    ],
    [
      declarationWithChange({
        kind: "format_change",
        before: { format: "uuid" },
        after: { format: "uuid" },
      }),
      "/changes/0/after/format",
    ],
    [
      declarationWithChange({
        kind: "deprecate",
        before: { deprecated: false },
        after: { deprecated: false },
      }),
      "/changes/0/after/deprecated",
    ],
  ];

  for (const [declaration, expectedPath] of cases) {
    const result = validateDeclaration(declaration);
    assert.equal(result.ok, false, expectedPath);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_PROTOCOL_CHANGE_INVALID" &&
          diagnostic.path === expectedPath,
      ),
      expectedPath,
    );
  }
});

test("requires canonical enum arrays to be sorted and duplicate-free", () => {
  const declaration = declarationWithChange({
    kind: "enum_widen",
    before: {
      enum: [
        { kind: "string", value: "z" },
        { kind: "string", value: "a" },
      ],
    },
    after: {
      enum: [{ kind: "string", value: "z" }],
    },
  });

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_PROTOCOL_CHANGE_INVALID" &&
        diagnostic.path === "/changes/0/before/enum",
    ),
  );
});

test("rejects enum CanonicalValue tags unless recursively canonical", async (t) => {
  const invalidValues = [
    [
      "unsorted object entries",
      {
        kind: "object",
        entries: [
          { key: "z", value: { kind: "null" } },
          { key: "a", value: { kind: "null" } },
        ],
      },
    ],
    [
      "duplicate object entries",
      {
        kind: "object",
        entries: [
          { key: "same", value: { kind: "null" } },
          { key: "same", value: { kind: "boolean", value: true } },
        ],
      },
    ],
    [
      "nested unsorted object entries",
      {
        kind: "array",
        items: [
          {
            kind: "object",
            entries: [
              { key: "z", value: { kind: "null" } },
              { key: "a", value: { kind: "null" } },
            ],
          },
        ],
      },
    ],
    ["a noncanonical decimal", { kind: "number", decimal: "1.0" }],
    [
      "extra tag fields",
      { kind: "string", value: "paid", extension: true },
    ],
    [
      "a malformed nested tag",
      {
        kind: "array",
        items: [{ kind: "boolean", value: "true" }],
      },
    ],
  ];

  for (const [name, value] of invalidValues) {
    await t.test(name, () => {
      const declaration = declarationWithChange({
        kind: "enum_widen",
        before: { enum: [{ kind: "string", value: "pending" }] },
        after: { enum: [{ kind: "string", value: "paid" }] },
      });
      declaration.changes[0].before = { enum: [value] };
      const changeId = computeChangeId(declaration.changes[0]);
      if (changeId.ok) declaration.changes[0].change_id = changeId.value;

      const result = validateDeclaration(declaration);

      assert.equal(result.ok, false);
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "SEIP_PROTOCOL_CHANGE_INVALID" ||
            diagnostic.code === "SEIP_PROTOCOL_SCHEMA_INVALID",
        ),
      );
    });
  }

  await t.test("accepts deeply nested tags with sorted object entries", () => {
    const canonicalValue = {
      kind: "object",
      entries: [
        {
          key: "alpha",
          value: {
            kind: "array",
            items: [
              { kind: "null" },
              { kind: "number", decimal: "125e-2" },
            ],
          },
        },
        {
          key: "omega",
          value: {
            kind: "object",
            entries: [
              { key: "enabled", value: { kind: "boolean", value: true } },
              { key: "label", value: { kind: "string", value: "paid" } },
            ],
          },
        },
      ],
    };
    const declaration = declarationWithChange({
      kind: "enum_widen",
      before: { enum: [canonicalValue] },
      after: { enum: [canonicalValue] },
    });

    assert.equal(validateDeclaration(declaration).ok, true);
  });
});

test("enforces target, deprecation, and removal order when both later dates exist", () => {
  const declaration = structuredClone(minimalDeclaration);
  declaration.intent.timeline = {
    ...declaration.intent.timeline,
    target_enforcement_at: "2026-08-03T09:00:00Z",
    deprecation_at: "2026-08-02T09:00:00Z",
    removal_at: "2026-08-01T09:00:00Z",
  };

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.diagnostics.map(({ code, path }) => ({ code, path })),
    [
      {
        code: "SEIP_PROTOCOL_TIMELINE_INVALID",
        path: "/intent/timeline/deprecation_at",
      },
      {
        code: "SEIP_PROTOCOL_TIMELINE_INVALID",
        path: "/intent/timeline/removal_at",
      },
    ],
  );
});

test("aggregates and deterministically orders independent semantic diagnostics", () => {
  const declaration = declarationWithChange({
    kind: "object_add",
    after: { type: "string" },
  });
  declaration.protocol_version = "2.0.0";
  declaration.intent.timeline = {
    ...declaration.intent.timeline,
    target_enforcement_at: "2026-08-03T09:00:00Z",
    deprecation_at: "2026-08-02T09:00:00Z",
    removal_at: "2026-09-01T09:00:00Z",
  };

  const first = validateDeclaration(declaration);
  const second = validateDeclaration(declaration);

  assert.equal(first.ok, false);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.diagnostics.map(({ code, path }) => ({ code, path })),
    [
      {
        code: "SEIP_PROTOCOL_CHANGE_INVALID",
        path: "/changes/0/target/path",
      },
      {
        code: "SEIP_PROTOCOL_TIMELINE_INVALID",
        path: "/intent/timeline/deprecation_at",
      },
      {
        code: "SEIP_PROTOCOL_VERSION_UNSUPPORTED",
        path: "/protocol_version",
      },
    ],
  );
});

test("replays a complete lifecycle including the review-escalating response exception", () => {
  const declaration = completeDeclaration();

  assert.deepEqual(validateDeclaration(declaration), {
    ok: true,
    value: declaration,
    diagnostics: [],
  });
});

test("requires every consumer's latest current-revision response before acceptance", async (t) => {
  const invalidCases = [
    ["one consumer with no response", acceptanceDeclaration()],
    [
      "multiple consumers with no responses",
      acceptanceDeclaration({ consumerTeams: ["analytics", "risk"] }),
    ],
    [
      "a latest OBJECTED response",
      acceptanceDeclaration({
        decisions: [
          { team: "analytics", decision: "ACKNOWLEDGED" },
          { team: "analytics", decision: "OBJECTED" },
        ],
      }),
    ],
    [
      "a latest EXTENSION_REQUESTED response",
      acceptanceDeclaration({
        decisions: [
          { team: "analytics", decision: "ACKNOWLEDGED" },
          { team: "analytics", decision: "EXTENSION_REQUESTED" },
        ],
      }),
    ],
    [
      "a stale acknowledgement from a prior revision",
      acceptanceDeclaration({
        decisions: [{ team: "analytics", decision: "ACKNOWLEDGED" }],
        updateAfterResponses: true,
      }),
    ],
    [
      "partial acknowledgements",
      acceptanceDeclaration({
        consumerTeams: ["analytics", "risk"],
        decisions: [{ team: "analytics", decision: "ACKNOWLEDGED" }],
      }),
    ],
  ];

  for (const [name, declaration] of invalidCases) {
    await t.test(name, () => {
      const acceptedIndex = declaration.events.length - 1;
      const result = validateDeclaration(declaration);

      assert.equal(result.ok, false);
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION" &&
            diagnostic.path === `/events/${acceptedIndex}/type`,
        ),
      );
    });
  }

  await t.test("accepts a declaration with zero consumers", () => {
    const declaration = acceptanceDeclaration({ consumerTeams: [] });

    assert.equal(validateDeclaration(declaration).ok, true);
  });

  await t.test("accepts when every latest current-revision response acknowledges", () => {
    const declaration = acceptanceDeclaration({
      consumerTeams: ["analytics", "risk"],
      decisions: [
        { team: "analytics", decision: "ACKNOWLEDGED" },
        { team: "risk", decision: "ACKNOWLEDGED" },
      ],
    });

    assert.equal(validateDeclaration(declaration).ok, true);
  });

  await t.test("does not infer acceptance from acknowledgements", () => {
    const declaration = acceptanceDeclaration({
      decisions: [{ team: "analytics", decision: "ACKNOWLEDGED" }],
    });
    declaration.events.pop();
    declaration.status = "PROPOSED";

    const result = validateDeclaration(declaration);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, "PROPOSED");
  });

  await t.test("aggregates the acceptance diagnostic with independent replay failures", () => {
    const declaration = acceptanceDeclaration();
    declaration.revision = 2;

    const result = validateDeclaration(declaration);

    assert.equal(result.ok, false);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_LIFECYCLE_ACCEPTANCE_PRECONDITION" &&
          diagnostic.path === "/events/2/type",
      ),
    );
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_LIFECYCLE_REVISION_INVALID" &&
          diagnostic.path === "/revision",
      ),
    );
  });
});

test("accepts response history from every valid declaration revision", () => {
  const declaration = proposedDeclaration();
  declaration.responses.push(validResponse());
  declaration.events.push(
    event({
      event_id: "evt_response_001",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        response_id: "rsp_analytics_001",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
    event({
      event_id: "evt_updated_001",
      type: "DECLARATION_UPDATED",
      declaration_revision: 2,
      at: "2026-07-13T12:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        reason: "Clarify rollout.",
        changed_paths: ["/intent/summary"],
        before_digest: "a".repeat(64),
        after_digest: "b".repeat(64),
      },
    }),
  );
  declaration.revision = 2;

  assert.equal(validateDeclaration(declaration).ok, true);
});

test("rejects undeclared teams, undeclared changes, and future revisions", () => {
  const declaration = proposedDeclaration();
  declaration.responses.push(
    validResponse({ declaration_revision: 2, team: "risk" }),
  );
  declaration.evidence.push(
    validEvidence(declaration, {
      team: "risk",
      change_ids: [`chg_sha256_${"0".repeat(64)}`],
    }),
  );
  declaration.events.push(
    event({
      event_id: "evt_response_001",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        response_id: "rsp_analytics_001",
        team: "risk",
        decision: "ACKNOWLEDGED",
      },
    }),
    event({
      event_id: "evt_evidence_001",
      type: "EVIDENCE_RECORDED",
      at: "2026-07-13T12:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        evidence_id: "evd_analytics_001",
        team: "risk",
        result: "PASSED",
      },
    }),
  );

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  for (const expectedPath of [
    "/evidence/0/change_ids/0",
    "/evidence/0/team",
    "/responses/0/declaration_revision",
    "/responses/0/team",
  ]) {
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_PROTOCOL_REFERENCE_INVALID" &&
          diagnostic.path === expectedPath,
      ),
      expectedPath,
    );
  }
});

test("requires independent response, evidence, and event append chronology", () => {
  const declaration = proposedDeclaration();
  declaration.responses.push(
    validResponse({
      response_id: "rsp_analytics_later",
      at: "2026-07-13T16:00:00Z",
    }),
    validResponse({
      response_id: "rsp_analytics_earlier",
      at: "2026-07-13T15:00:00Z",
    }),
  );
  declaration.evidence.push(
    validEvidence(declaration, {
      evidence_id: "evd_analytics_later",
      at: "2026-07-13T16:00:00Z",
    }),
    validEvidence(declaration, {
      evidence_id: "evd_analytics_earlier",
      at: "2026-07-13T15:00:00Z",
    }),
  );
  declaration.events.push(
    event({
      event_id: "evt_response_later",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        response_id: "rsp_analytics_later",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
    event({
      event_id: "evt_response_earlier",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T12:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        response_id: "rsp_analytics_earlier",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
    event({
      event_id: "evt_evidence_later",
      type: "EVIDENCE_RECORDED",
      at: "2026-07-13T13:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        evidence_id: "evd_analytics_later",
        team: "analytics",
        result: "PASSED",
      },
    }),
    event({
      event_id: "evt_evidence_earlier",
      type: "EVIDENCE_RECORDED",
      at: "2026-07-13T14:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        evidence_id: "evd_analytics_earlier",
        team: "analytics",
        result: "PASSED",
      },
    }),
  );

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.diagnostics
      .filter((diagnostic) => diagnostic.code === "SEIP_PROTOCOL_CHRONOLOGY_INVALID")
      .map((diagnostic) => diagnostic.path),
    ["/evidence/1/at", "/responses/1/at"],
  );

  const badEvents = proposedDeclaration();
  badEvents.events[1].at = "2026-07-13T08:59:59Z";
  assert.ok(
    validateDeclaration(badEvents).diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_PROTOCOL_CHRONOLOGY_INVALID" &&
        diagnostic.path === "/events/1/at",
    ),
  );
});

test("compares RFC 3339 chronology by instant and permits equality", () => {
  const declaration = proposedDeclaration();
  declaration.events[1].at = "2026-07-13T10:00:00+01:00";

  assert.equal(validateDeclaration(declaration).ok, true);
});

test("enforces creation, chaining, transition, revision, terminal, and latest-status replay", () => {
  const noCreated = structuredClone(minimalDeclaration);
  noCreated.events = [];

  const duplicateCreated = structuredClone(minimalDeclaration);
  duplicateCreated.events.push({
    ...structuredClone(duplicateCreated.events[0]),
    event_id: "evt_created_002",
    at: "2026-07-13T10:00:00Z",
  });

  const badCreated = structuredClone(minimalDeclaration);
  Object.assign(badCreated.events[0], {
    declaration_revision: 2,
    from_status: "DRAFT",
    to_status: "PROPOSED",
  });
  badCreated.status = "PROPOSED";

  const badChain = proposedDeclaration();
  badChain.events[1].from_status = "UNDER_REVIEW";

  const badTransition = structuredClone(minimalDeclaration);
  badTransition.status = "ACCEPTED";
  badTransition.events.push(
    event({
      event_id: "evt_accepted_001",
      type: "ACCEPTED",
      from_status: "DRAFT",
      to_status: "ACCEPTED",
    }),
  );

  const badUpdate = structuredClone(minimalDeclaration);
  badUpdate.revision = 2;
  badUpdate.status = "PROPOSED";
  badUpdate.events.push(
    event({
      event_id: "evt_updated_001",
      type: "DECLARATION_UPDATED",
      declaration_revision: 2,
      from_status: "DRAFT",
      to_status: "PROPOSED",
      details: {
        reason: "Clarify rollout.",
        changed_paths: ["/intent/summary"],
        before_digest: "a".repeat(64),
        after_digest: "b".repeat(64),
      },
    }),
  );

  const badRevision = proposedDeclaration();
  badRevision.events[1].declaration_revision = 2;

  const badRootRevision = structuredClone(minimalDeclaration);
  badRootRevision.revision = 2;

  const badStatus = proposedDeclaration();
  badStatus.status = "DRAFT";

  const afterTerminal = completeDeclaration();
  afterTerminal.events.push(
    event({
      event_id: "evt_evidence_after_terminal",
      type: "EVIDENCE_RECORDED",
      declaration_revision: 2,
      at: "2026-07-13T18:00:00Z",
      from_status: "COMPLETED",
      to_status: "COMPLETED",
      details: {
        evidence_id: "evd_after_terminal",
        team: "analytics",
        result: "PASSED",
      },
    }),
  );
  afterTerminal.evidence.push(
    validEvidence(afterTerminal, {
      evidence_id: "evd_after_terminal",
      at: "2026-07-13T18:00:00Z",
    }),
  );

  const cases = [
    [noCreated, "SEIP_LIFECYCLE_EVENT_INVALID", "/events"],
    [duplicateCreated, "SEIP_LIFECYCLE_EVENT_INVALID", "/events/1/type"],
    [badCreated, "SEIP_LIFECYCLE_EVENT_INVALID", "/events/0/declaration_revision"],
    [badChain, "SEIP_LIFECYCLE_EVENT_INVALID", "/events/1/from_status"],
    [badTransition, "SEIP_LIFECYCLE_INVALID_TRANSITION", "/events/1/type"],
    [badUpdate, "SEIP_LIFECYCLE_INVALID_TRANSITION", "/events/1/to_status"],
    [badRevision, "SEIP_LIFECYCLE_REVISION_INVALID", "/events/1/declaration_revision"],
    [badRootRevision, "SEIP_LIFECYCLE_REVISION_INVALID", "/revision"],
    [badStatus, "SEIP_LIFECYCLE_STATUS_MISMATCH", "/status"],
    [afterTerminal, "SEIP_LIFECYCLE_EVENT_INVALID", "/events/9/type"],
  ];

  for (const [declaration, code, path] of cases) {
    const result = validateDeclaration(declaration);
    assert.equal(result.ok, false, path);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === code && diagnostic.path === path,
      ),
      `${code} ${path}`,
    );
  }
});

test("allows only the approved response-driven UNDER_REVIEW transition", () => {
  const declaration = proposedDeclaration();
  declaration.status = "UNDER_REVIEW";
  declaration.responses.push(validResponse());
  declaration.events.push(
    event({
      event_id: "evt_response_001",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "UNDER_REVIEW",
      details: {
        response_id: "rsp_analytics_001",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
  );

  const result = validateDeclaration(declaration);

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_LIFECYCLE_INVALID_TRANSITION" &&
        diagnostic.path === "/events/2/to_status",
    ),
  );
});

test("requires a bijection between responses, evidence, and recording events", () => {
  const missing = proposedDeclaration();
  missing.responses.push(validResponse());

  const orphan = proposedDeclaration();
  orphan.events.push(
    event({
      event_id: "evt_response_orphan",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "PROPOSED",
      details: {
        response_id: "rsp_orphan",
        team: "analytics",
        decision: "ACKNOWLEDGED",
      },
    }),
  );

  const duplicate = proposedDeclaration();
  duplicate.responses.push(validResponse());
  for (const suffix of ["one", "two"]) {
    duplicate.events.push(
      event({
        event_id: `evt_response_${suffix}`,
        type: "CONSUMER_RESPONDED",
        at:
          suffix === "one"
            ? "2026-07-13T11:00:00Z"
            : "2026-07-13T12:00:00Z",
        from_status: "PROPOSED",
        to_status: "PROPOSED",
        details: {
          response_id: "rsp_analytics_001",
          team: "analytics",
          decision: "ACKNOWLEDGED",
        },
      }),
    );
  }

  const cases = [
    [missing, "/responses/0/response_id"],
    [orphan, "/events/2/details/response_id"],
    [duplicate, "/events/3/details/response_id"],
  ];
  for (const [declaration, path] of cases) {
    const result = validateDeclaration(declaration);
    assert.equal(result.ok, false, path);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_PROTOCOL_EVENT_LINK_INVALID" &&
          diagnostic.path === path,
      ),
      path,
    );
  }

  const mismatched = proposedDeclaration();
  mismatched.status = "UNDER_REVIEW";
  mismatched.responses.push(validResponse());
  mismatched.evidence.push(validEvidence(mismatched));
  mismatched.events.push(
    event({
      event_id: "evt_response_mismatch",
      type: "CONSUMER_RESPONDED",
      at: "2026-07-13T11:00:00Z",
      from_status: "PROPOSED",
      to_status: "UNDER_REVIEW",
      details: {
        response_id: "rsp_analytics_001",
        team: "analytics",
        decision: "OBJECTED",
      },
    }),
    event({
      event_id: "evt_evidence_mismatch",
      type: "EVIDENCE_RECORDED",
      at: "2026-07-13T12:00:00Z",
      from_status: "UNDER_REVIEW",
      to_status: "UNDER_REVIEW",
      details: {
        evidence_id: "evd_analytics_001",
        team: "analytics",
        result: "FAILED",
      },
    }),
  );
  const mismatchResult = validateDeclaration(mismatched);
  assert.equal(mismatchResult.ok, false);
  for (const path of [
    "/events/2/details/decision",
    "/events/3/details/result",
  ]) {
    assert.ok(
      mismatchResult.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SEIP_PROTOCOL_EVENT_LINK_INVALID" &&
          diagnostic.path === path,
      ),
      path,
    );
  }
});

test("rejects proxies, accessors, and cycles without invoking hostile code", () => {
  let getterInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "protocol_version", {
    enumerable: true,
    get() {
      getterInvoked = true;
      throw new Error("must not execute");
    },
  });
  const cycle = {};
  cycle.self = cycle;
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error("must not execute");
      },
    },
  );

  for (const value of [accessor, cycle, proxy]) {
    let result;
    assert.doesNotThrow(() => {
      result = validateDeclaration(value);
    });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "SEIP_PROTOCOL_SCHEMA_INVALID");
  }
  assert.equal(getterInvoked, false);

  const inherited = declarationWithChange({
    kind: "make_nullable",
    before: {},
    after: { nullable: true },
  });
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, "nullable");
  Object.defineProperty(Object.prototype, "nullable", {
    configurable: true,
    get() {
      getterInvoked = true;
      throw new Error("must not execute inherited accessors");
    },
  });
  try {
    let result;
    assert.doesNotThrow(() => {
      result = validateDeclaration(inherited);
    });
    assert.equal(result.ok, false);
  } finally {
    if (previous === undefined) {
      delete Object.prototype.nullable;
    } else {
      Object.defineProperty(Object.prototype, "nullable", previous);
    }
  }
  assert.equal(getterInvoked, false);
});

test("constructs a deterministic draft with explicit effects and sorted changes", () => {
  const input = createInput();
  Object.assign(input, {
    created_at: "1900-01-01T00:00:00Z",
    revision: 99,
    status: "COMPLETED",
    responses: [{ ignored: true }],
    evidence: [{ ignored: true }],
    events: [{ ignored: true }],
  });
  const context = {
    createdAt: "2026-07-13T09:00:00Z",
    createdEventId: "evt_created_deterministic",
    ignoredContextExtension: true,
  };
  const inputBefore = structuredClone(input);
  const contextBefore = structuredClone(context);

  const first = declarationCore.createDeclaration(input, context);
  const second = declarationCore.createDeclaration(input, context);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(context, contextBefore);
  assert.equal(first.value.created_at, context.createdAt);
  assert.equal(first.value.revision, 1);
  assert.equal(first.value.status, "DRAFT");
  assert.deepEqual(first.value.responses, []);
  assert.deepEqual(first.value.evidence, []);
  assert.deepEqual(first.value.events, [
    {
      event_id: context.createdEventId,
      type: "CREATED",
      declaration_revision: 1,
      at: context.createdAt,
      actor: input.actor,
      from_status: null,
      to_status: "DRAFT",
      details: {},
    },
  ]);
  assert.equal(Object.hasOwn(first.value, "actor"), false);

  const sorted = sortChanges(input.changes);
  assert.equal(sorted.ok, true);
  assert.deepEqual(first.value.changes, sorted.value);
});

test("preserves every supplied extensible declaration record", () => {
  const input = createInput();
  const result = declarationCore.createDeclaration(input, {
    createdAt: "2026-07-13T09:00:00Z",
    createdEventId: "evt_created_extensions",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.root_extension, input.root_extension);
  assert.deepEqual(result.value.producer, input.producer);
  assert.deepEqual(result.value.intent, input.intent);
  assert.deepEqual(result.value.consumers, input.consumers);
  for (const inputChange of input.changes) {
    const outputChange = result.value.changes.find(
      (change) => change.change_id === inputChange.change_id,
    );
    assert.ok(outputChange);
    assert.deepEqual(outputChange.change_extension, inputChange.change_extension);
    assert.deepEqual(outputChange.target, inputChange.target);
  }
});

test("validates the completed declaration before creation succeeds", () => {
  const invalidTime = declarationCore.createDeclaration(createInput(), {
    createdAt: "not-a-time",
    createdEventId: "evt_created_invalid_time",
  });
  assert.equal(invalidTime.ok, false);
  assert.ok(
    invalidTime.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_PROTOCOL_SCHEMA_INVALID" &&
        diagnostic.path === "/created_at",
    ),
  );

  const unsupported = createInput();
  unsupported.protocol_version = "2.0.0";
  const unsupportedResult = declarationCore.createDeclaration(unsupported, {
    createdAt: "2026-07-13T09:00:00Z",
    createdEventId: "evt_created_unsupported",
  });
  assert.equal(unsupportedResult.ok, false);
  assert.ok(
    unsupportedResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "SEIP_PROTOCOL_VERSION_UNSUPPORTED" &&
        diagnostic.path === "/protocol_version",
    ),
  );

  const forged = createInput();
  forged.changes[0].after = { type: "string" };
  const forgedResult = declarationCore.createDeclaration(forged, {
    createdAt: "2026-07-13T09:00:00Z",
    createdEventId: "evt_created_forged",
  });
  assert.equal(forgedResult.ok, false);
  assert.ok(
    forgedResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "SEIP_PROTOCOL_CHANGE_ID_MISMATCH",
    ),
  );
});

test("creation is total for hostile input and context values", () => {
  const input = createInput();
  const cycle = {};
  cycle.self = cycle;
  const proxy = new Proxy({}, {});

  for (const [candidateInput, candidateContext] of [
    [null, { createdAt: "2026-07-13T09:00:00Z", createdEventId: "evt_null" }],
    [cycle, { createdAt: "2026-07-13T09:00:00Z", createdEventId: "evt_cycle" }],
    [input, proxy],
  ]) {
    let result;
    assert.doesNotThrow(() => {
      result = declarationCore.createDeclaration(candidateInput, candidateContext);
    });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.length > 0);
  }
});
