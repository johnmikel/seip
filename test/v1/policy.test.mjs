import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  acceptDeclaration,
  amendDeclaration,
  completeDeclaration,
  computeChangeId,
  evaluatePolicy,
  proposeDeclaration,
  recordConsumerResponse,
  rejectDeclaration,
  startEnforcement,
  validateDeclaration,
  withdrawDeclaration,
} from "../../dist/core/index.js";

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/v1/valid/minimal-declaration.json", import.meta.url),
    "utf8",
  ),
);

test("exports the pure policy evaluator", () => {
  assert.equal(typeof evaluatePolicy, "function");
});

function compatibleChange() {
  const change = {
    change_id: "",
    fingerprint_version: "1",
    schema_kind: "json-schema",
    target: {
      object: "Order",
      path: [{ type: "property", name: "reference" }],
    },
    kind: "add",
    compatibility: "compatible",
    after: { type: "string" },
  };
  const fingerprint = computeChangeId(change);
  assert.equal(fingerprint.ok, true);
  change.change_id = fingerprint.value;
  return change;
}

function detection(overrides = {}) {
  return {
    ok: true,
    completeness: "complete",
    changes: [compatibleChange()],
    diagnostics: [],
    detector: {
      id: "json-schema",
      version: "1.0.0",
      mode: "builtin",
    },
    source_digests: {
      before: "a".repeat(64),
      after: "b".repeat(64),
    },
    ...overrides,
  };
}

function policyInput(overrides = {}) {
  return {
    preset: "advisory",
    detection: detection(),
    detector_trust: { trusted: true, mode: "builtin" },
    declarations: [],
    evidence: {
      mode: "none",
      trusted_validator_ids: [],
    },
    ...overrides,
  };
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

function jsonContent(value) {
  return JSON.parse(JSON.stringify(value));
}

function fingerprintedChange(change) {
  const candidate = { change_id: "", fingerprint_version: "1", ...change };
  const fingerprint = computeChangeId(candidate);
  assert.equal(fingerprint.ok, true);
  candidate.change_id = fingerprint.value;
  return candidate;
}

function breakingRemoval(name = "legacy_status") {
  return fingerprintedChange({
    schema_kind: "json-schema",
    target: {
      object: "Order",
      path: [{ type: "property", name }],
    },
    kind: "remove",
    compatibility: "breaking",
    before: { type: "string" },
  });
}

function breakingRetype(before, after) {
  return fingerprintedChange({
    schema_kind: "json-schema",
    target: {
      object: "Order",
      path: [{ type: "property", name: "legacy_status" }],
    },
    kind: "retype",
    compatibility: "breaking",
    before: { type: before },
    after: { type: after },
  });
}

function context(id, minute) {
  return {
    actor: "policy-test",
    at: `2026-07-13T10:${String(minute).padStart(2, "0")}:00Z`,
    eventId: `evt_policy_${id}`,
  };
}

function draftDeclaration(change, declarationId = "decl_policy") {
  return draftWithChanges([change], declarationId);
}

function draftWithChanges(
  changes,
  declarationId = "decl_policy",
  consumers = fixture.consumers,
) {
  const declaration = structuredClone(fixture);
  declaration.declaration_id = declarationId;
  declaration.changes = structuredClone(changes);
  declaration.consumers = structuredClone(consumers);
  const validation = validateDeclaration(declaration);
  assert.equal(validation.ok, true, declarationId);
  return declaration;
}

function transition(result, label) {
  assert.equal(result.ok, true, label);
  return result.value;
}

function declarationIn(status, change, declarationId) {
  const draft = draftDeclaration(change, declarationId);
  if (status === "DRAFT") return draft;
  if (status === "WITHDRAWN") {
    return transition(
      withdrawDeclaration(
        draft,
        "No longer required",
        context(`${declarationId}_withdrawn`, 1),
      ),
      `${declarationId} withdrawn`,
    );
  }
  let declaration = transition(
    proposeDeclaration(draft, context(`${declarationId}_proposed`, 1)),
    `${declarationId} proposed`,
  );
  if (status === "REJECTED") {
    return transition(
      rejectDeclaration(
        declaration,
        "Rejected by policy fixture",
        context(`${declarationId}_rejected`, 2),
      ),
      `${declarationId} rejected`,
    );
  }
  if (status === "UNDER_REVIEW") {
    return transition(
      recordConsumerResponse(
        declaration,
        `rsp_${declarationId}_objected`,
        declaration.revision,
        "analytics",
        "OBJECTED",
        "Needs review",
        context(`${declarationId}_objected`, 2),
      ),
      `${declarationId} under review`,
    );
  }
  if (status === "PROPOSED") return declaration;
  declaration = transition(
    recordConsumerResponse(
      declaration,
      `rsp_${declarationId}_ack`,
      declaration.revision,
      "analytics",
      "ACKNOWLEDGED",
      "Approved",
      context(`${declarationId}_ack`, 2),
    ),
    `${declarationId} acknowledged`,
  );
  declaration = transition(
    acceptDeclaration(declaration, context(`${declarationId}_accepted`, 3)),
    `${declarationId} accepted`,
  );
  if (status === "ACCEPTED") return declaration;
  declaration = transition(
    startEnforcement(
      declaration,
      context(`${declarationId}_enforcing`, 4),
    ),
    `${declarationId} enforcing`,
  );
  if (status === "ENFORCING") return declaration;
  return transition(
    completeDeclaration(
      declaration,
      context(`${declarationId}_completed`, 5),
    ),
    `${declarationId} completed`,
  );
}

function detectionFor(changes, overrides = {}) {
  return detection({ changes: structuredClone(changes), ...overrides });
}

function verifiedHistory(baseSha = "c".repeat(40), diagnostics = []) {
  return { status: "verified", base_sha: baseSha, diagnostics };
}

function coordinatedInput(change, declarations, history = verifiedHistory()) {
  return policyInput({
    preset: "coordinated",
    detection: detectionFor([change]),
    declarations,
    history,
  });
}

function acceptedWithoutConsumers(change, declarationId) {
  const draft = draftDeclaration(change, declarationId);
  draft.consumers = [];
  assert.equal(validateDeclaration(draft).ok, true);
  const proposed = transition(
    proposeDeclaration(draft, context(`${declarationId}_proposed`, 1)),
    `${declarationId} proposed`,
  );
  return transition(
    acceptDeclaration(proposed, context(`${declarationId}_accepted`, 2)),
    `${declarationId} accepted`,
  );
}

function setCompletedAt(declaration, at) {
  const completed = declaration.events.findLast(
    (event) => event.type === "COMPLETED",
  );
  assert.ok(completed);
  completed.at = at;
  assert.equal(validateDeclaration(declaration).ok, true);
  return declaration;
}

function proposedForEvidence(changes, consumers, declarationId) {
  return transition(
    proposeDeclaration(
      draftWithChanges(changes, declarationId, consumers),
      context(`${declarationId}_proposed`, 1),
    ),
    `${declarationId} proposed`,
  );
}

function acknowledgeTeams(declaration, teams, startMinute = 2) {
  let current = declaration;
  teams.forEach((team, index) => {
    current = transition(
      recordConsumerResponse(
        current,
        `rsp_${current.declaration_id}_${team}_${current.revision}`,
        current.revision,
        team,
        "ACKNOWLEDGED",
        "Approved",
        context(`${current.declaration_id}_${team}_ack_${current.revision}`, startMinute + index),
      ),
      `${current.declaration_id} ${team} acknowledged`,
    );
  });
  return current;
}

function appendEvidence(
  declaration,
  {
    evidenceId,
    team,
    validatorId,
    changeIds = declaration.changes.map((change) => change.change_id),
    sourceDigests = detection().source_digests,
    result = "PASSED",
    revision = declaration.revision,
  },
  minute,
) {
  const at = `2026-07-13T10:${String(minute).padStart(2, "0")}:00Z`;
  declaration.evidence.push({
    evidence_id: evidenceId,
    declaration_revision: revision,
    team,
    validator_id: validatorId,
    change_ids: structuredClone(changeIds),
    source_digests: structuredClone(sourceDigests),
    result,
    at,
    summary: `${validatorId} ${result.toLowerCase()}`,
  });
  declaration.events.push({
    event_id: `evt_${evidenceId}`,
    type: "EVIDENCE_RECORDED",
    declaration_revision: revision,
    at,
    actor: "policy-test",
    from_status: declaration.status,
    to_status: declaration.status,
    details: { evidence_id: evidenceId, team, result },
  });
  assert.equal(validateDeclaration(declaration).ok, true, evidenceId);
  return declaration;
}

test("accepts every frozen detector provenance and trust row", () => {
  const cases = [
    {
      label: "builtin",
      detection: detection(),
      trust: { trusted: true, mode: "builtin" },
      expectedCoverage: [],
    },
    {
      label: "executed",
      detection: detection({
        detector: {
          id: "allowlisted-json-schema",
          version: "1.0.0",
          mode: "executed",
        },
      }),
      trust: { trusted: true, mode: "executed" },
      expectedCoverage: [],
    },
    {
      label: "authorized import",
      detection: detection({
        detector: {
          id: "operator-import",
          version: "1.0.0",
          mode: "imported",
        },
      }),
      trust: {
        trusted: true,
        mode: "operator_import",
        authorization_id: "approval-123",
      },
      expectedCoverage: [],
    },
    {
      label: "untrusted advisory import",
      detection: detection({
        detector: {
          id: "untrusted-import",
          version: "1.0.0",
          mode: "imported",
        },
      }),
      trust: { trusted: false, mode: "untrusted_import" },
      expectedCoverage: [
        {
          changeId: compatibleChange().change_id,
          state: "uncovered",
        },
      ],
    },
  ];

  for (const entry of cases) {
    const input = policyInput({
      detection: entry.detection,
      detector_trust: entry.trust,
    });
    const before = structuredClone(input);
    const result = evaluatePolicy(input);

    assert.equal(result.ok, true, entry.label);
    assert.equal(result.decision, "pass", entry.label);
    assert.deepEqual(result.coverage, entry.expectedCoverage, entry.label);
    if (entry.label === "untrusted advisory import") {
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "SEIP_DETECTOR_UNTRUSTED_IMPORT" &&
            diagnostic.severity === "warning",
        ),
      );
    }
    assert.deepEqual(input, before, `${entry.label} mutated input`);
  }
});

