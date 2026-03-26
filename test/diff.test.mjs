import test from 'node:test';
import assert from 'node:assert/strict';

import { diffSchemas } from '../src/index.mjs';

test('diffSchemas detects renames with a single candidate', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };

  const diff = diffSchemas(before, after);
  assert.equal(diff.affected.length, 1);
  assert.equal(diff.affected[0].change_type, 'rename');
  assert.equal(diff.affected[0].before.name, 'old');
  assert.equal(diff.affected[0].after.name, 'new');
});

test('diffSchemas marks required additions as breaking in strict mode', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'id', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'id', type: 'string' }, { name: 'req', type: 'string', required: true }] }] };

  const diffStrict = diffSchemas(before, after, { strict: true });
  assert.ok(diffStrict.affected.some(a => a.change_type === 'add_required'));
  assert.equal(diffStrict.breaking, true);
});

test('diffSchemas reports new objects as adds', () => {
  const before = { objects: [] };
  const after = { objects: [{ name: 'accounts', properties: [{ name: 'id', type: 'uuid' }] }] };

  const diff = diffSchemas(before, after);
  assert.equal(diff.affected.length, 1);
  assert.equal(diff.affected[0].change_type, 'add');
  assert.equal(diff.affected[0].object, 'accounts');
});
