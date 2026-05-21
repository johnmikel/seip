#!/usr/bin/env node

/**
 * Generate a realistic SEIP multi-repo exhibit under /tmp.
 *
 * The generated workspace contains a producer repo plus five consumer repos.
 * The script also runs a complete SEIP scenario from the producer repository.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { diffSchemas, isBreakingChange, loadDeclaration, saveDeclaration } from '../../src/index.mjs';

const D = '\x1b[2m';
const R = '\x1b[0m';
const B = '\x1b[1m';
const GR = '\x1b[32m';
const RD = '\x1b[31m';
const YL = '\x1b[33m';
const CY = '\x1b[36m';

const WORKSPACE = process.env.SEIP_DEMO_REPOS_DIR || `/tmp/seip-demo-repos-${process.pid}`;
const CLI = join(process.cwd(), 'bin', 'seip.mjs');
const PRODUCER = join(WORKSPACE, 'commerce-events');
const DECLARATION_ID = 'seip_checkout_completed_v3';
const REPO_URL = 'https://github.com/acme/commerce-events';
const CONSUMERS = [
  'payments-ledger',
  'partner-api',
  'fraud-models',
  'warehouse-dbt',
  'mobile-analytics'
];

function section(text) {
  console.log();
  console.log(`${B}${CY}--- ${text} ${'-'.repeat(Math.max(0, 64 - text.length))}${R}`);
  console.log();
}

function writeFile(repo, path, contents) {
  const absolute = join(WORKSPACE, repo, path);
  mkdirSync(absolute.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(absolute, contents);
}

function writeJson(repo, path, value) {
  writeFile(repo, path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, cwd = PRODUCER, options = {}) {
  const label = command.replace(/node .*?seip\.mjs/g, 'seip').replaceAll(WORKSPACE, '$DEMO_REPOS');
  console.log(`  ${CY}$ ${label}${R}`);
  try {
    const output = execSync(command, {
      cwd,
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

function initGitRepo(repo) {
  const cwd = join(WORKSPACE, repo);
  execSync('git init -q', { cwd, stdio: 'ignore' });
  execSync('git add -A', { cwd, stdio: 'ignore' });
  execSync('git commit -q -m "Initial demo repo state"', {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'SEIP Demo',
      GIT_AUTHOR_EMAIL: 'demo@example.com',
      GIT_COMMITTER_NAME: 'SEIP Demo',
      GIT_COMMITTER_EMAIL: 'demo@example.com'
    }
  });
}

function commitIfChanged(repo, message) {
  const cwd = join(WORKSPACE, repo);
  execSync('git add -A', { cwd, stdio: 'ignore' });
  const status = execSync('git status --short', { cwd, encoding: 'utf8' });
  if (!status.trim()) return;
  execSync(`git commit -q -m "${message}"`, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'SEIP Demo',
      GIT_AUTHOR_EMAIL: 'demo@example.com',
      GIT_COMMITTER_NAME: 'SEIP Demo',
      GIT_COMMITTER_EMAIL: 'demo@example.com'
    }
  });
}

function makeWorkspace() {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true, force: true });
  for (const repo of ['commerce-events', ...CONSUMERS]) {
    mkdirSync(join(WORKSPACE, repo), { recursive: true });
  }
}

function checkoutSchemas() {
  const base = {
    type: 'object',
    required: ['event_id', 'occurred_at', 'checkout_id'],
    properties: {
      event_id: { type: 'string', format: 'uuid' },
      occurred_at: { type: 'string', format: 'date-time' },
      checkout_id: { type: 'string' }
    }
  };

  const v2 = {
    title: 'CheckoutCompleted',
    allOf: [
      { $ref: '#/$defs/BaseEvent' },
      {
        type: 'object',
        required: ['customer', 'payment', 'line_items'],
        properties: {
          customer: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' }
            }
          },
          payment: {
            type: 'object',
            required: ['amount', 'currency', 'method'],
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
              method: { type: 'string', enum: ['card', 'bank', 'paypal', 'cash'] }
            }
          },
          line_items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['sku', 'quantity'],
              properties: {
                sku: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          }
        }
      }
    ],
    $defs: { BaseEvent: base }
  };

  const v3 = {
    title: 'CheckoutCompleted',
    allOf: [
      { $ref: '#/$defs/BaseEvent' },
      {
        type: 'object',
        required: ['customer', 'payment', 'line_items', 'risk_score'],
        properties: {
          customer: {
            type: 'object',
            required: ['id', 'email_hash'],
            properties: {
              id: { type: 'string' },
              email_hash: { type: 'string', format: 'sha256' }
            }
          },
          payment: {
            type: 'object',
            required: ['amount', 'currency', 'method'],
            properties: {
              amount: { type: 'integer' },
              currency: { type: 'string' },
              method: { type: 'string', enum: ['card', 'bank'] }
            }
          },
          line_items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['product_id', 'quantity'],
              properties: {
                product_id: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          },
          risk_score: { type: 'integer' }
        }
      }
    ],
    $defs: { BaseEvent: base }
  };

  return { v2, v3 };
}

function createProducerRepo() {
  const { v2, v3 } = checkoutSchemas();
  writeFile('commerce-events', 'README.md', `# commerce-events

Producer repo for the SEIP demo repo exhibit.

This repo owns the \`CheckoutCompleted\` event contract and coordinates the
\`CheckoutCompleted.v3\` rollout with SEIP.

Useful commands:

\`\`\`bash
node ${CLI} diff schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict
node ${CLI} validate schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict
node ${CLI} status seip_checkout_completed_v3
node ${CLI} log seip_checkout_completed_v3
\`\`\`
`);
  writeJson('commerce-events', 'schemas/checkout-completed-v2.schema.json', v2);
  writeJson('commerce-events', 'schemas/checkout-completed-v3.schema.json', v3);
  writeJson('commerce-events', 'package.json', {
    name: '@demo/commerce-events',
    private: true,
    scripts: {
      'seip:diff': `node ${CLI} diff schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`,
      'seip:validate': `node ${CLI} validate schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`
    }
  });
  writeFile('commerce-events', '.github/workflows/seip.yml', `name: SEIP

on:
  pull_request:
    paths:
      - "schemas/**/*.json"