test("rejects every representative detector trust mismatch", () => {
  const imported = detection({
    detector: {
      id: "imported",
      version: "1.0.0",
      mode: "imported",
    },
  });
  const cases = [
    [imported, { trusted: true, mode: "builtin" }],
    [imported, { trusted: true, mode: "untrusted_import" }],
    [imported, { trusted: true, mode: "operator_import" }],
    [detection(), { trusted: false, mode: "builtin" }],
  ];

  for (const [report, trust] of cases) {
    const result = evaluatePolicy(
      policyInput({ detection: report, detector_trust: trust }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, "error");
    assert.deepEqual(result.coverage, []);
    assert.deepEqual(diagnosticCodes(result), [
      "SEIP_DETECTOR_TRUST_INVALID",
    ]);
  }
});

test("allows untrusted imports only for advisory evaluation", () => {
  const untrustedDetection = detection({
    detector: {
      id: "untrusted-import",
      version: "1.0.0",
      mode: "imported",
    },
  });
  for (const preset of ["declared", "coordinated"]) {
    const result = evaluatePolicy(
      policyInput({
        preset,
        detection: untrustedDetection,
        detector_trust: { trusted: false, mode: "untrusted_import" },
      }),
    );
    assert.equal(result.decision, "error", preset);
    assert.deepEqual(result.coverage, [], preset);
    assert.deepEqual(diagnosticCodes(result), [
      "SEIP_DETECTOR_UNTRUSTED_IMPORT",
    ]);
  }
});

test("treats failed, partial, and error-diagnostic detection as operational errors", () => {
  const failures = [
    [detection({ ok: false }), "SEIP_DETECTOR_FAILED"],
    [detection({ completeness: "partial" }), "SEIP_DETECTOR_INCOMPLETE"],
    [
      detection({
        diagnostics: [
          {
            code: "DETECTOR_PARSE_FAILED",
            severity: "error",
            message: "Detector could not parse the source.",
          },
        ],
      }),
      "SEIP_DETECTOR_FAILED",
    ],
  ];

  for (const preset of ["advisory", "declared", "coordinated"]) {
    for (const [report, expectedCode] of failures) {
      const result = evaluatePolicy(policyInput({ preset, detection: report }));
      assert.equal(result.ok, false, `${preset} ${expectedCode}`);
      assert.equal(result.decision, "error", `${preset} ${expectedCode}`);
      assert.deepEqual(result.coverage, [], `${preset} ${expectedCode}`);
      assert.ok(
        diagnosticCodes(result).includes(expectedCode),
        `${preset} ${expectedCode}`,
      );
    }
  }

  const duplicated = {
    code: "DETECTOR_WARNING",
    severity: "warning",
    message: "Detector warning.",
  };
  const normalized = evaluatePolicy(
    policyInput({
      detection: detection({
        ok: false,
        diagnostics: [duplicated, structuredClone(duplicated)],
      }),
    }),
  );
  assert.equal(
    normalized.diagnostics.filter(
      (entry) => entry.code === "DETECTOR_WARNING",
    ).length,
    1,
  );

  const badFingerprint = compatibleChange();
  badFingerprint.change_id = "not-the-fingerprint";
  const invalidOutput = evaluatePolicy(
    policyInput({ detection: detectionFor([badFingerprint]) }),
  );
  assert.equal(invalidOutput.decision, "error");
  assert.ok(
    invalidOutput.diagnostics.every(
      (entry) =>
        entry.path === undefined || entry.path.startsWith("/detection/changes"),
    ),
  );

  const duplicate = compatibleChange();
  const duplicatedOutput = evaluatePolicy(
    policyInput({
      detection: detectionFor([duplicate, structuredClone(duplicate)]),
    }),
  );
  assert.equal(duplicatedOutput.decision, "error");
  assert.deepEqual(duplicatedOutput.coverage, []);
  assert.deepEqual(duplicatedOutput.diagnostics, [
    {
      code: "SEIP_POLICY_INPUT_INVALID",
      severity: "error",
      message: "Detected change identifiers must be unique.",
      path: "/detection/changes/1/change_id",
    },
  ]);
});

test("treats explicit unknown compatibility as requiring coverage", () => {
  const change = compatibleChange();
  change.compatibility = "unknown";
  const fingerprint = computeChangeId(change);
  assert.equal(fingerprint.ok, true);
  change.change_id = fingerprint.value;
  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
    }),
  );
  assert.equal(result.decision, "fail");
  assert.deepEqual(result.coverage, [
    { changeId: change.change_id, state: "uncovered" },
  ]);
});

