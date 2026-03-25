#!/usr/bin/env node

/**
 * SEIP — Full workflow demo
 *
 * This simulates an entire schema change lifecycle using the CLI
 * programmatically. Run it to see SEIP in action end to end.
 *
 *   node examples/full-workflow.mjs
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const D = '\x1b[2m', R = '\x1b[0m', B = '\x1b[1m';
const GR = '\x1b[32m', RD = '\x1b[31m', YL = '\x1b[33m', CY = '\x1b[36m';

const DEMO_DIR = '/tmp/seip-demo';

function run(cmd, opts = {}) {
  const label = cmd.replace(/node .*?seip\.mjs/g, 'seip');
  console.log(`  ${CY}$ ${label}${R}`);
  try {
    const output = execSync(cmd, { cwd: DEMO_DIR, encoding: 'utf-8', ...opts });
    if (output.trim()) console.log(output);
    return { ok: true, output };
  } catch (e) {
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
    return { ok: false, output: e.stdout || '' };
  }
}

function section(text) {
  console.log();
  console.log(`${B}${CY}─── ${text} ${'─'.repeat(Math.max(0, 54 - text.length))}${R}`);
  console.log();
}

// ── Setup ────────────────────────────────────────────────────────────────────

if (existsSync(DEMO_DIR)) rmSync(DEMO_DIR, { recursive: true });
mkdirSync(DEMO_DIR, { recursive: true });

const CLI = join(process.cwd(), 'bin', 'seip.mjs');

// Create schema files
const schemaV1 = {
  objects: [
    {
      name: 'content_item',
      properties: [
        { name: 'content_id', type: 'uuid', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'base_path', type: 'string', required: true },
        { name: 'organisation', type: 'string', required: true },
        { name: 'locale', type: 'string', required: true },
        { name: 'details', type: 'json', required: true }
      ]
    }
  ]
};

const schemaV2 = {
  objects: [
    {
      name: 'content_item',
      properties: [
        { name: 'content_id', type: 'uuid', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'base_path', type: 'string', required: true },
        { name: 'primary_publishing_organisation', type: 'string', required: true },
        { name: 'supporting_organisations', type: 'array', required: false },
        { name: 'locale', type: 'string', required: true },
        { name: 'details', type: 'json', required: true }
      ]
    }
  ]
};

writeFileSync(join(DEMO_DIR, 'schema-v1.json'), JSON.stringify(schemaV1, null, 2));
writeFileSync(join(DEMO_DIR, 'schema-v2.json'), JSON.stringify(schemaV2, null, 2));

// ── Demo ─────────────────────────────────────────────────────────────────────

console.log();
console.log(`${B}╔═══════════════════════════════════════════════════════════╗${R}`);
console.log(`${B}║  SEIP — Full Workflow Demo                               ║${R}`);
console.log(`${B}║  GOV.UK: Rename organisation → primary_publishing_org    ║${R}`);
console.log(`${B}╚═══════════════════════════════════════════════════════════╝${R}`);

section('Step 1 — Initialise SEIP in your repo');
run(`node ${CLI} init`);

section('Step 2 — Diff the schema change');
run(`node ${CLI} diff schema-v1.json schema-v2.json`);

section('Step 3 — Try to validate WITHOUT a declaration');
console.log(`  ${D}(This should FAIL — there's a breaking change with no declaration)${R}`);
console.log();
const validateResult = run(`node ${CLI} validate schema-v1.json schema-v2.json`);
if (!validateResult.ok) {
  console.log(`  ${RD}^ CI build would fail here. Good — it caught the undeclared breaking change.${R}`);
}

section('Step 4 — Create a declaration for the breaking change');
run(`node ${CLI} create --id scd_govuk_multi_org --summary "Rename organisation → primary_publishing_organisation" --type rename --breaking --strategy dual_write --producer publishing-api --consumer content-store --consumer search-api --consumer frontend --consumer analytics`);

// Now manually add affected_objects to the saved declaration
import { loadDeclaration, saveDeclaration, diffSchemas } from '../src/index.mjs';
const scd = loadDeclaration('scd_govuk_multi_org', DEMO_DIR);
const diff = diffSchemas(schemaV1, schemaV2);
scd.change.affected_objects = diff.affected;
scd.change.details = 'Support multi-org publishing (RFC-0047). The single organisation field is replaced with primary_publishing_organisation (lead publisher) and supporting_organisations (additional publishers).';
scd.migration.steps = [
  'Phase 1: Dual-write both organisation and primary_publishing_organisation',
  'Phase 2: Consumers migrate reads to primary_publishing_organisation',
  'Phase 3: Deprecate organisation field (emit warnings)',
  'Phase 4: Remove organisation from responses'
];
scd.migration.sql = [
  '-- BigQuery migration',
  'ALTER TABLE content_items ADD COLUMN primary_publishing_organisation STRING;',
  'UPDATE content_items SET primary_publishing_organisation = organisation WHERE primary_publishing_organisation IS NULL;'
];
scd.migration.rollback = 'Revert presenter to emit only organisation. Remove primary_publishing_organisation from responses.';
saveDeclaration(scd, DEMO_DIR);

section('Step 5 — Propose the declaration');
run(`node ${CLI} propose scd_govuk_multi_org`);

section('Step 6 — Consumers respond');

console.log(`  ${D}Content Store team reviews and acknowledges...${R}`);
run(`node ${CLI} respond scd_govuk_multi_org --team content-store --status ACKNOWLEDGED --message "4 files affected. All find-and-replace renames. ~1 day." --effort "1 day"`);

console.log(`  ${D}Search API team objects — needs reindex window...${R}`);
run(`node ${CLI} respond scd_govuk_multi_org --team search-api --status OBJECTED --message "ES mapping change requires full reindex of 800K docs. Need until May 15." --effort "1 week + reindex"`);

console.log(`  ${D}After negotiation, Search API acknowledges with extended timeline...${R}`);
const updated = loadDeclaration('scd_govuk_multi_org', DEMO_DIR);
updated.timeline.deprecation_date = new Date(Date.now() + 50 * 86400000).toISOString();
updated.timeline.removal_date = new Date(Date.now() + 75 * 86400000).toISOString();
// Reset search-api consumer status for re-acknowledgement
const searchConsumer = updated.consumers.find(c => c.team === 'search-api');
if (searchConsumer) searchConsumer.status = 'PENDING';
saveDeclaration(updated, DEMO_DIR);

run(`node ${CLI} respond scd_govuk_multi_org --team search-api --status ACKNOWLEDGED --message "Extension works. Will reindex on bank holiday weekend." --effort "1 week"`);

console.log(`  ${D}Frontend and Analytics acknowledge...${R}`);
run(`node ${CLI} respond scd_govuk_multi_org --team frontend --status ACKNOWLEDGED --message "2 files. Simple rename. Next release." --effort "2 hours"`);
run(`node ${CLI} respond scd_govuk_multi_org --team analytics --status ACKNOWLEDGED --message "3 dbt models + Looker. Auto-fixable." --effort "3 hours"`);

section('Step 7 — Validate again (should PASS now)');
run(`node ${CLI} validate schema-v1.json schema-v2.json`);

section('Step 8 — Check final status');
run(`node ${CLI} status scd_govuk_multi_org`);

section('Summary');
console.log(`  ${B}What you just saw:${R}`);
console.log();
console.log(`  ${GR}1.${R} ${B}seip diff${R} detected a breaking rename + a safe addition`);
console.log(`  ${GR}2.${R} ${B}seip validate${R} ${RD}FAILED${R} the build — undeclared breaking change`);
console.log(`  ${GR}3.${R} ${B}seip create${R} scaffolded a declaration with consumers and timeline`);
console.log(`  ${GR}4.${R} ${B}seip propose${R} marked it as ready for consumer review`);
console.log(`  ${GR}5.${R} ${B}seip respond${R} let consumers ACK, object, and negotiate`);
console.log(`  ${GR}6.${R} ${B}seip validate${R} ${GR}PASSED${R} — breaking change now has a declaration`);
console.log(`  ${GR}7.${R} Everything stored as JSON in ${B}.seip/declarations/${R} — version controlled`);
console.log();
console.log(`  ${B}Total setup:${R}    ${GR}0 dependencies, 0 config, 0 servers${R}`);
console.log(`  ${B}Storage:${R}        ${GR}JSON files in git — no database needed${R}`);
console.log(`  ${B}CI integration:${R} ${GR}seip validate before.json after.json || exit 1${R}`);
console.log();
console.log(`${D}─── End of demo ────────────────────────────────────────────────${R}`);
console.log();