jobs:
  validate-schema-change:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/seip@v0.2
        with:
          before-schema: schemas/checkout-completed-v2.schema.json
          after-schema: schemas/checkout-completed-v3.schema.json
          seip-args: --strict
`);

  return { v2, v3 };
}

function consumerCheckScript(repo, checkBody) {
  writeFile(repo, 'checks/validate.mjs', `#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const target = process.env.SEIP_CONSUMER_PATH || process.cwd();
const declarationPath = process.env.SEIP_DECLARATION_PATH;
const declaration = declarationPath ? JSON.parse(readFileSync(declarationPath, 'utf8')) : {};

${checkBody}
`);
}

function createConsumerRepos() {
  writeFile('payments-ledger', 'README.md', `# payments-ledger

Consumer repo that validates integer minor-unit money semantics before
acknowledging \`CheckoutCompleted.v3\`.
`);
  writeFile('payments-ledger', 'contracts/minor-units-ready.marker', 'ready\n');
  writeJson('payments-ledger', 'package.json', {
    name: '@demo/payments-ledger',
    private: true,
    scripts: { 'seip:validate-consumer': 'node checks/validate.mjs' }
  });
  consumerCheckScript('payments-ledger', `if (!existsSync(join(target, 'minor-units-ready.marker'))) {
  console.error('payments-ledger has not switched to minor units');
  process.exit(1);
}
console.log('payments-ledger validates integer minor units for ' + declaration.declaration_id);`);

  writeFile('partner-api', 'README.md', `# partner-api

Consumer repo representing an external API surface. It starts broken because
public clients still expect \`customer.email\`.
`);
  writeFile('partner-api', 'contracts/openapi-checkout-client.json', '{"expects":"customer.email"}\n');
  writeJson('partner-api', 'package.json', {
    name: '@demo/partner-api',
    private: true,
    scripts: { 'seip:validate-consumer': 'node checks/validate.mjs' }
  });
  consumerCheckScript('partner-api', `if (!existsSync(join(target, 'accepts-email-hash.marker'))) {
  console.error('partner-api still expects customer.email');
  process.exit(1);
}
console.log('partner-api accepts customer.email_hash for ' + declaration.declaration_id);`);

  writeFile('fraud-models', 'README.md', `# fraud-models

Consumer repo representing ML feature and replay safety. It starts broken until
the replay threshold is recalibrated for integer minor units.
`);
  writeFile('fraud-models', 'features/checkout_features.sql', 'select payment_amount, payment_method from checkout_completed_v2;\n');
  writeJson('fraud-models', 'package.json', {
    name: '@demo/fraud-models',
    private: true,
    scripts: { 'seip:validate-consumer': 'node checks/validate.mjs' }
  });
  consumerCheckScript('fraud-models', `if (!existsSync(join(target, 'replay-approved.marker'))) {
  console.error('fraud-model replay drift exceeds threshold');
  process.exit(1);
}
console.log('fraud-models replay approved for ' + declaration.declaration_id);`);

  writeFile('warehouse-dbt', 'README.md', `# warehouse-dbt

Consumer repo representing warehouse lineage. It can validate current dual
columns but requests an extension before legacy v2 removal.
`);
  writeFile('warehouse-dbt', 'models/fct_checkout_completed.sql', 'select customer_email_hash, amount_minor_units, product_id from checkout_completed_v3;\n');
  writeFile('warehouse-dbt', 'models/dual-column-compiled.marker', 'ready\n');
  writeJson('warehouse-dbt', 'package.json', {
    name: '@demo/warehouse-dbt',
    private: true,
    scripts: { 'seip:validate-consumer': 'node checks/validate.mjs' }
  });
  consumerCheckScript('warehouse-dbt', `if (!existsSync(join(target, 'dual-column-compiled.marker'))) {
  console.error('warehouse-dbt model lineage has not compiled');
  process.exit(1);
}
console.log('warehouse-dbt lineage compiled for ' + declaration.declaration_id);`);

  writeFile('mobile-analytics', 'README.md', `# mobile-analytics

Consumer repo representing analytics event mapping. It remains pending until
mobile tracking moves from \`sku\` to \`product_id\`.
`);
  writeFile('mobile-analytics', 'events/checkout_completed.map.json', '{"line_items_key":"sku"}\n');
  writeJson('mobile-analytics', 'package.json', {
    name: '@demo/mobile-analytics',
    private: true,
    scripts: { 'seip:validate-consumer': 'node checks/validate.mjs' }
  });
  consumerCheckScript('mobile-analytics', `if (!existsSync(join(target, 'product-id-map-ready.marker'))) {
  console.error('mobile analytics still maps line_items[].sku');
  process.exit(1);
}
console.log('mobile-analytics maps product_id for ' + declaration.declaration_id);`);
}