test("requires exact declared coverage and accepts a proposed match", () => {
  const change = breakingRemoval();
  const declaration = declarationIn("PROPOSED", change, "decl_exact");
  const input = policyInput({
    preset: "declared",
    detection: detectionFor([change]),
    declarations: [declaration],
  });
  const before = jsonContent(input);

  const result = evaluatePolicy(input);

  assert.equal(result.ok, true);
  assert.equal(result.decision, "pass");
  assert.deepEqual(result.coverage, [
    {
      changeId: change.change_id,
      declarationId: "decl_exact",
      state: "covered",
    },
  ]);
  assert.deepEqual(jsonContent(input), before);
});

test("does not cover matching coordinates with different snapshots", () => {
  const detected = breakingRetype("string", "boolean");
  const declared = breakingRetype("number", "integer");
  const declaration = declarationIn("COMPLETED", declared, "decl_old_retype");

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([detected]),
      declarations: [declaration],
    }),
  );

  assert.equal(result.decision, "fail");
  assert.deepEqual(result.coverage, [
    { changeId: detected.change_id, state: "uncovered" },
  ]);
  assert.deepEqual(diagnosticCodes(result), [
    "SEIP_POLICY_UNCOVERED_CHANGE",
  ]);
});

test("gives active declaration attempts precedence over completed history", () => {
  const change = breakingRemoval();
  const completed = declarationIn("COMPLETED", change, "decl_completed");
  const draft = declarationIn("DRAFT", change, "decl_active_draft");

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [completed, draft],
    }),
  );

  assert.equal(result.decision, "fail");
  assert.deepEqual(result.coverage, [
    {
      changeId: change.change_id,
      declarationId: "decl_active_draft",
      state: "uncovered",
    },
  ]);
  assert.deepEqual(diagnosticCodes(result), [
    "SEIP_POLICY_STATUS_INELIGIBLE",
  ]);
});

test("reports ambiguous active coverage without completed fallback", () => {
  const change = breakingRemoval();
  const declarations = [
    declarationIn("PROPOSED", change, "decl_active_a"),
    declarationIn("ACCEPTED", change, "decl_active_b"),
    declarationIn("COMPLETED", change, "decl_completed_fallback"),
  ];

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations,
    }),
  );

  assert.equal(result.decision, "fail");
  assert.deepEqual(result.coverage, [
    { changeId: change.change_id, state: "ambiguous" },
  ]);
  assert.deepEqual(diagnosticCodes(result), [
    "SEIP_POLICY_AMBIGUOUS_COVERAGE",
  ]);
});

test("uses completed exact history only when no active declaration remains", () => {
  const change = breakingRemoval();
  const completed = declarationIn("COMPLETED", change, "decl_completed_only");
  const withdrawn = declarationIn("WITHDRAWN", change, "decl_withdrawn");
  const rejected = declarationIn("REJECTED", change, "decl_rejected");

  const covered = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [withdrawn, completed, rejected],
    }),
  );
  assert.equal(covered.decision, "pass");
  assert.deepEqual(covered.coverage, [
    {
      changeId: change.change_id,
      declarationId: "decl_completed_only",
      state: "covered",
    },
  ]);

  const uncovered = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [withdrawn, rejected],
    }),
  );
  assert.equal(uncovered.decision, "fail");
  assert.deepEqual(uncovered.coverage, [
    { changeId: change.change_id, state: "uncovered" },
  ]);
});

test("validates every declaration before producing coverage", () => {
  const change = breakingRemoval();
  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [{}],
    }),
  );

  assert.equal(result.decision, "error");
  assert.deepEqual(result.coverage, []);
  assert.ok(
    result.diagnostics.every(
      (entry) => entry.path?.startsWith("/declarations/0") === true,
    ),
  );
  assert.ok(
    result.diagnostics.some(
      (entry) => entry.code === "SEIP_PROTOCOL_SCHEMA_INVALID",
    ),
  );
});

test("rejects duplicate declaration identifiers as operational input", () => {
  const change = breakingRemoval();
  const declarations = [
    declarationIn("PROPOSED", change, "decl_duplicate"),
    declarationIn("COMPLETED", change, "decl_duplicate"),
  ];
  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations,
    }),
  );

  assert.equal(result.decision, "error");
  assert.deepEqual(result.coverage, []);
  assert.ok(
    diagnosticCodes(result).includes("SEIP_POLICY_INPUT_INVALID"),
  );
});

test("bounds repeated declaration identity validation without losing duplicates", () => {
  const declaration = draftDeclaration(
    compatibleChange(),
    "decl_repeated_identity",
  );
  declaration.x_alias_probe = Array.from({ length: 500 }, (_, index) => ({
    index,
  }));
  const started = performance.now();
  const result = evaluatePolicy(
    policyInput({ declarations: new Array(5_000).fill(declaration) }),
  );
  const elapsed = performance.now() - started;

  assert.equal(result.decision, "error");
  assert.deepEqual(result.coverage, []);
  assert.equal(
    result.diagnostics.filter(
      (entry) => entry.code === "SEIP_POLICY_INPUT_INVALID",
    ).length,
    4_999,
  );
  assert.ok(elapsed < 2_000, `alias validation took ${elapsed}ms`);
});

