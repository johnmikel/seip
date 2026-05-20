#!/usr/bin/env node

/**
 * SEIP - enterprise workflow demo
 *
 * This simulates a complex CheckoutCompleted.v3 rollout crossing API contracts,
 * analytics, warehouse/dbt, payments, and ML model consumers.
 *
 * Run:
 *   node examples/enterprise-workflow.mjs
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { diffSchemas, isBreakingChange, loadDeclaration, saveDeclaration } from '../src/index.mjs';

const D = '\x1b[2m';
const R = '\x1b[0m';
const B = '\x1b[1m';
const GR = '\x1b[32m';
const RD = '\x1b[31m';
const YL = '\x1b[33m';
const CY = '\x1b[36m';

const DEMO_DIR = process.env.SEIP_ENTERPRISE_DEMO_DIR || `/tmp/seip-enterprise-demo-${process.pid}`;
const CLI = join(process.cwd(), 'bin', 'seip.mjs');
const REPO_URL = 'https://github.com/acme/commerce-events';
const DECLARATION_ID = 'seip_checkout_completed_v3';

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

function run(command) {
  const label = command.replace(/node .*?seip\.mjs/g, 'seip');
  console.log(`  ${CY}$ ${label}${R}`);
  try {
    const output = execSync(command, {
      cwd: DEMO_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (output.trim()) console.log(output);
    return { ok: true, output };
  } catch (error) {
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return { ok: false, output: error.stdout || '', error };
  }
}

function writeJson(path, value) {
  writeFileSync(join(DEMO_DIR, path), JSON.stringify(value, null, 2) + '\n');
}

function declarationPath() {
  return join(DEMO_DIR, '.seip', 'declarations', `${DECLARATION_ID}.json`);
}

function loadDeclarationFile() {
  return JSON.parse(readFileSync(declarationPath(), 'utf8'));
}

function saveDeclarationFile(declaration) {
  saveDeclaration(declaration, DEMO_DIR);
}

function writeSchemas() {
  const baseEvent = {
    type: 'object',
    required: ['event_id', 'occurred_at', 'checkout_id'],
    properties: {
      event_id: { type: 'string', format: 'uuid' },
      occurred_at: { type: 'string', format: 'date-time' },
      checkout_id: { type: 'string' }
    }
  };

  const checkoutV2 = {
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
              email: { type: 'string', format: 'email' },
              loyalty_tier: { type: ['string', 'null'] }
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
    $defs: { BaseEvent: baseEvent }
  };

  const checkoutV3 = {
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
              email_hash: { type: 'string', format: 'sha256' },
              loyalty_tier: { type: ['string', 'null'] }
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
    $defs: { BaseEvent: baseEvent }
  };

  writeJson('checkout-completed-v2.schema.json', checkoutV2);
  writeJson('checkout-completed-v3.schema.json', checkoutV3);
  return { checkoutV2, checkoutV3 };
}

function writeConsumerFixtures() {
  const dirs = [
    'consumers/payments-ledger/contracts',
    'consumers/partner-api/contracts',
    'consumers/fraud-models/replays',
    'consumers/warehouse-dbt/models',
    'consumers/mobile-analytics/events',
    'checks'
  ];
  for (const dir of dirs) mkdirSync(join(DEMO_DIR, dir), { recursive: true });

  writeFileSync(join(DEMO_DIR, 'consumers/payments-ledger/contracts/amount-minor-units.marker'), 'ready\n');
  writeFileSync(join(DEMO_DIR, 'consumers/warehouse-dbt/models/dual-column-compiled.marker'), 'ready\n');

  const checker = `#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const scenario = process.argv[2];
const target = process.env.SEIP_CONSUMER_PATH;
const declarationPath = process.env.SEIP_DECLARATION_PATH;
const declaration = JSON.parse(readFileSync(declarationPath, 'utf8'));

function requireMarker(name, failure) {
  if (!existsSync(join(target, name))) {
    console.error(failure);
    process.exit(1);
  }
}

if (scenario === 'payments-ledger') {
  requireMarker('amount-minor-units.marker', 'payments-ledger has not switched to minor units');
  console.log('payments-ledger contract suite passed for ' + declaration.declaration_id);
} else if (scenario === 'partner-api') {
  requireMarker('accepts-email-hash.marker', 'partner-api still reads customer.email');
  console.log('partner-api contract suite accepts customer.email_hash');
} else if (scenario === 'fraud-models') {
  requireMarker('model-replay-approved.marker', 'fraud-model replay drift exceeds threshold');
  console.log('fraud-models replay approved against integer minor units');
} else if (scenario === 'warehouse-dbt') {
  requireMarker('dual-column-compiled.marker', 'warehouse-dbt lineage build has not compiled');
  console.log('warehouse-dbt lineage build compiled with dual columns');
} else if (scenario === 'mobile-analytics') {
  requireMarker('mobile-event-map-v3.marker', 'mobile analytics mapping still emits legacy sku');
  console.log('mobile analytics event map upgraded to product_id');
} else {
  console.error('unknown validation scenario: ' + scenario);
  process.exit(2);
}
`;
  writeFileSync(join(DEMO_DIR, 'checks/consumer-check.mjs'), checker);
}

function configurePolicy() {
  const config = {
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
  };
  writeJson('.seip/config.json', config);
  console.log(`${GR}CI policy requires ACCEPTED status and acknowledgements from all five consumers.${R}`);
}

function enrichDeclaration(before, after) {
  const declaration = loadDeclaration(DECLARATION_ID, DEMO_DIR);
  const diff = diffSchemas(before, after, { strict: true });
  declaration.change.details = [
    'CheckoutCompleted.v3 combines privacy hardening, integer money semantics,',
    'catalog normalization, analytics event shape changes, and ML feature changes.'
  ].join(' ');
  declaration.change.affected_objects = diff.affected.map(change => ({
    object: change.object,
    property: change.property,
    change_type: change.change_type,
    lossy: change.lossy || false,
    before_type: change.before?.type || null,
    after_type: change.after?.type || null
  }));
  declaration.change.renames = [
    {
      object: 'CheckoutCompleted',
      from: 'line_items[].sku',
      to: 'line_items[].product_id'
    }
  ];
  declaration.migration.steps = [
    'Phase 1: Dual-publish CheckoutCompleted.v2 and CheckoutCompleted.v3 events.',
    'Phase 2: Publish email_hash alongside restricted legacy email access for internal consumers.',
    'Phase 3: Consumers validate API contracts, dbt models, analytics mappings, and ML replays.',
    'Phase 4: Freeze v2 event production after all required consumers acknowledge.',
    'Phase 5: Remove legacy email and sku readers after the deprecation window.'
  ];
  declaration.migration.sql = [
    'ALTER TABLE checkout_events ADD COLUMN customer_email_hash TEXT;',
    'ALTER TABLE checkout_events ADD COLUMN amount_minor_units INTEGER;',
    'ALTER TABLE checkout_line_items ADD COLUMN product_id TEXT;'
  ];
  declaration.migration.rollback = 'Continue publishing CheckoutCompleted.v2 and disable v3-only consumers.';
  declaration.timeline.deprecation_date = new Date(Date.now() + 60 * 86400000).toISOString();
  declaration.timeline.removal_date = new Date(Date.now() + 120 * 86400000).toISOString();
  saveDeclarationFile(declaration);
  return diff;
}

function markConsumerReady(consumerPath, marker) {
  writeFileSync(join(DEMO_DIR, consumerPath, marker), 'ready\n');
}

function resetConsumerStatus(team) {
  const declaration = loadDeclarationFile();
  const consumer = declaration.consumers.find(c => c.team === team);
  if (consumer) consumer.status = 'PENDING';
  saveDeclarationFile(declaration);
}

function printNotificationSnippet(title, output, maxLines = 22) {
  console.log(`  ${B}${title}${R}`);
  const lines = output.trim().split('\n').slice(0, maxLines);
  for (const line of lines) console.log(`  ${line}`);
  if (output.trim().split('\n').length > maxLines) {
    console.log(`  ${D}...snipped for enterprise demo readability...${R}`);
  }
  console.log();
}

if (existsSync(DEMO_DIR)) rmSync(DEMO_DIR, { recursive: true, force: true });
mkdirSync(DEMO_DIR, { recursive: true });

const { checkoutV2, checkoutV3 } = writeSchemas();
writeConsumerFixtures();

console.log();
console.log(`${B}================================================================${R}`);
console.log(`${B}SEIP Enterprise Demo${R}`);
console.log(`${B}CheckoutCompleted.v3: API contracts, data platform, and ML safety${R}`);
console.log(`${B}================================================================${R}`);
console.log();
console.log(`${D}Workspace: ${DEMO_DIR}${R}`);
console.log(`${D}Scenario: checkout-api proposes one event contract change consumed by APIs, analytics, dbt, payments, and fraud models.${R}`);

section('Step 1 - Initialise SEIP and strict enterprise policy');
run(`node ${CLI} init`);
configurePolicy();

section('Step 2 - Diff nested JSON Schema inputs');
const diffOutput = run(`node ${CLI} diff checkout-completed-v2.schema.json checkout-completed-v3.schema.json --strict`);
const diff = diffSchemas(checkoutV2, checkoutV3, { strict: true });
console.log(`  ${YL}Breaking changes found:${R} ${diff.affected.filter(isBreakingChange).length}`);
console.log(`  ${D}Schema support shown: local $ref, $defs, arrays, nested object paths, and allOf.${R}`);

section('Step 3 - CI blocks the undeclared enterprise rollout');
const undeclared = run(`node ${CLI} validate checkout-completed-v2.schema.json checkout-completed-v3.schema.json --strict`);
if (!undeclared.ok) console.log(`  ${RD}CI blocks CheckoutCompleted.v3 before coordination starts.${R}`);

section('Step 4 - Producer creates one coordinated declaration');
run([
  `node ${CLI} create`,
  `--id ${DECLARATION_ID}`,
  '--summary "CheckoutCompleted.v3 privacy, money, and product normalization"',
  '--type restructure',
  '--breaking',
  '--strategy phased_dual_publish',
  '--producer checkout-api',
  '--consumer payments-ledger',
  '--consumer partner-api',
  '--consumer fraud-models',
  '--consumer warehouse-dbt',
  '--consumer mobile-analytics',
  '--from-diff checkout-completed-v2.schema.json checkout-completed-v3.schema.json'
].join(' '));
const enrichedDiff = enrichDeclaration(checkoutV2, checkoutV3);
console.log(`  ${GR}Declaration enriched with ${enrichedDiff.affected.length} affected paths, an explicit rename map, SQL, rollback, and staged migration steps.${R}`);

section('Step 5 - Proposal reaches GitHub and Slack surfaces');
run(`node ${CLI} propose ${DECLARATION_ID} --actor checkout-api`);
const github = run(`node ${CLI} notify ${DECLARATION_ID} --adapter github --repo-url ${REPO_URL}`);
printNotificationSnippet('GitHub PR / Actions summary preview:', github.output);
const slack = run(`node ${CLI} notify ${DECLARATION_ID} --adapter slack --webhook mock://slack/checkout-contracts --repo-url ${REPO_URL} --dry-run --json`);
const slackJson = JSON.parse(slack.output);
console.log(`  ${GR}Slack dry-run target:${R} ${slackJson.target}`);
console.log(`  ${D}Slack blocks:${R} ${slackJson.payload.attachments[0].blocks.length}`);

section('Step 6 - Consumers run real validation hooks');
run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/payments-ledger/contracts --command "node ./checks/consumer-check.mjs payments-ledger" --record --team payments-ledger --json`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team payments-ledger',
  '--status ACKNOWLEDGED',
  '--message "Ledger contract tests pass with integer minor units."',
  '--effort "1 day"'
].join(' '));

const partnerFailure = run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/partner-api/contracts --command "node ./checks/consumer-check.mjs partner-api" --record --team partner-api --json`);
if (!partnerFailure.ok) console.log(`  ${RD}partner-api records failed validation evidence before objecting.${R}`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team partner-api',
  '--status OBJECTED',
  '--message "Public API clients still depend on customer.email."',
  '--effort "needs partner migration guide"'
].join(' '));

const fraudFailure = run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/fraud-models/replays --command "node ./checks/consumer-check.mjs fraud-models" --record --team fraud-models --json`);
if (!fraudFailure.ok) console.log(`  ${RD}fraud-models records model replay failure before objecting.${R}`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team fraud-models',
  '--status OBJECTED',
  '--message "Model replay drift exceeds tolerance after amount precision change."',
  '--effort "requires threshold recalibration"'
].join(' '));

run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/warehouse-dbt/models --command "node ./checks/consumer-check.mjs warehouse-dbt" --record --team warehouse-dbt --json`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team warehouse-dbt',
  '--status EXTENSION_REQUESTED',
  '--message "dbt lineage needs two release trains before v2 removal."',
  '--effort "2 releases"'
].join(' '));

section('Step 7 - CI still blocks while objections and pending consumers remain');
const blocked = run(`node ${CLI} validate checkout-completed-v2.schema.json checkout-completed-v3.schema.json --strict`);
if (!blocked.ok) console.log(`  ${YL}A declaration exists, but policy still blocks until it is accepted by all required consumers.${R}`);

section('Step 8 - Negotiation resolves API, ML, warehouse, and mobile risk');
const negotiated = loadDeclarationFile();
negotiated.timeline.deprecation_date = new Date(Date.now() + 90 * 86400000).toISOString();
negotiated.timeline.removal_date = new Date(Date.now() + 150 * 86400000).toISOString();
negotiated.migration.steps.push('Phase 3b: Publish partner migration guide and fraud replay report before final acknowledgement.');
saveDeclarationFile(negotiated);

markConsumerReady('consumers/partner-api/contracts', 'accepts-email-hash.marker');
markConsumerReady('consumers/fraud-models/replays', 'model-replay-approved.marker');
markConsumerReady('consumers/mobile-analytics/events', 'mobile-event-map-v3.marker');

resetConsumerStatus('partner-api');
resetConsumerStatus('fraud-models');
resetConsumerStatus('warehouse-dbt');

run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/partner-api/contracts --command "node ./checks/consumer-check.mjs partner-api" --record --team partner-api --json`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team partner-api',
  '--status ACKNOWLEDGED',
  '--message "Partner migration guide accepted; clients can use customer.email_hash."',
  '--effort "3 days"'
].join(' '));

run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/fraud-models/replays --command "node ./checks/consumer-check.mjs fraud-models" --record --team fraud-models --json`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team fraud-models',
  '--status ACKNOWLEDGED',
  '--message "Replay report approved after threshold recalibration."',
  '--effort "4 days"'
].join(' '));

run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team warehouse-dbt',
  '--status ACKNOWLEDGED',
  '--message "Extended timeline covers dbt release trains."',
  '--effort "2 releases"'
].join(' '));

run(`node ${CLI} validate-consumer ${DECLARATION_ID} --against ./consumers/mobile-analytics/events --command "node ./checks/consumer-check.mjs mobile-analytics" --record --team mobile-analytics --json`);
run([
  `node ${CLI} respond ${DECLARATION_ID}`,
  '--team mobile-analytics',
  '--status ACKNOWLEDGED',
  '--message "Mobile event mapping updated from sku to product_id."',
  '--effort "1 release"'
].join(' '));

section('Step 9 - Accepted declaration lets CI pass');
run(`node ${CLI} validate checkout-completed-v2.schema.json checkout-completed-v3.schema.json --strict`);

section('Step 10 - Audit evidence, enforcement, and closure');
run(`node ${CLI} log ${DECLARATION_ID}`);
run(`node ${CLI} enforce ${DECLARATION_ID} --actor platform-governance`);
run(`node ${CLI} close ${DECLARATION_ID} --status COMPLETED --actor platform-governance`);
run(`node ${CLI} status ${DECLARATION_ID}`);

section('Summary');
console.log(`  ${B}Cross-runtime schema coordination:${R}`);
console.log(`  ${GR}1.${R} API contracts, warehouse models, analytics events, payments, and ML checks all respond to one canonical declaration.`);
console.log(`  ${GR}2.${R} Failed consumer commands create CONSUMER_VALIDATED evidence before teams object.`);
console.log(`  ${GR}3.${R} OBJECTED and EXTENSION_REQUESTED responses keep the declaration in review.`);
console.log(`  ${GR}4.${R} CI only passes after ACCEPTED status and all required consumer acknowledgements.`);
console.log(`  ${GR}5.${R} GitHub and Slack remain display surfaces, while Git remains the state store.`);
console.log();
console.log(`  ${B}Canonical state:${R} ${GR}.seip/declarations/${DECLARATION_ID}.json${R}`);
console.log(`  ${B}Demo workspace:${R} ${GR}${DEMO_DIR}${R}`);
console.log();
console.log(`${D}--- End of SEIP Enterprise Demo ------------------------------${R}`);