function configureSeipPolicy() {
  writeJson('commerce-events', '.seip/config.json', {
    defaults: {
      producer: 'checkout-api',
      review_days: 10,
      deprecate_days: 45,
      remove_days: 90
    },
    policy: {
      strict_required_additions: true,
      min_status: 'ACCEPTED',
      required_consumers: CONSUMERS
    }
  });
}

function declarationFile() {
  return join(PRODUCER, '.seip', 'declarations', `${DECLARATION_ID}.json`);
}

function loadDeclarationFile() {
  return JSON.parse(readFileSync(declarationFile(), 'utf8'));
}

function saveDeclarationFile(declaration) {
  saveDeclaration(declaration, PRODUCER);
}

function enrichDeclaration(v2, v3) {
  const declaration = loadDeclaration(DECLARATION_ID, PRODUCER);
  const diff = diffSchemas(v2, v3, { strict: true });
  declaration.change.details = 'Generated demo-repos pilot: API, data, analytics, payments, and ML consumers coordinate CheckoutCompleted.v3.';
  declaration.change.affected_objects = diff.affected.map(change => ({
    object: change.object,
    property: change.property,
    change_type: change.change_type,
    lossy: change.lossy || false,
    before_type: change.before?.type || null,
    after_type: change.after?.type || null
  }));
  declaration.change.renames = [
    { object: 'CheckoutCompleted', from: 'line_items[].sku', to: 'line_items[].product_id' }
  ];
  declaration.migration.steps = [
    'Dual-publish CheckoutCompleted.v2 and CheckoutCompleted.v3.',
    'Publish partner migration guide for customer.email_hash.',
    'Run consumer checks in each downstream repo.',
    'Recalibrate fraud model thresholds.',
    'Remove v2 readers after all required consumers acknowledge.'
  ];
  declaration.migration.sql = [
    'ALTER TABLE checkout_events ADD COLUMN customer_email_hash TEXT;',
    'ALTER TABLE checkout_events ADD COLUMN amount_minor_units INTEGER;',
    'ALTER TABLE checkout_line_items ADD COLUMN product_id TEXT;'
  ];
  declaration.migration.rollback = 'Keep publishing CheckoutCompleted.v2 and disable v3-only consumers.';
  saveDeclarationFile(declaration);
  return diff;
}

