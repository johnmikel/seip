import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const actionPath = resolve(new URL('../action.yml', import.meta.url).pathname);

test('repository exposes a composite GitHub Action for SEIP validation', () => {
  assert.equal(existsSync(actionPath), true);
  const action = readFileSync(actionPath, 'utf8');

  assert.match(action, /name:\s+['"]?SEIP Validate/);
  assert.match(action, /before-schema:/);
  assert.match(action, /after-schema:/);
  assert.match(action, /seip-args:/);
  assert.match(action, /using:\s+['"]?composite/);
  assert.match(action, /node\s+\$GITHUB_ACTION_PATH\/bin\/seip\.mjs\s+validate/);
});
