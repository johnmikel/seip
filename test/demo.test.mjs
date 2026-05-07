import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const demoPath = resolve(new URL('../examples/full-workflow.mjs', import.meta.url).pathname);
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

function runDemo(env = {}) {
  return spawnSync(process.execPath, [demoPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, ...env }
  });
}

test('full workflow demo exercises CI, notifications, responses, and closure', () => {
  const result = runDemo();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Full-Blown Demo/);
  assert.match(result.stdout, /CI gate blocks undeclared breaking change/);
  assert.match(result.stdout, /GitHub PR comment \/ Actions summary/);
  assert.match(result.stdout, /Slack channel dry-run/);
  assert.match(result.stdout, /risk-service.*OBJECTED/s);
  assert.match(result.stdout, /UNDER_REVIEW/);
  assert.match(result.stdout, /ACCEPTED/);
  assert.match(result.stdout, /COMPLETED/);
  assert.match(result.stdout, /No SEIP server, database, or notification state store required/);
});

test('full workflow demo can use an isolated workspace from SEIP_DEMO_DIR', () => {
  const parentDir = mkdtempSync(join(tmpdir(), 'seip-demo-test-'));
  const demoDir = join(parentDir, 'workspace');

  try {
    const result = runDemo({ SEIP_DEMO_DIR: demoDir });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp(`Workspace: ${demoDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  } finally {
    rmSync(parentDir, { recursive: true, force: true });
  }
});