function validateConsumer(team, relativeTarget, record = true) {
  const repoPath = join(WORKSPACE, team);
  const target = join(repoPath, relativeTarget);
  return run([
    `node ${CLI} validate-consumer ${DECLARATION_ID}`,
    `--against "${target}"`,
    `--command "node ${join(repoPath, 'checks', 'validate.mjs')}"`,
    record ? '--record' : '',
    record ? `--team ${team}` : '',
    '--json'
  ].filter(Boolean).join(' '));
}

function respond(team, status, message, effort) {
  return run([
    `node ${CLI} respond ${DECLARATION_ID}`,
    `--team ${team}`,
    `--status ${status}`,
    `--message "${message}"`,
    effort ? `--effort "${effort}"` : ''
  ].filter(Boolean).join(' '));
}

function resetConsumerStatus(team) {
  const declaration = loadDeclarationFile();
  const consumer = declaration.consumers.find(entry => entry.team === team);
  if (consumer) consumer.status = 'PENDING';
  saveDeclarationFile(declaration);
}

function markReady(repo, path) {
  writeFile(repo, path, 'ready\n');
}

function setupRepos() {
  makeWorkspace();
  const schemas = createProducerRepo();
  createConsumerRepos();
  for (const repo of ['commerce-events', ...CONSUMERS]) initGitRepo(repo);
  return schemas;
}

const { v2, v3 } = setupRepos();

console.log();
console.log(`${B}================================================================${R}`);
console.log(`${B}SEIP Demo Repos Exhibit${R}`);
console.log(`${B}Generated producer and consumer repos for a realistic pilot${R}`);
console.log(`${B}================================================================${R}`);
console.log();
console.log(`${D}Workspace: ${WORKSPACE}${R}`);
console.log(`${D}Repos: commerce-events, ${CONSUMERS.join(', ')}${R}`);

section('Step 1 - Inspect the generated repo constellation');
for (const repo of ['commerce-events', ...CONSUMERS]) {
  console.log(`  ${GR}repo:${R} ${join(WORKSPACE, repo)}`);
}

section('Step 2 - Producer initializes SEIP and strict CI policy');
run(`node ${CLI} init`);
configureSeipPolicy();
console.log(`  ${GR}commerce-events now requires ACCEPTED status and all five consumer acknowledgements.${R}`);

section('Step 3 - Producer diff catches a real event-contract break');
run(`node ${CLI} diff schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`);
const diff = diffSchemas(v2, v3, { strict: true });
console.log(`  ${YL}Breaking changes found:${R} ${diff.affected.filter(isBreakingChange).length}`);

section('Step 4 - CI blocks before a declaration exists');
const undeclared = run(`node ${CLI} validate schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`);
if (!undeclared.ok) console.log(`  ${RD}commerce-events cannot merge CheckoutCompleted.v3 yet.${R}`);

section('Step 5 - Producer creates and proposes one declaration');
run([
  `node ${CLI} create`,
  `--id ${DECLARATION_ID}`,
  '--summary "CheckoutCompleted.v3 cross-repo rollout"',
  '--type restructure',
  '--breaking',
  '--strategy generated_multi_repo_pilot',
  '--producer checkout-api',
  ...CONSUMERS.map(team => `--consumer ${team}`),
  '--from-diff schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json'
].join(' '));
enrichDeclaration(v2, v3);
run(`node ${CLI} propose ${DECLARATION_ID} --actor checkout-api`);
run(`node ${CLI} notify ${DECLARATION_ID} --adapter github --repo-url ${REPO_URL}`);

