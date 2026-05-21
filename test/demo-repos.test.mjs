import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const generatorPath = resolve(new URL('../examples/demo-repos/create-demo-repos.mjs', import.meta.url).pathname);
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

function runDemoRepos(env = {}) {
  return spawnSync(process.execPath, [generatorPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 40_000,
    env: { ...process.env, ...env }
  });
}

test('generated demo repos exhibit a realistic multi-repo SEIP pilot', () => {
  const parentDir = mkdtempSync(join(tmpdir(), 'seip-demo-repos-test-'));
  const demoDir = join(parentDir, 'workspace');

  try {
    const result = runDemoRepos({ SEIP_DEMO_REPOS_DIR: demoDir });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /SEIP Demo Repos Exhibit/);
    assert.match(result.stdout, /commerce-events/);
    assert.match(result.stdout, /partner-api/);
    assert.match(result.stdout, /warehouse-dbt/);
    assert.match(result.stdout, /fraud-models/);
    assert.match(result.stdout, /mobile-analytics/);
    assert.match(result.stdout, /CONSUMER_VALIDATED/);
    assert.match(result.stdout, /OBJECTED/);
    assert.match(result.stdout, /EXTENSION_REQUESTED/);
    assert.match(result.stdout, /COMPLETED/);
    assert.match(result.stdout, /Generated repos are ready to inspect/);

    for (const repo of [
      'commerce-events',
      'partner-api',
      'payments-ledger',
      'warehouse-dbt',
      'fraud-models',
      'mobile-analytics'
    ]) {
      assert.equal(existsSync(join(demoDir, repo, 'README.md')), true, `${repo} README missing`);
      assert.equal(existsSync(join(demoDir, repo, '.git')), true, `${repo} git repo missing`);
    }

    const declarationPath = join(
      demoDir,
      'commerce-events',
      '.seip',
      'declarations',
      'seip_checkout_completed_v3.json'
    );
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8'));

    assert.equal(declaration.status, 'COMPLETED');
    assert.equal(declaration.consumers.length, 5);
    assert.equal(declaration.consumers.every(consumer => consumer.status === 'ACKNOWLEDGED'), true);
    assert.equal(
      declaration.events.filter(event => event.type === 'CONSUMER_VALIDATED').length >= 5,
      true
    );
    assert.equal(
      declaration.events.some(event => event.validation?.status === 'FAILED'),
      true
    );
  } finally {
    rmSync(parentDir, { recursive: true, force: true });
  }
});
