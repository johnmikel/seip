# Demo Repos Exhibit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generated multi-repo exhibit that demonstrates SEIP coordinating a realistic data/API/ML schema rollout.

**Architecture:** Add a standalone generator under `examples/demo-repos/` that creates several small Git repositories in `/tmp`, then runs a coordinated SEIP scenario from the producer repository. Keep generated repos outside the package working tree; commit only the generator, tests, and runbook.

**Tech Stack:** Node.js ESM, built-in `node:test`, existing SEIP CLI, generated JSON Schema, lightweight consumer validation scripts, disposable `/tmp` workspaces.

---

### Task 1: Regression Test

**Files:**
- Create: `test/demo-repos.test.mjs`

- [ ] **Step 1: Write the failing test**

Create a test that runs `examples/demo-repos/create-demo-repos.mjs` with `SEIP_DEMO_REPOS_DIR` set to a temp folder. Assert the command exits `0`, prints the expected exhibit markers, creates all producer/consumer repos, and writes a completed SEIP declaration with consumer validation evidence.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/demo-repos.test.mjs`

Expected: FAIL because the generator does not exist yet.

### Task 2: Multi-Repo Generator

**Files:**
- Create: `examples/demo-repos/create-demo-repos.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement generator**

Generate these repos under `/tmp/seip-demo-repos-<pid>` or `SEIP_DEMO_REPOS_DIR`: `commerce-events`, `partner-api`, `payments-ledger`, `warehouse-dbt`, `fraud-models`, and `mobile-analytics`.

- [ ] **Step 2: Implement scenario**

Run SEIP from `commerce-events`: diff `CheckoutCompleted.v2` and `CheckoutCompleted.v3`, fail CI before declaration, create/propose declaration, run consumer validation commands against generated consumer repos, record failed and passed `CONSUMER_VALIDATED` evidence, resolve objections/extensions, validate, enforce, close.

- [ ] **Step 3: Add package script**

Add `demo:repos` as `node examples/demo-repos/create-demo-repos.mjs`.

### Task 3: Documentation

**Files:**
- Create: `docs/DEMO_REPOS_RUNBOOK.md`
- Modify: `README.md`
- Modify: `docs/RELEASE_CHECKLIST.md`

- [ ] **Step 1: Add runbook**

Document repo layout, command, story beats, what to show in each generated repo, and cleanup.

- [ ] **Step 2: Link from README and release checklist**

Mention `npm run demo:repos` beside the existing demos and add it to release gates.

### Task 4: Verification And Commit

**Files:**
- All changed files

- [ ] **Step 1: Run targeted test**

Run: `node --test test/demo-repos.test.mjs`

- [ ] **Step 2: Run full test suite**

Run: `npm test`

- [ ] **Step 3: Run demo directly**

Run: `npm run demo:repos`

- [ ] **Step 4: Commit**

Stage all intentional files and commit with message `Add generated multi-repo SEIP exhibit`.
