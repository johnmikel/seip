# Enterprise Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complex SEIP demo that shows one breaking event schema rollout crossing API contracts, analytics, data platform, and ML consumers.

**Architecture:** Keep the existing quick demo unchanged and add a second standalone workflow script under `examples/`. The script creates a disposable repository, writes nested JSON Schema inputs, configures strict CI policy, creates a declaration from a multi-change diff, records consumer validation evidence, walks through objection/extension negotiation, and closes with audit output.

**Tech Stack:** Node.js ESM, built-in `node:test`, the existing SEIP CLI, JSON files in a disposable `/tmp` workspace.

---

### Task 1: Enterprise Demo Regression Test

**Files:**
- Create: `test/enterprise-demo.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that runs `examples/enterprise-workflow.mjs`, asserts exit code `0`, and checks for these output markers: `Enterprise Demo`, `CheckoutCompleted.v3`, `partner-api`, `fraud-models`, `warehouse-dbt`, `mobile-analytics`, `CONSUMER_VALIDATED`, `OBJECTED`, `EXTENSION_REQUESTED`, `ACCEPTED`, `COMPLETED`, and `Cross-runtime schema coordination`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/enterprise-demo.test.mjs`

Expected: FAIL because `examples/enterprise-workflow.mjs` does not exist yet.

### Task 2: Enterprise Workflow Script

**Files:**
- Create: `examples/enterprise-workflow.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement the demo script**

Follow `examples/full-workflow.mjs` conventions. The script should write JSON Schema v2/v3 files for `CheckoutCompleted`, configure `min_status: ACCEPTED`, require five consumers, and exercise:

- lossy `payment.amount` retype
- `customer.email` removal
- `customer.email_hash` addition
- `line_items[].sku` rename to `line_items[].product_id`
- `risk_score` required addition
- `payment.method` enum narrowing
- local `$defs`, `$ref`, arrays, nested objects, and `allOf`
- command-based consumer validation with recorded pass/fail evidence
- objection and extension request lifecycle states

- [ ] **Step 2: Add package script**

Add `demo:enterprise` as `node examples/enterprise-workflow.mjs`.

- [ ] **Step 3: Run targeted test**

Run: `node --test test/enterprise-demo.test.mjs`

Expected: PASS.

### Task 3: Presenter Documentation

**Files:**
- Create: `docs/ENTERPRISE_DEMO_RUNBOOK.md`
- Modify: `README.md`

- [ ] **Step 1: Add runbook**

Document the enterprise scenario, roles, expected command, story beats, output markers, and the distinction between the quick and enterprise demos.

- [ ] **Step 2: Link from README**

Mention `npm run demo:enterprise` beside the existing demo and link the new runbook.

### Task 4: Verification

**Files:**
- All changed files

- [ ] **Step 1: Run targeted test**

Run: `node --test test/enterprise-demo.test.mjs`

- [ ] **Step 2: Run full test suite**

Run: `npm test`

- [ ] **Step 3: Run enterprise demo directly**

Run: `npm run demo:enterprise`

- [ ] **Step 4: Check status**

Run: `git status --short`
