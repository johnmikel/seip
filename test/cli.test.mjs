import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cliPath = resolve(new URL('../bin/seip.mjs', import.meta.url).pathname);

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8' });
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