test("requires explicit, usable coordinated history without fallback", () => {
  const change = breakingRemoval();
  const declaration = declarationIn("COMPLETED", change, "decl_history");
  const cases = [
    [undefined, "SEIP_HISTORY_BASE_REQUIRED", "not_evaluated"],
    [
      { status: "not_evaluated", diagnostics: [] },
      "SEIP_HISTORY_BASE_REQUIRED",
      "not_evaluated",
    ],
    [
      {
        status: "failed",
        diagnostics: [
          {
            code: "GIT_FETCH_FAILED",
            severity: "error",
            message: "Base history could not be fetched.",
          },
        ],
      },
      "SEIP_HISTORY_BASE_UNAVAILABLE",
      "failed",
    ],
    [verifiedHistory("ABCDEF"), "SEIP_HISTORY_BASE_REQUIRED", "not_evaluated"],
    [
      verifiedHistory("A".repeat(40)),
      "SEIP_HISTORY_BASE_REQUIRED",
      "not_evaluated",
    ],
    [
      verifiedHistory("d".repeat(40), [
        {
          code: "GIT_VERIFY_FAILED",
          severity: "error",
          message: "History verification failed.",
        },
      ]),
      "SEIP_HISTORY_BASE_UNAVAILABLE",
      "failed",
    ],
  ];

  for (const [history, code, expectedHistory] of cases) {
    const input = coordinatedInput(change, [declaration], history);
    if (history === undefined) delete input.history;
    const result = evaluatePolicy(input);
    assert.equal(result.decision, "error", code);
    assert.equal(result.history, expectedHistory, code);
    assert.deepEqual(result.coverage, [], code);
    assert.ok(diagnosticCodes(result).includes(code), code);
  }

  const sha256 = evaluatePolicy(
    coordinatedInput(
      change,
      [declaration],
      verifiedHistory("e".repeat(64)),
    ),
  );
  assert.equal(sha256.decision, "pass");
  assert.equal(sha256.history, "verified");
});

test("ignores supplied history outside coordinated evaluation", () => {
  const change = breakingRemoval();
  const declaration = declarationIn("PROPOSED", change, "decl_no_history");
  for (const preset of ["advisory", "declared"]) {
    const result = evaluatePolicy(
      policyInput({
        preset,
        detection: detectionFor([change]),
        declarations: [declaration],
        history: {
          status: "failed",
          diagnostics: [
            {
              code: "IGNORED_HISTORY_FAILURE",
              severity: "error",
              message: "This history is irrelevant to the preset.",
            },
          ],
        },
      }),
    );
    assert.equal(result.decision, "pass", preset);
    assert.equal(result.history, "not_evaluated", preset);
    assert.equal(
      diagnosticCodes(result).includes("IGNORED_HISTORY_FAILURE"),
      false,
      preset,
    );
  }
});

test("coordinates accepted, enforcing, completed, and zero-consumer declarations", () => {
  const change = breakingRemoval();
  const declarations = [
    declarationIn("ACCEPTED", change, "decl_accepted"),
    declarationIn("ENFORCING", change, "decl_enforcing"),
    declarationIn("COMPLETED", change, "decl_completed"),
    acceptedWithoutConsumers(change, "decl_zero_consumers"),
  ];

  for (const declaration of declarations) {
    const result = evaluatePolicy(coordinatedInput(change, [declaration]));
    assert.equal(result.decision, "pass", declaration.declaration_id);
    assert.equal(result.history, "verified", declaration.declaration_id);
    assert.deepEqual(result.coverage, [
      {
        changeId: change.change_id,
        declarationId: declaration.declaration_id,
        state: "covered",
      },
    ]);
  }
});

test("selects the latest acknowledgement within the current revision", () => {
  const change = breakingRemoval();
  const declarationId = "decl_current_revision_ack";
  let declaration = transition(
    proposeDeclaration(
      draftDeclaration(change, declarationId),
      context(`${declarationId}_proposed`, 1),
    ),
    "proposed declaration",
  );
  declaration = transition(
    recordConsumerResponse(
      declaration,
      "rsp_stale_revision",
      declaration.revision,
      "analytics",
      "ACKNOWLEDGED",
      "Acknowledged before amendment",
      context(`${declarationId}_stale_ack`, 1),
    ),
    "stale acknowledgement",
  );
  declaration = transition(
    amendDeclaration(
      declaration,
      { intent: { summary: "Revised coordination intent" } },
      "Material coordination revision",
      context(`${declarationId}_amended`, 1),
    ),
    "amended declaration",
  );
  declaration = transition(
    recordConsumerResponse(
      declaration,
      "rsp_current_revision",
      declaration.revision,
      "analytics",
      "ACKNOWLEDGED",
      "Acknowledged current revision",
      context(`${declarationId}_current_ack`, 1),
    ),
    "current acknowledgement",
  );
  declaration = transition(
    acceptDeclaration(
      declaration,
      context(`${declarationId}_accepted`, 1),
    ),
    "accepted declaration",
  );

  declaration.responses = [declaration.responses[1], declaration.responses[0]];
  assert.equal(validateDeclaration(declaration).ok, true);

  const result = evaluatePolicy(coordinatedInput(change, [declaration]));
  assert.equal(result.decision, "pass");
  assert.equal(result.coverage[0].state, "covered");
});

test("selects completed history by actual instant and reports alternatives", () => {
  const change = breakingRemoval();
  const lexicallyLaterButEarlier = setCompletedAt(
    declarationIn("COMPLETED", change, "decl_offset_earlier"),
    "2026-07-13T15:00:00+02:00",
  );
  const actuallyLater = setCompletedAt(
    declarationIn("COMPLETED", change, "decl_z_later"),
    "2026-07-13T13:30:00Z",
  );

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [lexicallyLaterButEarlier, actuallyLater],
    }),
  );

  assert.equal(result.decision, "pass");
  assert.equal(result.coverage[0].declarationId, "decl_z_later");
  assert.deepEqual(
    result.diagnostics
      .filter((entry) => entry.code === "SEIP_POLICY_COMPLETED_HISTORY")
      .map((entry) => entry.declarationId),
    ["decl_offset_earlier"],
  );
});

test("breaks equal completed instants by declaration identifier", () => {
  const change = breakingRemoval();
  const largerId = setCompletedAt(
    declarationIn("COMPLETED", change, "decl_z_equal"),
    "2026-07-13T15:30:00+02:00",
  );
  const smallerId = setCompletedAt(
    declarationIn("COMPLETED", change, "decl_a_equal"),
    "2026-07-13T13:30:00Z",
  );
  const fractionalEarlier = setCompletedAt(
    declarationIn("COMPLETED", change, "decl_fractional"),
    "2026-07-13T13:29:59.999999999Z",
  );

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [largerId, fractionalEarlier, smallerId],
    }),
  );

  assert.equal(result.decision, "pass");
  assert.equal(result.coverage[0].declarationId, "decl_a_equal");
  assert.deepEqual(
    result.diagnostics
      .filter((entry) => entry.code === "SEIP_POLICY_COMPLETED_HISTORY")
      .map((entry) => entry.declarationId),
    ["decl_fractional", "decl_z_equal"],
  );
});

