import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cliPath = resolve(new URL('../bin/seip.mjs', import.meta.url).pathname);

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8' });
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function writeDeclaration(cwd, overrides = {}) {
  const declaration = {
    seip_version: '0.1.0',
    declaration_id: 'seip_notify_cli',
    created_at: '2026-04-23T10:00:00.000Z',
    status: 'PROPOSED',
    producer: { team: 'ledger-api' },
    change: {
      type: 'rename',
      breaking: true,
      summary: 'Rename institution field',
      affected_objects: [{ object: 'account', property: 'institution' }]
    },
    migration: { strategy: 'dual_write' },
    timeline: {
      review_deadline: '2026-05-01T00:00:00.000Z',
      deprecation_date: '2026-06-01T00:00:00.000Z',
      removal_date: '2026-07-01T00:00:00.000Z'
    },
    consumers: [
      { team: 'analytics', status: 'PENDING' },
      { team: 'risk', status: 'PENDING' }
    ],
    responses: [],
    events: [],
    ...overrides
  };
  writeFileSync(
    join(cwd, '.seip', 'declarations', `${declaration.declaration_id}.json`),
    JSON.stringify(declaration, null, 2)
  );
  return declaration;
}

test('seip init creates declarations dir and config', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  const result = run(process.execPath, [cliPath, 'init'], cwd);
  assert.equal(result.status, 0);
  assert.ok(existsSync(join(cwd, '.seip', 'declarations')));
  assert.ok(existsSync(join(cwd, '.seip', 'config.json')));
});

test('seip create --from-diff prefills affected_objects', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };
  const beforePath = join(cwd, 'before.json');
  const afterPath = join(cwd, 'after.json');
  writeFileSync(beforePath, JSON.stringify(before, null, 2));
  writeFileSync(afterPath, JSON.stringify(after, null, 2));

  const result = run(process.execPath, [
    cliPath, 'create',
    '--id', 'seip_test_from_diff',
    '--summary', 'Rename field',
    '--breaking',
    '--strategy', 'dual_write',
    '--from-diff', beforePath, afterPath
  ], cwd);

  assert.equal(result.status, 0);
  const files = readdirSync(join(cwd, '.seip', 'declarations'));
  assert.ok(files.includes('seip_test_from_diff.json'));
  const declaration = JSON.parse(readFileSync(join(cwd, '.seip', 'declarations', 'seip_test_from_diff.json')));
  assert.ok(Array.isArray(declaration.change.affected_objects));
  assert.ok(declaration.change.affected_objects.length > 0);
});

test('seip diff reports lossless retypes as safe in human output', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  const before = { objects: [{ name: 't', properties: [{ name: 'amount', type: 'int32' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'amount', type: 'int64' }] }] };
  const beforePath = join(cwd, 'before.json');
  const afterPath = join(cwd, 'after.json');
  writeFileSync(beforePath, JSON.stringify(before, null, 2));
  writeFileSync(afterPath, JSON.stringify(after, null, 2));

  const result = run(process.execPath, [cliPath, 'diff', beforePath, afterPath], cwd);

  assert.equal(result.status, 0);
  const output = stripAnsi(result.stdout);
  assert.match(output, /amount/);
  assert.match(output, /\[safe\]/);
  assert.doesNotMatch(output, /BREAKING/);
});

test('seip status --json emits machine-readable declaration output', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };
  const beforePath = join(cwd, 'before.json');
  const afterPath = join(cwd, 'after.json');
  writeFileSync(beforePath, JSON.stringify(before, null, 2));
  writeFileSync(afterPath, JSON.stringify(after, null, 2));

  run(process.execPath, [
    cliPath, 'create',
    '--id', 'seip_json_status',
    '--summary', 'Rename field',
    '--breaking',
    '--strategy', 'dual_write',
    '--from-diff', beforePath, afterPath
  ], cwd);

  const result = run(process.execPath, [cliPath, 'status', 'seip_json_status', '--json'], cwd);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.declaration_id, 'seip_json_status');
  assert.equal(parsed.change.summary, 'Rename field');
});

test('seip respond rejects invalid statuses', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };
  const beforePath = join(cwd, 'before.json');
  const afterPath = join(cwd, 'after.json');
  writeFileSync(beforePath, JSON.stringify(before, null, 2));
  writeFileSync(afterPath, JSON.stringify(after, null, 2));

  run(process.execPath, [
    cliPath, 'create',
    '--id', 'seip_bad_status',
    '--summary', 'Rename field',
    '--breaking',
    '--strategy', 'dual_write',
    '--from-diff', beforePath, afterPath,
    '--consumer', 'analytics'
  ], cwd);
  run(process.execPath, [cliPath, 'propose', 'seip_bad_status'], cwd);

  const result = run(process.execPath, [
    cliPath, 'respond', 'seip_bad_status',
    '--team', 'analytics',
    '--status', 'TYPO'
  ], cwd);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /Invalid response status/);
});