section('Step 6 - Consumer repos run their own validation commands');
validateConsumer('payments-ledger', 'contracts');
respond('payments-ledger', 'ACKNOWLEDGED', 'Ledger contract accepts integer minor units.', '1 day');

const partnerFailure = validateConsumer('partner-api', 'contracts');
if (!partnerFailure.ok) console.log(`  ${RD}partner-api records failed validation evidence before objecting.${R}`);
respond('partner-api', 'OBJECTED', 'Public clients still expect customer.email.', 'migration guide needed');

const fraudFailure = validateConsumer('fraud-models', 'features');
if (!fraudFailure.ok) console.log(`  ${RD}fraud-models records failed validation evidence before objecting.${R}`);
respond('fraud-models', 'OBJECTED', 'Replay drift exceeds tolerance after money precision change.', 'threshold recalibration');

validateConsumer('warehouse-dbt', 'models');
respond('warehouse-dbt', 'EXTENSION_REQUESTED', 'dbt lineage needs two release trains before v2 removal.', '2 releases');

section('Step 7 - CI still blocks because readiness is incomplete');
const blocked = run(`node ${CLI} validate schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`);
if (!blocked.ok) console.log(`  ${YL}The declaration exists, but accepted cross-repo readiness does not.${R}`);

section('Step 8 - Teams update their repos and rerun checks');
markReady('partner-api', 'contracts/accepts-email-hash.marker');
markReady('fraud-models', 'features/replay-approved.marker');
markReady('mobile-analytics', 'events/product-id-map-ready.marker');

resetConsumerStatus('partner-api');
resetConsumerStatus('fraud-models');
resetConsumerStatus('warehouse-dbt');

validateConsumer('partner-api', 'contracts');
respond('partner-api', 'ACKNOWLEDGED', 'Partner API accepts customer.email_hash.', '3 days');

validateConsumer('fraud-models', 'features');
respond('fraud-models', 'ACKNOWLEDGED', 'Replay report approved after recalibration.', '4 days');

respond('warehouse-dbt', 'ACKNOWLEDGED', 'Extended timeline covers dbt release trains.', '2 releases');

validateConsumer('mobile-analytics', 'events');
respond('mobile-analytics', 'ACKNOWLEDGED', 'Mobile analytics maps product_id.', '1 release');

section('Step 9 - CI passes, then the rollout is enforced and closed');
run(`node ${CLI} validate schemas/checkout-completed-v2.schema.json schemas/checkout-completed-v3.schema.json --strict`);
run(`node ${CLI} log ${DECLARATION_ID}`);
run(`node ${CLI} enforce ${DECLARATION_ID} --actor platform-governance`);
run(`node ${CLI} close ${DECLARATION_ID} --status COMPLETED --actor platform-governance`);
run(`node ${CLI} status ${DECLARATION_ID}`);

for (const repo of ['commerce-events', ...CONSUMERS]) {
  commitIfChanged(repo, 'Run SEIP demo scenario');
}

section('Summary');
console.log(`  ${B}Generated repos are ready to inspect:${R}`);
console.log(`  ${GR}1.${R} commerce-events contains schemas, GitHub Actions example, and .seip declaration state.`);
console.log(`  ${GR}2.${R} Consumer repos contain their own validation checks and readiness markers.`);
console.log(`  ${GR}3.${R} CONSUMER_VALIDATED events record passed and failed downstream evidence.`);
console.log(`  ${GR}4.${R} OBJECTED and EXTENSION_REQUESTED responses block CI until resolved.`);
console.log(`  ${GR}5.${R} The final declaration is COMPLETED and auditable in the producer repo.`);
console.log();
console.log(`  ${B}Open this workspace:${R} ${GR}${WORKSPACE}${R}`);
console.log(`  ${B}Producer declaration:${R} ${GR}${declarationFile()}${R}`);
console.log();
console.log(`${D}--- End of SEIP Demo Repos Exhibit ---------------------------${R}`);
