# Operational Adoption Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare SEIP as a shippable operational adoption package for platform and data engineering teams.

**Architecture:** Keep Git as the canonical declaration store, keep the existing CLI/demo as the executable reference, and make documentation guide adopters from concept to local demo to CI rollout. Avoid expanding protocol scope; harden evidence, wording, and release gates around what the current implementation actually demonstrates.

**Tech Stack:** Node.js ESM CLI, `node --test`, Markdown docs, GitHub Actions YAML, D2/SVG/PNG diagrams.

---

## File Structure

- Modify: `README.md` as the primary adopter entry point.
- Modify: `docs/DEMO_RUNBOOK.md` to stay aligned with the canonical full workflow demo.
- Modify: `docs/SEIP_WHITEPAPER_FINAL.md` only where claims need alignment with the operational release.
- Modify: `examples/github-actions-template.yml` to remove hypothetical install instructions.
- Create: `docs/RELEASE_CHECKLIST.md` as the release evidence checklist.
- Modify: `.gitignore` to exclude local demo/generated SEIP state that should not ship.
- Inspect only: `.seip/`, `.seip-demo/`, `schema-v1.json`, `schema-v2.json`, `seip-agent.mjs`, `examples/foolproof-demo.mjs` to decide whether they are releasable assets or local artifacts.
- Verify: `npm test`, `npm run demo`, `git status --short`.

### Task 1: README Adopter Path

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Inspect current README release flow**

Run: `sed -n '1,220p' README.md`
Expected: README has overview, 30-second start, command table, protocol docs, and full demo section.

- [ ] **Step 2: Tighten adopter-facing structure**

Update `README.md` so a platform/data engineering reader can quickly follow:

```markdown
## Adoption Path

1. Run the full workflow demo.
2. Add the CI gate.
3. Create declarations for breaking changes.
4. Surface declarations in GitHub or Slack.
5. Require consumer acknowledgements before enforcement.
```

Include links to `docs/DEMO_RUNBOOK.md`, `examples/github-actions-template.yml`, `SPEC.md`, and the whitepaper.

- [ ] **Step 3: Verify README claims against package scripts**

Run: `node -e "const p=require('./package.json'); console.log(p.scripts.demo, p.scripts.test)"`
Expected: output includes `node examples/full-workflow.mjs` and `node --test`.

### Task 2: CI Template Hardening

**Files:**
- Modify: `examples/github-actions-template.yml`

- [ ] **Step 1: Inspect template**

Run: `sed -n '1,180p' examples/github-actions-template.yml`
Expected: template currently explains PR validation but contains a hypothetical package name.

- [ ] **Step 2: Replace hypothetical install path**

Update the install section to show two realistic options:

```yaml
- name: Install dependencies
  run: npm ci

- name: Validate schema changes
  run: npx seip validate schemas/schema-before.json schemas/schema-after.json --strict
```

Also note that adopters can replace `npx seip` with `node ./bin/seip.mjs` when vendoring the repo or testing locally.

- [ ] **Step 3: Check YAML readability**

Run: `sed -n '1,220p' examples/github-actions-template.yml`
Expected: no `seip-cli` or `Hypothetical` text remains.

### Task 3: Demo Runbook Alignment

**Files:**
- Modify: `docs/DEMO_RUNBOOK.md`
- Inspect: `examples/full-workflow.mjs`

- [ ] **Step 1: Compare runbook sections to demo steps**

Run: `rg -n "Step [0-9]|Full-Blown Demo|validate-consumer|COMPLETED|UNDER_REVIEW|ACCEPTED" docs/DEMO_RUNBOOK.md examples/full-workflow.mjs`
Expected: runbook and demo use the same scenario and step names.

- [ ] **Step 2: Add adoption-use-case framing**

Clarify that the demo proves the operational path: CI gate, declaration, GitHub/Slack adapters, consumer objection, negotiated timeline, acceptance, enforcement, closure, audit.

- [ ] **Step 3: Keep consumer-validation wording honest**

Ensure the runbook says `validate-consumer` is a reference hook that real teams wire to local checks.

### Task 4: Whitepaper Claim Audit

**Files:**
- Modify: `docs/SEIP_WHITEPAPER_FINAL.md`

- [ ] **Step 1: Inspect claims around workflow, validation, notification, and limitations**

Run: `rg -n "validate-consumer|GitHub adapter|Slack|reference CLI|Current Limitations|universal|notification" docs/SEIP_WHITEPAPER_FINAL.md`
Expected: claims are visible and can be compared to current CLI behavior.

- [ ] **Step 2: Add release/demo pointer**

Add a short note in the reference workflow or adoption path pointing readers to `docs/DEMO_RUNBOOK.md` and `npm run demo` for the executable demonstration.

- [ ] **Step 3: Keep limitations precise**

Confirm the paper does not imply universal consumer validation, direct GitHub API posting, or cross-repository state synchronization.

### Task 5: Release Checklist

**Files:**
- Create: `docs/RELEASE_CHECKLIST.md`

- [ ] **Step 1: Create checklist with prompt-to-artifact mapping**

Document each release claim and its evidence:

```markdown
| Requirement | Evidence | Verification |
| --- | --- | --- |
| Paper exists | docs/SEIP_WHITEPAPER_FINAL.md | inspect file |
| Full demo runs | examples/full-workflow.mjs | npm run demo |
| Full use case documented | docs/DEMO_RUNBOOK.md | inspect scenario |
| Tests pass | test/*.mjs | npm test |
```

- [ ] **Step 2: Include release commands**

List exact commands:

```bash
npm test
npm run demo
git status --short
```

- [ ] **Step 3: Include known non-goals**

State that npm publishing, real Slack delivery, direct GitHub API posting, and universal consumer validation are outside this operational release unless added later.

### Task 6: Local Artifact Hygiene

**Files:**
- Modify: `.gitignore`
- Inspect: `.seip/`, `.seip-demo/`, `schema-v1.json`, `schema-v2.json`, `seip-agent.mjs`, `examples/foolproof-demo.mjs`

- [ ] **Step 1: Classify untracked artifacts**

Run: `git status --short`
Expected: identify which untracked files are release assets versus local/generated artifacts.

- [ ] **Step 2: Ignore local generated state**

Add `.seip/` and `.seip-demo/` to `.gitignore` unless intentionally shipping sample declarations.

- [ ] **Step 3: Decide stale demo files**

If `examples/foolproof-demo.mjs`, `seip-agent.mjs`, root `schema-v1.json`, and root `schema-v2.json` are not part of the operational package, leave them untracked and document that they are local/experimental, or remove only with explicit user approval.

### Task 7: Verification And Release Audit

**Files:**
- Inspect all modified files.

- [ ] **Step 1: Run test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run full demo**

Run: `npm run demo`
Expected: exit code `0`, includes `SEIP Full-Blown Demo`, `UNDER_REVIEW`, `ACCEPTED`, `COMPLETED`, and `No SEIP server, database, or notification state store required.`

- [ ] **Step 3: Run final status check**

Run: `git status --short`
Expected: only intentional release changes and pre-existing untracked experimental files remain.

- [ ] **Step 4: Completion audit**

Build a checklist mapping the original objective to actual evidence before claiming the package is shippable.