test("validates evidence configuration fail-closed", () => {
  const change = breakingRemoval();
  const declaration = declarationIn("PROPOSED", change, "decl_evidence_config");
  const cases = [
    { mode: "selected", trusted_validator_ids: ["validator-a"] },
    {
      mode: "selected",
      selected_teams: [],
      trusted_validator_ids: ["validator-a"],
    },
    {
      mode: "selected",
      selected_teams: ["analytics", "analytics"],
      trusted_validator_ids: ["validator-a"],
    },
    {
      mode: "selected",
      selected_teams: ["unknown-team"],
      trusted_validator_ids: ["validator-a"],
    },
    {
      mode: "all_consumers",
      selected_teams: ["analytics"],
      trusted_validator_ids: ["validator-a"],
    },
    {
      mode: "none",
      selected_teams: ["analytics"],
      trusted_validator_ids: [],
    },
    { mode: "all_consumers", trusted_validator_ids: [] },
    {
      mode: "all_consumers",
      trusted_validator_ids: [" validator-a"],
    },
    {
      mode: "all_consumers",
      trusted_validator_ids: ["validator-a", "validator-a"],
    },
    {
      mode: "all_consumers",
      trusted_validator_ids: ["validator-a"],
      required_validator_ids: ["validator-b"],
    },
  ];

  for (const evidence of cases) {
    const result = evaluatePolicy(
      policyInput({
        preset: "declared",
        detection: detectionFor([change]),
        declarations: [declaration],
        evidence,
      }),
    );
    assert.equal(result.decision, "error", JSON.stringify(evidence));
    assert.deepEqual(result.coverage, [], JSON.stringify(evidence));
    assert.ok(
      diagnosticCodes(result).includes("SEIP_POLICY_CONFIGURATION_INVALID"),
      JSON.stringify(evidence),
    );
  }
});

test("requires every configured consumer, validator, and declaration change", () => {
  const changes = [breakingRemoval("legacy_a"), breakingRemoval("legacy_b")];
  const consumers = [{ team: "analytics" }, { team: "risk" }];
  const declaration = proposedForEvidence(
    changes,
    consumers,
    "decl_evidence_matrix",
  );
  const entries = [
    ["analytics", "validator-a"],
    ["analytics", "validator-b"],
    ["risk", "validator-a"],
    ["risk", "validator-b"],
  ];
  entries.slice(0, 3).forEach(([team, validatorId], index) => {
    appendEvidence(
      declaration,
      {
        evidenceId: `evd_matrix_${index}`,
        team,
        validatorId,
      },
      3 + index,
    );
  });
  const evidence = {
    mode: "all_consumers",
    required_validator_ids: ["validator-a", "validator-b"],
    trusted_validator_ids: ["validator-a", "validator-b"],
  };

  const missing = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor(changes),
      declarations: [declaration],
      evidence,
    }),
  );
  assert.equal(missing.decision, "fail");
  assert.equal(
    missing.diagnostics.filter(
      (entry) => entry.code === "SEIP_POLICY_EVIDENCE_REQUIRED",
    ).length,
    1,
  );

  appendEvidence(
    declaration,
    {
      evidenceId: "evd_matrix_complete",
      team: "risk",
      validatorId: "validator-b",
    },
    7,
  );
  const complete = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor(changes),
      declarations: [declaration],
      evidence,
    }),
  );
  assert.equal(complete.decision, "pass");
  assert.ok(complete.coverage.every((entry) => entry.state === "covered"));
});

test("uses an independent trusted-validator existential per team and change", () => {
  const changes = [breakingRemoval("legacy_a"), breakingRemoval("legacy_b")];
  const declaration = proposedForEvidence(
    changes,
    [{ team: "analytics" }, { team: "risk" }],
    "decl_evidence_existential",
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_existential_a",
      team: "analytics",
      validatorId: "validator-a",
      changeIds: [changes[0].change_id],
    },
    3,
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_existential_b",
      team: "analytics",
      validatorId: "validator-b",
      changeIds: [changes[1].change_id],
    },
    4,
  );

  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor(changes),
      declarations: [declaration],
      evidence: {
        mode: "selected",
        selected_teams: ["analytics"],
        trusted_validator_ids: ["validator-a", "validator-b"],
      },
    }),
  );

  assert.equal(result.decision, "pass");
});

test("supersedes evidence only after revision, digest, and trust eligibility", () => {
  const change = breakingRemoval();
  const declaration = proposedForEvidence(
    [change],
    [{ team: "analytics" }],
    "decl_evidence_supersession",
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_valid_pass",
      team: "analytics",
      validatorId: "validator-a",
    },
    3,
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_wrong_digest_failure",
      team: "analytics",
      validatorId: "validator-a",
      sourceDigests: {
        before: "c".repeat(64),
        after: "d".repeat(64),
      },
      result: "FAILED",
    },
    4,
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_untrusted_failure",
      team: "analytics",
      validatorId: "validator-untrusted",
      result: "FAILED",
    },
    5,
  );
  const requirement = {
    mode: "all_consumers",
    trusted_validator_ids: ["validator-a"],
  };

  const stillPassing = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [declaration],
      evidence: requirement,
    }),
  );
  assert.equal(stillPassing.decision, "pass");

  appendEvidence(
    declaration,
    {
      evidenceId: "evd_eligible_failure",
      team: "analytics",
      validatorId: "validator-a",
      result: "FAILED",
    },
    6,
  );
  const superseded = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [declaration],
      evidence: requirement,
    }),
  );
  assert.equal(superseded.decision, "fail");
  assert.ok(
    diagnosticCodes(superseded).includes("SEIP_POLICY_EVIDENCE_REQUIRED"),
  );
});

test("amendment makes retained evidence stale without wall-clock expiry", () => {
  const change = breakingRemoval();
  let declaration = proposedForEvidence(
    [change],
    [{ team: "analytics" }],
    "decl_evidence_revision",
  );
  declaration = acknowledgeTeams(declaration, ["analytics"], 2);
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_revision_one",
      team: "analytics",
      validatorId: "validator-a",
    },
    3,
  );
  declaration = transition(
    amendDeclaration(
      declaration,
      { intent: { summary: "Revised coordination intent" } },
      "Material policy revision",
      context("evidence_revision_amend", 4),
    ),
    "amended declaration",
  );
  declaration = acknowledgeTeams(declaration, ["analytics"], 5);
  const beforeCurrentEvidence = structuredClone(declaration);

  const staleOnly = transition(
    acceptDeclaration(
      declaration,
      context("evidence_revision_accept_stale", 7),
    ),
    "accepted with stale evidence",
  );
  const requirement = {
    mode: "all_consumers",
    required_validator_ids: ["validator-a"],
    trusted_validator_ids: ["validator-a"],
  };
  const staleRequired = evaluatePolicy({
    ...coordinatedInput(change, [staleOnly], verifiedHistory()),
    evidence: requirement,
  });
  assert.equal(staleRequired.decision, "fail");
  assert.ok(
    diagnosticCodes(staleRequired).includes("SEIP_POLICY_EVIDENCE_REQUIRED"),
  );

  appendEvidence(
    beforeCurrentEvidence,
    {
      evidenceId: "evd_revision_two",
      team: "analytics",
      validatorId: "validator-a",
    },
    6,
  );
  const currentEvidence = transition(
    acceptDeclaration(
      beforeCurrentEvidence,
      context("evidence_revision_accept_current", 7),
    ),
    "accepted with current evidence",
  );
  const currentResult = evaluatePolicy({
    ...coordinatedInput(change, [currentEvidence], verifiedHistory()),
    evidence: requirement,
  });
  assert.equal(currentResult.decision, "pass");
});

