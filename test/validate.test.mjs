import test from 'node:test';
import assert from 'node:assert/strict';

import { diffSchemas, validate, createDeclaration, validateDeclaration, respond } from '../src/index.mjs';

test('validate accepts rename coverage by new property name', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };
  const diff = diffSchemas(before, after);

  const scd = createDeclaration({
    id: 'scd_rename_new',
    summary: 'Rename field',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'new' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  const result = validate(diff, [scd]);
  assert.equal(result.errors.length, 0);
});

test('validateDeclaration flags missing migration strategy on breaking change', () => {
  const scd = createDeclaration({
    id: 'scd_missing_strategy',
    summary: 'Breaking change',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  scd.migration = undefined;
  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('migration.strategy')));
});

test('validateDeclaration rejects invalid ISO timeline dates', () => {
  const scd = createDeclaration({
    id: 'scd_invalid_dates',
    summary: 'Bad dates',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  scd.timeline.review_deadline = 'tomorrow-ish';
  scd.timeline.deprecation_date = 'later';
  scd.timeline.removal_date = 'eventually';

  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('timeline.review_deadline')));
  assert.ok(result.errors.some(e => e.includes('timeline.deprecation_date')));
  assert.ok(result.errors.some(e => e.includes('timeline.removal_date')));
});

test('validateDeclaration requires a valid created_at timestamp', () => {
  const scd = createDeclaration({
    id: 'scd_invalid_created_at',
    summary: 'Bad created_at',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  scd.created_at = 'yesterday-ish';

  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('created_at')));
});

test('respond rejects unknown response statuses', () => {
  const scd = createDeclaration({
    id: 'scd_invalid_response',
    summary: 'Rename field',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: [{ team: 'analytics' }]
  });

  assert.throws(
    () => respond(scd, { team: 'analytics', status: 'TYPO', message: 'oops' }),
    /Invalid response status/
  );
});
