#!/usr/bin/env node

/**
 * SEIP - full-blown workflow demo
 *
 * This simulates a complete producer/consumer lifecycle in a disposable
 * repository under /tmp. It shows:
 *   - CI failing an undeclared breaking schema change
 *   - declaration creation from a diff
 *   - GitHub and Slack notification adapters
 *   - consumer validation and responses
 *   - objection, negotiation, acceptance, enforcement, closure, and audit
 *
 * Run:
 *   node examples/full-workflow.mjs
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { diffSchemas, loadDeclaration, saveDeclaration } from '../src/index.mjs';

const D = '\x1b[2m';
const R = '\x1b[0m';
const B = '\x1b[1m';
const GR = '\x1b[32m';
const RD = '\x1b[31m';
const YL = '\x1b[33m';
const CY = '\x1b[36m';

const DEMO_DIR = process.env.SEIP_DEMO_DIR || '/tmp/seip-full-blown-demo';
const CLI = join(process.cwd(), 'bin', 'seip.mjs');
const REPO_URL = 'https://github.com/acme/ledger-api';
const DECLARATION_ID = 'seip_transaction_value_precision';

function section(text) {
  console.log();
  console.log(`${B}${CY}--- ${text} ${'-'.repeat(Math.max(0, 58 - text.length))}${R}`);
  console.log();
}

function run(command, options = {}) {
  const label = command.replace(/node .*?seip\.mjs/g, 'seip');
  console.log(`  ${CY}$ ${label}${R}`);
  try {
    const output = execSync(command, {
      cwd: DEMO_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });
    if (output.trim()) console.log(output);
    return { ok: true, output };
  } catch (error) {
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return { ok: false, output: error.stdout || '', error };
  }
}

function loadDeclarationFile() {
  return JSON.parse(
    readFileSync(join(DEMO_DIR, '.seip', 'declarations', `${DECLARATION_ID}.json`), 'utf8')
  );
}

function saveDeclarationFile(declaration) {
  saveDeclaration(declaration, DEMO_DIR);
}

function writeDemoSchemas() {
  const schemaV1 = {
    objects: [
      {
        name: 'transaction',
        properties: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'account_id', type: 'uuid', required: true },
          { name: 'value', type: 'float', required: true },
          { name: 'currency', type: 'string', required: true },
          { name: 'merchant_category', type: 'string', required: false }
        ]
      }
    ]
  };

  const schemaV2 = {
    objects: [
      {
        name: 'transaction',
        properties: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'account_id', type: 'uuid', required: true },
          { name: 'value', type: 'integer', required: true },
          { name: 'currency', type: 'string', required: true },
          { name: 'merchant_category', type: 'string', required: false },
          { name: 'rounding_policy', type: 'string', required: false }
        ]
      }
    ]
  };

  writeFileSync(join(DEMO_DIR, 'schema-v1.json'), JSON.stringify(schemaV1, null, 2));
  writeFileSync(join(DEMO_DIR, 'schema-v2.json'), JSON.stringify(schemaV2, null, 2));
  return { schemaV1, schemaV2 };
}

function enrichDeclaration(schemaV1, schemaV2) {
  const declaration = loadDeclaration(DECLARATION_ID, DEMO_DIR);
  const diff = diffSchemas(schemaV1, schemaV2, { strict: true });
  declaration.change.details = [
    'Ledger values are moving from decimal major units to integer minor units.',
    'The producer will dual-write both representations before removing the decimal value.'
  ].join(' ');
  declaration.change.affected_objects = diff.affected.map(change => ({
    object: change.object,
    property: change.property,
    change_type: change.change_type,
    lossy: change.lossy || false,
    before_type: change.before?.type || null,
    after_type: change.after?.type || null
  }));
  declaration.migration.steps = [
    'Phase 1: Emit both value and value_minor_units.',
    'Phase 2: Consumers validate parsers, queries, and models against integer minor units.',
    'Phase 3: Freeze decimal reads after all required consumers acknowledge.',
    'Phase 4: Remove decimal value after the deprecation window.'
  ];
  declaration.migration.sql = [
    'ALTER TABLE transactions ADD COLUMN value_minor_units INTEGER;',
    'UPDATE transactions SET value_minor_units = CAST(value * 100 AS INTEGER) WHERE value_minor_units IS NULL;'
  ];
  declaration.migration.rollback = 'Continue emitting decimal value and disable integer-only readers.';
  saveDeclarationFile(declaration);
}

function resetConsumerStatus(team, status = 'PENDING') {
  const declaration = loadDeclarationFile();
  const consumer = declaration.consumers.find(c => c.team === team);
  if (consumer) consumer.status = status;
  saveDeclarationFile(declaration);
}

function printNotificationSnippet(title, output, maxLines = 26) {
  console.log(`  ${B}${title}${R}`);
  const lines = output.trim().split('\n').slice(0, maxLines);
  for (const line of lines) console.log(`  ${line}`);
  if (output.trim().split('\n').length > maxLines) console.log(`  ${D}...snipped for demo readability...${R}`);
  console.log();
}

// Setup

if (existsSync(DEMO_DIR)) rmSync(DEMO_DIR, { recursive: true, force: true });
mkdirSync(DEMO_DIR, { recursive: true });
const { schemaV1, schemaV2 } = writeDemoSchemas();

console.log();
console.log(`${B}============================================================${R}`);
console.log(`${B}SEIP Full-Blown Demo${R}`);
console.log(`${B}Ledger API: decimal transaction values -> integer minor units${R}`);
console.log(`${B}============================================================${R}`);
console.log();
console.log(`${D}Workspace: ${DEMO_DIR}${R}`);
console.log(`${D}Scenario: ledger-api proposes a lossy retype consumed by payments, risk, and analytics.${R}`);

section('Step 1 - Initialise SEIP in the demo repo');
run(`node ${CLI} init`);

section('Step 2 - Diff schemas and expose lossy type risk');
run(`node ${CLI} diff schema-v1.json schema-v2.json --strict`);

section('Step 3 - CI gate blocks undeclared breaking change');
const firstValidation = run(`node ${CLI} validate schema-v1.json schema-v2.json --strict`);
if (!firstValidation.ok) {
  console.log(`  ${RD}CI gate blocks undeclared breaking change.${R}`);
}

section('Step 4 - Producer creates and enriches a declaration');
run([
  `node ${CLI} create`,
  `--id ${DECLARATION_ID}`,
  '--summary "Convert transaction.value from float to integer minor units"',
  '--type retype',
  '--breaking',
  '--strategy dual_write_precision_guard',
  '--producer ledger-api',
  '--consumer payments-api',
  '--consumer risk-service',
  '--consumer analytics',
  '--from-diff schema-v1.json schema-v2.json'
].join(' '));
enrichDeclaration(schemaV1, schemaV2);
console.log(`  ${GR}Declaration enriched with migration phases, SQL, rollback, and type metadata.${R}`);

section('Step 5 - Producer proposes the declaration');
run(`node ${CLI} propose ${DECLARATION_ID} --actor ledger-api`);

section('Step 6 - GitHub PR comment / Actions summary');
const githubNotification = run(
  `node ${CLI} notify ${DECLARATION_ID} --adapter github --repo-url ${REPO_URL}`
);
printNotificationSnippet('Generated GitHub Markdown payload:', githubNotification.output);

section('Step 7 - Slack channel dry-run');
const slackNotification = run(
  `node ${CLI} notify ${DECLARATION_ID} --adapter slack --webhook mock://slack/schema-changes --repo-url ${REPO_URL} --dry-run --json`
);
const slackJson = JSON.parse(slackNotification.output);
console.log(`  ${GR}Slack channel dry-run:${R} ${slackJson.target}`);
console.log(`  ${D}Adapter:${R} ${slackJson.adapter}`);
console.log(`  ${D}Delivered:${R} ${slackJson.delivered}`);
console.log(`  ${D}Payload blocks:${R} ${slackJson.payload.attachments[0].blocks.length}`);

section('Step 8 - Consumers validate and respond');
console.log(`  ${D}payments-api validates parser compatibility and acknowledges.${R}`);
run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./services/payments/queries`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team payments-api',
  '--status ACKNOWLEDGED',
  '--message "Validation passed; payments already stores minor units internally."',
  '--effort "0.5 day"'
].join(' '));

console.log(`  ${D}risk-service validates fraud models and objects to precision loss.${R}`);
run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./services/risk/models`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team risk-service',
  '--status OBJECTED',
  '--message "Fraud model thresholds require decimal precision during backfill."',
  '--effort "blocked until backfill rehearsal"'
].join(' '));

section('Step 9 - Negotiation updates timeline and risk-service acknowledges');
const negotiated = loadDeclarationFile();
negotiated.timeline.deprecation_date = new Date(Date.now() + 45 * 86400000).toISOString();
negotiated.timeline.removal_date = new Date(Date.now() + 75 * 86400000).toISOString();
negotiated.migration.steps.push('Phase 2b: Risk replays 30 days of fraud decisions before acknowledgement.');
saveDeclarationFile(negotiated);
resetConsumerStatus('risk-service');

run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team risk-service',
  '--status ACKNOWLEDGED',
  '--message "Extended timeline and replay rehearsal accepted."',
  '--effort "3 days"'
].join(' '));

console.log(`  ${D}analytics validates warehouse models and acknowledges.${R}`);
run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./warehouse/dbt/models`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team analytics',
  '--status ACKNOWLEDGED',
  '--message "dbt models updated to use minor units."',
  '--effort "1 day"'
].join(' '));

section('Step 10 - CI gate passes after declaration and acknowledgements');
run(`node ${CLI} validate schema-v1.json schema-v2.json --strict`);

section('Step 11 - Audit log, enforcement, and closure');
run(`node ${CLI} log ${DECLARATION_ID}`);
run(`node ${CLI} enforce ${DECLARATION_ID} --actor platform-lead`);
run(`node ${CLI} close ${DECLARATION_ID} --status COMPLETED --actor platform-lead`);
run(`node ${CLI} status ${DECLARATION_ID}`);

section('Summary');
console.log(`  ${B}What this full-blown demo proves:${R}`);
console.log(`  ${GR}1.${R} CI catches the undeclared lossy type change before merge.`);
console.log(`  ${GR}2.${R} A producer creates one Git-backed declaration from the diff.`);
console.log(`  ${GR}3.${R} GitHub and Slack adapters render the same canonical state.`);
console.log(`  ${GR}4.${R} Consumers validate, acknowledge, object, and renegotiate in the lifecycle.`);
console.log(`  ${GR}5.${R} The declaration moves through UNDER_REVIEW, ACCEPTED, ENFORCING, and COMPLETED.`);
console.log(`  ${GR}6.${R} The audit log preserves the coordination trail.`);
console.log();
console.log(`  ${B}Architecture:${R} ${GR}No SEIP server, database, or notification state store required.${R}`);
console.log(`  ${B}Canonical state:${R} ${GR}.seip/declarations/${DECLARATION_ID}.json${R}`);
console.log(`  ${B}Demo workspace:${R} ${GR}${DEMO_DIR}${R}`);
console.log();
console.log(`${D}--- End of SEIP Full-Blown Demo ----------------------------${R}`);