test("advisory reports missing configured evidence without failing", () => {
  const change = breakingRemoval();
  const draft = declarationIn("DRAFT", change, "decl_advisory_evidence");
  const result = evaluatePolicy(
    policyInput({
      preset: "advisory",
      detection: detectionFor([change]),
      declarations: [draft],
      evidence: {
        mode: "all_consumers",
        trusted_validator_ids: ["validator-a"],
      },
    }),
  );

  assert.equal(result.decision, "pass");
  assert.equal(result.coverage[0].state, "uncovered");
  assert.ok(
    result.diagnostics.some(
      (entry) =>
        entry.code === "SEIP_POLICY_EVIDENCE_REQUIRED" &&
        entry.severity === "warning",
    ),
  );
});

test("enforces the complete trust and authorization edge matrix", () => {
  const detectorModes = ["builtin", "executed", "imported"];
  const trustModes = [
    "builtin",
    "executed",
    "operator_import",
    "untrusted_import",
  ];
  for (const detectorMode of detectorModes) {
    for (const trustMode of trustModes) {
      for (const trusted of [false, true]) {
        for (const authorization of [false, true]) {
          const trust = {
            trusted,
            mode: trustMode,
            ...(authorization ? { authorization_id: "authorization-1" } : {}),
          };
          const allowed =
            (detectorMode === "builtin" &&
              trustMode === "builtin" &&
              trusted &&
              !authorization) ||
            (detectorMode === "executed" &&
              trustMode === "executed" &&
              trusted &&
              !authorization) ||
            (detectorMode === "imported" &&
              trustMode === "operator_import" &&
              trusted &&
              authorization) ||
            (detectorMode === "imported" &&
              trustMode === "untrusted_import" &&
              !trusted &&
              !authorization);
          const result = evaluatePolicy(
            policyInput({
              detection: detection({
                changes: [],
                detector: {
                  id: detectorMode,
                  version: "1.0.0",
                  mode: detectorMode,
                },
              }),
              detector_trust: trust,
            }),
          );
          assert.equal(
            result.decision === "pass",
            allowed,
            `${detectorMode}/${trustMode}/${trusted}/${authorization}`,
          );
        }
      }
    }
  }

  const whitespaceAuthorization = evaluatePolicy(
    policyInput({
      detection: detection({
        changes: [],
        detector: { id: "imported", version: "1.0.0", mode: "imported" },
      }),
      detector_trust: {
        trusted: true,
        mode: "operator_import",
        authorization_id: "   ",
      },
    }),
  );
  assert.equal(whitespaceAuthorization.decision, "error");

  const paddedAuthorization = evaluatePolicy(
    policyInput({
      detection: detection({
        changes: [],
        detector: { id: "imported", version: "1.0.0", mode: "imported" },
      }),
      detector_trust: {
        trusted: true,
        mode: "operator_import",
        authorization_id: " authorization-1 ",
      },
    }),
  );
  assert.equal(paddedAuthorization.decision, "error");
});

test("classifies closed policy and configuration shells precisely", () => {
  const report = detection();
  const cases = [
    {
      label: "unknown preset",
      input: policyInput({ preset: "future" }),
      code: "SEIP_POLICY_CONFIGURATION_INVALID",
    },
    {
      label: "detection extension",
      input: policyInput({ detection: { ...report, unsupported: true } }),
      code: "SEIP_POLICY_INPUT_INVALID",
    },
    {
      label: "detector extension",
      input: policyInput({
        detection: detection({
          detector: { ...report.detector, unsupported: true },
        }),
      }),
      code: "SEIP_POLICY_INPUT_INVALID",
    },
    {
      label: "trust extension",
      input: policyInput({
        detector_trust: {
          trusted: true,
          mode: "builtin",
          unsupported: true,
        },
      }),
      code: "SEIP_POLICY_INPUT_INVALID",
    },
    {
      label: "history extension",
      input: policyInput({
        history: {
          status: "not_evaluated",
          diagnostics: [],
          unsupported: true,
        },
      }),
      code: "SEIP_POLICY_INPUT_INVALID",
    },
    {
      label: "evidence extension",
      input: policyInput({
        evidence: {
          mode: "none",
          trusted_validator_ids: [],
          unsupported: true,
        },
      }),
      code: "SEIP_POLICY_CONFIGURATION_INVALID",
    },
  ];

  for (const entry of cases) {
    const result = evaluatePolicy(entry.input);
    assert.equal(result.decision, "error", entry.label);
    assert.deepEqual(result.coverage, [], entry.label);
    assert.deepEqual(diagnosticCodes(result), [entry.code], entry.label);
  }

  let coercions = 0;
  const result = evaluatePolicy(
    policyInput({
      preset: {
        [Symbol.toPrimitive]() {
          coercions += 1;
          return "advisory";
        },
      },
    }),
  );
  assert.equal(result.decision, "error");
  assert.deepEqual(diagnosticCodes(result), [
    "SEIP_POLICY_CONFIGURATION_INVALID",
  ]);
  assert.equal(coercions, 0);
});

test("is total and closed over hostile JavaScript input shells", () => {
  const primitiveInputs = [
    undefined,
    null,
    false,
    1,
    Number.NaN,
    "policy",
    1n,
    Symbol("policy"),
    () => undefined,
    [],
  ];
  for (const input of primitiveInputs) {
    assert.doesNotThrow(() => {
      const result = evaluatePolicy(input);
      assert.equal(result.decision, "error");
      assert.deepEqual(result.coverage, []);
    });
  }

  let getterReads = 0;
  const accessorInput = policyInput();
  Object.defineProperty(accessorInput, "preset", {
    enumerable: true,
    get() {
      getterReads += 1;
      throw new Error("must not execute root getter");
    },
  });
  assert.equal(evaluatePolicy(accessorInput).decision, "error");
  assert.equal(getterReads, 0);

  let proxyTraps = 0;
  const proxy = new Proxy(policyInput(), {
    get() {
      proxyTraps += 1;
      throw new Error("must not execute proxy get");
    },
    ownKeys() {
      proxyTraps += 1;
      throw new Error("must not execute proxy ownKeys");
    },
  });
  assert.equal(evaluatePolicy(proxy).decision, "error");
  assert.equal(proxyTraps, 0);

  const revocable = Proxy.revocable(policyInput(), {});
  revocable.revoke();
  assert.doesNotThrow(() => {
    assert.equal(evaluatePolicy(revocable.proxy).decision, "error");
  });

  const cyclic = policyInput();
  cyclic.history = cyclic;
  assert.equal(evaluatePolicy(cyclic).decision, "error");

  const inherited = Object.assign(Object.create({ inherited: true }), policyInput());
  assert.equal(evaluatePolicy(inherited).decision, "error");

  const extra = policyInput();
  extra.unsupported = true;
  assert.equal(evaluatePolicy(extra).decision, "error");
});