test('seip create rejects unsafe declaration IDs', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const result = run(process.execPath, [
    cliPath, 'create',
    '--id', '../escape',
    '--summary', 'Bad id'
  ], cwd);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /Invalid declaration_id/);
});

test('seip create supports --flag=value arguments', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const result = run(process.execPath, [
    cliPath, 'create',
    '--id=seip_equals_flags',
    '--summary=Created with equals flags',
    '--producer=ledger-api',
    '--json'
  ], cwd);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.declaration_id, 'seip_equals_flags');
});

test('seip validate-consumer fails when target path is missing', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);

  const result = run(process.execPath, [
    cliPath, 'validate-consumer',
    'seip_notify_cli',
    '--against', join(cwd, 'missing')
  ], cwd);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /Consumer validation path not found/);
});

test('seip validate-consumer runs an explicit validation command', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);
  const consumerDir = join(cwd, 'consumer');
  mkdirSync(consumerDir);

  const result = run(process.execPath, [
    cliPath, 'validate-consumer',
    'seip_notify_cli',
    '--against', consumerDir,
    '--command', `${process.execPath} -e "if (!process.env.SEIP_DECLARATION_ID || !process.env.SEIP_CONSUMER_PATH) process.exit(2)"`
  ], cwd);

  assert.equal(result.status, 0);
  assert.match(stripAnsi(result.stdout), /Consumer validation command passed/);
});

test('seip validate-consumer can record validation evidence', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);
  const consumerDir = join(cwd, 'consumer');
  mkdirSync(consumerDir);

  const result = run(process.execPath, [
    cliPath, 'validate-consumer',
    'seip_notify_cli',
    '--team', 'analytics',
    '--against', consumerDir,
    '--command', `${process.execPath} -e "console.log('contract ok')"`,
    '--record',
    '--json'
  ], cwd);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.recorded, true);
  const declaration = JSON.parse(readFileSync(join(cwd, '.seip', 'declarations', 'seip_notify_cli.json')));
  const event = declaration.events.at(-1);
  assert.equal(event.type, 'CONSUMER_VALIDATED');
  assert.equal(event.actor, 'analytics');
  assert.equal(event.validation.status, 'PASSED');
  assert.equal(event.validation.command_output, 'contract ok');
});

test('seip lint --json emits pure JSON output', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);

  const declarationPath = join(cwd, '.seip', 'declarations', 'bad.json');
  writeFileSync(declarationPath, JSON.stringify({
    seip_version: '0.1.0',
    declaration_id: 'bad',
    created_at: new Date().toISOString(),
    status: 'DRAFT',
    producer: { team: 'core' },
    change: {
      type: 'rename',
      breaking: true,
      summary: 'Bad declaration',
      affected_objects: [{ object: 't', property: 'old' }]
    },
    timeline: {
      review_deadline: 'not-a-date',
      deprecation_date: 'still-not-a-date',
      removal_date: 'definitely-not-a-date'
    },
    consumers: [],
    responses: [],
    events: []
  }, null, 2));

  const result = run(process.execPath, [cliPath, 'lint', '--json'], cwd);

  assert.equal(result.status, 1);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
  assert.equal(result.stdout.trim().startsWith('['), true);
});

test('seip notify --adapter github --json emits GitHub markdown payload', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);

  const result = run(process.execPath, [
    cliPath, 'notify', 'seip_notify_cli',
    '--adapter', 'github',
    '--repo-url', 'https://github.com/acme/ledger',
    '--json'
  ], cwd);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.adapter, 'github');
  assert.equal(parsed.delivered, false);
  assert.match(parsed.payload, /SEIP Proposal: `seip_notify_cli`/);
  assert.match(parsed.payload, /https:\/\/github\.com\/acme\/ledger\/blob\/main\/\.seip\/declarations\/seip_notify_cli\.json/);
});

test('seip notify --adapter slack --dry-run emits Slack payload without delivery', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);

  const result = run(process.execPath, [
    cliPath, 'notify', 'seip_notify_cli',
    '--adapter', 'slack',
    '--webhook', 'mock://slack/schema',
    '--repo-url', 'https://github.com/acme/ledger',
    '--dry-run',
    '--json'
  ], cwd);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.adapter, 'slack');
  assert.equal(parsed.delivered, false);
  assert.equal(parsed.target, 'mock://slack/schema');
  assert.match(JSON.stringify(parsed.payload), /Rename institution field/);
});

test('seip notify rejects invalid adapters', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'seip-'));
  run(process.execPath, [cliPath, 'init'], cwd);
  writeDeclaration(cwd);

  const result = run(process.execPath, [
    cliPath, 'notify', 'seip_notify_cli',
    '--adapter', 'carrier-pigeon'
  ], cwd);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /Unknown notification adapter: carrier-pigeon/);
});
