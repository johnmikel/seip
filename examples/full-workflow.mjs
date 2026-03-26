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
      name: 'account_record',
      properties: [
        { name: 'account_id', type: 'uuid', required: true },
        { name: 'account_name', type: 'string', required: true },
        { name: 'account_type', type: 'string', required: true },
        { name: 'institution', type: 'string', required: true },
        { name: 'region', type: 'string', required: true },
        { name: 'details', type: 'json', required: true }
      ]
    }
  ]
};

const schemaV2 = {
  objects: [
    {
      name: 'account_record',
      properties: [
        { name: 'account_id', type: 'uuid', required: true },
        { name: 'account_name', type: 'string', required: true },
        { name: 'account_type', type: 'string', required: true },
        { name: 'primary_financial_institution', type: 'string', required: true },
        { name: 'supporting_institutions', type: 'array', required: false },
        { name: 'region', type: 'string', required: true },
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
console.log(`${B}║  Aster Bank: Rename institution → primary_financial_inst ║${R}`);
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
run(`node ${CLI} create --id seip_multi_institution --summary "Rename institution → primary_financial_institution" --type rename --breaking --strategy dual_write --producer ledger-api --consumer payments-api --consumer risk-service --consumer frontend --consumer analytics --from-diff schema-v1.json schema-v2.json --rename account_record.institution:account_record.primary_financial_institution`);

// Enrich the generated declaration with business context and migration notes
import { loadDeclaration, saveDeclaration, diffSchemas } from '../src/index.mjs';
const declaration = loadDeclaration('seip_multi_institution', DEMO_DIR);
const diff = diffSchemas(schemaV1, schemaV2);
declaration.change.affected_objects = diff.affected.map(a => ({ object: a.object, property: a.property }));
declaration.change.details = 'Support multi-institution accounts (RFC-0021). The single institution field is replaced with primary_financial_institution (lead institution) and supporting_institutions (additional institutions).';
declaration.migration.steps = [
  'Phase 1: Dual-write both institution and primary_financial_institution',
  'Phase 2: Consumers migrate reads to primary_financial_institution',
  'Phase 3: Deprecate institution field (emit warnings)',
  'Phase 4: Remove institution from responses'
];
declaration.migration.sql = [
  '-- Warehouse migration',
  'ALTER TABLE account_records ADD COLUMN primary_financial_institution STRING;',
  'UPDATE account_records SET primary_financial_institution = institution WHERE primary_financial_institution IS NULL;'
];
declaration.migration.rollback = 'Revert presenter to emit only institution. Remove primary_financial_institution from responses.';
saveDeclaration(declaration, DEMO_DIR);

section('Step 5 — Propose the declaration');
run(`node ${CLI} propose seip_multi_institution`);

section('Step 6 — Consumers respond');

console.log(`  ${D}Payments team reviews and acknowledges...${R}`);
run(`node ${CLI} respond seip_multi_institution --team payments-api --status ACKNOWLEDGED --message "4 files affected. Mostly find-and-replace renames. ~1 day." --effort "1 day"`);

console.log(`  ${D}Risk team objects — needs backfill window...${R}`);
run(`node ${CLI} respond seip_multi_institution --team risk-service --status OBJECTED --message "Risk model backfill requires reprocessing 800K accounts. Need until May 15." --effort "1 week + backfill"`);

console.log(`  ${D}After negotiation, Risk acknowledges with an extended timeline...${R}`);
const updated = loadDeclaration('seip_multi_institution', DEMO_DIR);
updated.timeline.deprecation_date = new Date(Date.now() + 50 * 86400000).toISOString();
updated.timeline.removal_date = new Date(Date.now() + 75 * 86400000).toISOString();
// Reset risk-service consumer status for re-acknowledgement
const riskConsumer = updated.consumers.find(c => c.team === 'risk-service');
if (riskConsumer) riskConsumer.status = 'PENDING';
saveDeclaration(updated, DEMO_DIR);

run(`node ${CLI} respond seip_multi_institution --team risk-service --status ACKNOWLEDGED --message "Extension works. Will reprocess during the maintenance window." --effort "1 week"`);

console.log(`  ${D}Frontend and Analytics acknowledge...${R}`);
run(`node ${CLI} respond seip_multi_institution --team frontend --status ACKNOWLEDGED --message "2 files. Simple rename. Next release." --effort "2 hours"`);
run(`node ${CLI} respond seip_multi_institution --team analytics --status ACKNOWLEDGED --message "3 dbt models + dashboards. Auto-fixable." --effort "3 hours"`);

section('Step 7 — Validate again (should PASS now)');
run(`node ${CLI} validate schema-v1.json schema-v2.json`);

section('Step 8 — Review the audit log');
run(`node ${CLI} log seip_multi_institution`);

section('Step 9 — Start enforcement');
run(`node ${CLI} enforce seip_multi_institution --actor platform-lead`);

section('Step 10 — Close the declaration');
run(`node ${CLI} close seip_multi_institution --status COMPLETED --actor platform-lead`);

section('Step 11 — Check final status');
run(`node ${CLI} status seip_multi_institution`);

section('Summary');
console.log(`  ${B}What you just saw:${R}`);
console.log();
console.log(`  ${GR}1.${R} ${B}seip diff${R} detected a breaking rename + a safe addition`);
console.log(`  ${GR}2.${R} ${B}seip validate${R} ${RD}FAILED${R} the build — undeclared breaking change`);
console.log(`  ${GR}3.${R} ${B}seip create${R} scaffolded a declaration from the schema diff`);
console.log(`  ${GR}4.${R} ${B}seip propose${R} marked it as ready for consumer review`);
console.log(`  ${GR}5.${R} ${B}seip respond${R} let consumers ACK, object, and negotiate`);
console.log(`  ${GR}6.${R} ${B}seip validate${R} ${GR}PASSED${R} — breaking change now has a declaration`);
console.log(`  ${GR}7.${R} ${B}seip log${R} showed the full audit trail`);
console.log(`  ${GR}8.${R} ${B}seip enforce${R} and ${B}seip close${R} completed the lifecycle`);
console.log(`  ${GR}9.${R} Everything stored as JSON in ${B}.seip/declarations/${R} — version controlled`);
console.log();
console.log(`  ${B}Total setup:${R}    ${GR}0 dependencies, 0 config, 0 servers${R}`);
console.log(`  ${B}Storage:${R}        ${GR}JSON files in git — no database needed${R}`);
console.log(`  ${B}CI integration:${R} ${GR}seip validate before.json after.json || exit 1${R}`);
console.log();
console.log(`${D}─── End of demo ────────────────────────────────────────────────${R}`);
console.log();