test("rejects hostile nested policy shells without invoking user code", () => {
  let changeArrayTraps = 0;
  const proxiedChanges = new Proxy([], {
    get() {
      changeArrayTraps += 1;
      throw new Error("must not read proxied changes");
    },
    ownKeys() {
      changeArrayTraps += 1;
      throw new Error("must not enumerate proxied changes");
    },
  });
  const proxiedResult = evaluatePolicy(
    policyInput({ detection: detection({ changes: proxiedChanges }) }),
  );
  assert.equal(proxiedResult.decision, "error");
  assert.deepEqual(diagnosticCodes(proxiedResult), [
    "SEIP_POLICY_INPUT_INVALID",
  ]);
  assert.equal(changeArrayTraps, 0);

  let changeReads = 0;
  const accessorChanges = new Array(1);
  Object.defineProperty(accessorChanges, "0", {
    enumerable: true,
    get() {
      changeReads += 1;
      throw new Error("must not read change accessors");
    },
  });
  assert.equal(
    evaluatePolicy(
      policyInput({ detection: detection({ changes: accessorChanges }) }),
    ).decision,
    "error",
  );
  assert.equal(changeReads, 0);

  const malformedArrays = [new Array(1)];
  const extra = [];
  extra.unsupported = true;
  malformedArrays.push(extra);
  const symbol = [];
  symbol[Symbol("unsupported")] = true;
  malformedArrays.push(symbol);
  for (const changes of malformedArrays) {
    const result = evaluatePolicy(
      policyInput({ detection: detection({ changes }) }),
    );
    assert.equal(result.decision, "error");
    assert.deepEqual(diagnosticCodes(result), [
      "SEIP_POLICY_INPUT_INVALID",
    ]);
  }

  let detectorReads = 0;
  const detector = { id: "builtin", version: "1.0.0" };
  Object.defineProperty(detector, "mode", {
    enumerable: true,
    get() {
      detectorReads += 1;
      throw new Error("must not read detector accessors");
    },
  });
  assert.equal(
    evaluatePolicy(
      policyInput({ detection: detection({ detector }) }),
    ).decision,
    "error",
  );
  assert.equal(detectorReads, 0);

  const revokedDetection = Proxy.revocable(detection(), {});
  revokedDetection.revoke();
  assert.doesNotThrow(() => {
    assert.equal(
      evaluatePolicy(policyInput({ detection: revokedDetection.proxy }))
        .decision,
      "error",
    );
  });

  const cyclicChange = compatibleChange();
  cyclicChange.x_cycle = cyclicChange;
  assert.equal(
    evaluatePolicy(
      policyInput({ detection: detectionFor([cyclicChange]) }),
    ).decision,
    "error",
  );
});

test("rejects unsafe integers in extensible detection and declaration data", () => {
  const unsafe = Number.MAX_SAFE_INTEGER + 1;
  const detected = compatibleChange();
  detected.x_unsafe_integer = unsafe;
  const detectionResult = evaluatePolicy(
    policyInput({ detection: detectionFor([detected]) }),
  );
  assert.equal(detectionResult.decision, "error");
  assert.deepEqual(detectionResult.coverage, []);
  assert.deepEqual(detectionResult.diagnostics, [
    {
      code: "SEIP_POLICY_INPUT_INVALID",
      severity: "error",
      message: "Policy input is invalid.",
      path: "/detection/changes/0/x_unsafe_integer",
    },
  ]);

  const declaration = draftDeclaration(
    compatibleChange(),
    "decl_unsafe_integer",
  );
  declaration.x_unsafe_integer = unsafe;
  const declarationResult = evaluatePolicy(
    policyInput({ declarations: [declaration] }),
  );
  assert.equal(declarationResult.decision, "error");
  assert.deepEqual(declarationResult.coverage, []);
  assert.ok(
    declarationResult.diagnostics.some(
      (entry) =>
        entry.code === "SEIP_PROTOCOL_SCHEMA_INVALID" &&
        entry.path === "/declarations/0/x_unsafe_integer",
    ),
  );
});

test("rejects unsafe declaration arrays without reading their elements", () => {
  const cases = [];
  cases.push(new Array(1));

  const extra = [];
  extra.extra = true;
  cases.push(extra);

  const symbol = [];
  symbol[Symbol("extra")] = true;
  cases.push(symbol);

  class DeclarationArray extends Array {}
  cases.push(new DeclarationArray());

  let getterReads = 0;
  const accessor = new Array(1);
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      getterReads += 1;
      throw new Error("must not execute declaration getter");
    },
  });
  cases.push(accessor);

  for (const declarations of cases) {
    assert.doesNotThrow(() => {
      const result = evaluatePolicy(policyInput({ declarations }));
      assert.equal(result.decision, "error");
      assert.ok(
        diagnosticCodes(result).includes("SEIP_POLICY_INPUT_INVALID"),
      );
    });
  }
  assert.equal(getterReads, 0);
});

test("accepts null-prototype shells and shared acyclic detector extensions", () => {
  const change = compatibleChange();
  const shared = { nested: [1, 2, 3] };
  change.x_left = shared;
  change.x_right = shared;
  const input = Object.assign(
    Object.create(null),
    policyInput({
      detection: detectionFor([change]),
      declarations: [
        {
          ...draftDeclaration(change, "decl_extension"),
          x_policy_metadata: { owner: "platform" },
        },
      ],
    }),
  );
  const result = evaluatePolicy(input);
  assert.equal(result.decision, "pass");
});

