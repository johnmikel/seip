import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const demoPath = resolve(new URL('../examples/enterprise-workflow.mjs', import.meta.url).pathname);
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

function runEnterpriseDemo(env = {}) {
  return spawnSync(process.execPath, [demoPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, ...env }
  });
}

test('enterprise workflow demo exercises API, data, and ML consumer pressure', () => {
  const parentDir = mkdtempSync(join(tmpdir(), 'seip-enterprise-demo-test-'));
  const demoDir = join(parentDir, 'workspace');

  try {
    const result = runEnterpriseDemo({ SEIP_ENTERPRISE_DEMO_DIR: demoDir });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Enterprise Demo/);
    assert.match(result.stdout, /CheckoutCompleted\.v3/);
    assert.match(result.stdout, /partner-api/);
    assert.match(result.stdout, /fraud-models/);
    assert.match(result.stdout, /warehouse-dbt/);
    assert.match(result.stdout, /mobile-analytics/);
    assert.match(result.stdout, /CONSUMER_VALIDATED/);
    assert.match(result.stdout, /OBJECTED/);
    assert.match(result.stdout, /EXTENSION_REQUESTED/);
    assert.match(result.stdout, /ACCEPTED/);
    assert.match(result.stdout, /COMPLETED/);
    assert.match(result.stdout, /Cross-runtime schema coordination/);
    assert.match(result.stdout, new RegExp(`Workspace: ${demoDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  } finally {
    rmSync(parentDir, { recursive: true, force: true });
  }
});