test("enforces exact detection and declaration collection boundaries early", () => {
  const change = compatibleChange();
  const exactChanges = Array.from({ length: 10_000 }, () =>
    structuredClone(change),
  );
  const atChangeLimit = evaluatePolicy(
    policyInput({ detection: detectionFor(exactChanges) }),
  );
  assert.equal(
    diagnosticCodes(atChangeLimit).includes("SEIP_PROTOCOL_RESOURCE_LIMIT"),
    false,
  );

  let changeReads = 0;
  const tooManyChanges = new Array(10_001);
  Object.defineProperty(tooManyChanges, "0", {
    enumerable: true,
    get() {
      changeReads += 1;
      throw new Error("must reject count before reading changes");
    },
  });
  const changeLimit = evaluatePolicy(
    policyInput({ detection: detection({ changes: tooManyChanges }) }),
  );
  assert.equal(changeLimit.decision, "error");
  assert.deepEqual(diagnosticCodes(changeLimit), [
    "SEIP_PROTOCOL_RESOURCE_LIMIT",
  ]);
  assert.equal(changeReads, 0);

  const atDeclarationLimit = evaluatePolicy(
    policyInput({ declarations: Array(5_000).fill(null) }),
  );
  assert.equal(
    diagnosticCodes(atDeclarationLimit).includes(
      "SEIP_PROTOCOL_RESOURCE_LIMIT",
    ),
    false,
  );

  let declarationReads = 0;
  const tooManyDeclarations = new Array(5_001);
  Object.defineProperty(tooManyDeclarations, "0", {
    enumerable: true,
    get() {
      declarationReads += 1;
      throw new Error("must reject count before reading declarations");
    },
  });
  const declarationLimit = evaluatePolicy(
    policyInput({ declarations: tooManyDeclarations }),
  );
  assert.equal(declarationLimit.decision, "error");
  assert.deepEqual(diagnosticCodes(declarationLimit), [
    "SEIP_PROTOCOL_RESOURCE_LIMIT",
  ]);
  assert.equal(declarationReads, 0);
});

test("scopes detector byte, depth, and container resource limits", () => {
  const padded = compatibleChange();
  padded.x_padding = "x".repeat(2 * 1024 * 1024);
  const imported = evaluatePolicy(
    policyInput({
      detection: detectionFor([padded], {
        detector: { id: "imported", version: "1.0.0", mode: "imported" },
      }),
      detector_trust: {
        trusted: true,
        mode: "operator_import",
        authorization_id: "authorization-1",
      },
    }),
  );
  assert.deepEqual(diagnosticCodes(imported), ["SEIP_PROTOCOL_RESOURCE_LIMIT"]);

  const builtin = evaluatePolicy(
    policyInput({ detection: detectionFor([padded]) }),
  );
  assert.equal(
    diagnosticCodes(builtin).includes("SEIP_PROTOCOL_RESOURCE_LIMIT"),
    false,
  );

  const deep = compatibleChange();
  let nested = {};
  for (let index = 0; index < 130; index += 1) nested = { nested };
  deep.x_deep = nested;
  const depth = evaluatePolicy(
    policyInput({ detection: detectionFor([deep]) }),
  );
  assert.deepEqual(diagnosticCodes(depth), ["SEIP_PROTOCOL_RESOURCE_LIMIT"]);

  const wide = compatibleChange();
  wide.x_wide = Array.from({ length: 100_001 }, () => ({}));
  const containers = evaluatePolicy(
    policyInput({ detection: detectionFor([wide]) }),
  );
  assert.deepEqual(diagnosticCodes(containers), [
    "SEIP_PROTOCOL_RESOURCE_LIMIT",
  ]);
});

test("keeps evidence evaluation bounded without Cartesian diagnostic expansion", () => {
  const count = 300;
  const changes = Array.from({ length: count }, (_, index) =>
    breakingRemoval(`legacy_${index}`),
  );
  const consumers = Array.from({ length: count }, (_, index) => ({
    team: `team-${index}`,
  }));
  const validators = Array.from(
    { length: count },
    (_, index) => `validator-${index}`,
  );
  const declaration = proposedForEvidence(
    changes,
    consumers,
    "decl_evidence_scale",
  );
  const started = performance.now();
  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor(changes),
      declarations: [declaration],
      evidence: {
        mode: "all_consumers",
        required_validator_ids: validators,
        trusted_validator_ids: validators,
      },
    }),
  );
  const elapsed = performance.now() - started;

  assert.equal(result.decision, "fail");
  assert.equal(
    result.diagnostics.filter(
      (entry) => entry.code === "SEIP_POLICY_EVIDENCE_REQUIRED",
    ).length,
    1,
  );
  assert.ok(elapsed < 2_000, `evidence evaluation took ${elapsed}ms`);
});

test("matches source digest maps independent of key order and wall-clock age", () => {
  const change = breakingRemoval();
  const declaration = proposedForEvidence(
    [change],
    [{ team: "analytics" }],
    "decl_digest_order",
  );
  appendEvidence(
    declaration,
    {
      evidenceId: "evd_digest_order",
      team: "analytics",
      validatorId: "validator-a",
      sourceDigests: {
        after: "b".repeat(64),
        before: "a".repeat(64),
      },
    },
    3,
  );
  const result = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([change]),
      declarations: [declaration],
      evidence: {
        mode: "all_consumers",
        trusted_validator_ids: ["validator-a"],
      },
    }),
  );
  assert.equal(result.decision, "pass");
});

test("lets declaration validation reject invalid accepted acknowledgements first", () => {
  const change = breakingRemoval();
  const invalid = declarationIn("ACCEPTED", change, "decl_invalid_ack");
  invalid.responses.at(-1).decision = "OBJECTED";
  const responseEvent = invalid.events.findLast(
    (event) => event.type === "CONSUMER_RESPONDED",
  );
  responseEvent.details.decision = "OBJECTED";

  const result = evaluatePolicy(coordinatedInput(change, [invalid]));
  assert.equal(result.decision, "error");
  assert.deepEqual(result.coverage, []);
  assert.equal(
    diagnosticCodes(result).includes(
      "SEIP_POLICY_ACKNOWLEDGEMENT_REQUIRED",
    ),
    false,
  );
  assert.ok(
    result.diagnostics.some((entry) => entry.path.startsWith("/declarations/0")),
  );
});

test("normalizes diagnostics and results deterministically", () => {
  const changeA = breakingRemoval("legacy_a");
  const changeB = breakingRemoval("legacy_b");
  const declarationA = setCompletedAt(
    declarationIn("COMPLETED", changeA, "decl_history_a"),
    "2026-07-13T13:30:00Z",
  );
  const declarationB = setCompletedAt(
    declarationIn("COMPLETED", changeA, "decl_history_b"),
    "2026-07-13T13:00:00Z",
  );
  const warnings = [
    { code: "Z_WARNING", severity: "warning", message: "Zulu" },
    { code: "A_WARNING", severity: "warning", message: "Alpha" },
    { code: "A_WARNING", severity: "warning", message: "Alpha" },
  ];
  const left = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([changeB, changeA], { diagnostics: warnings }),
      declarations: [declarationB, declarationA],
    }),
  );
  const right = evaluatePolicy(
    policyInput({
      preset: "declared",
      detection: detectionFor([changeA, changeB], {
        diagnostics: [...warnings].reverse(),
      }),
      declarations: [declarationA, declarationB],
    }),
  );

  assert.deepEqual(left, right);
  assert.equal(
    left.diagnostics.filter((entry) => entry.code === "A_WARNING").length,
    1,
  );

  for (const result of [
    left,
    evaluatePolicy(policyInput({ detection: detection({ changes: [] }) })),
    evaluatePolicy(null),
  ]) {
    assert.equal(result.ok, result.decision === "pass");
  }
});
