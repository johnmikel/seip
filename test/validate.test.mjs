import test from 'node:test';
import assert from 'node:assert/strict';

import { diffSchemas, validate, createDeclaration, validateDeclaration, propose, respond } from '../src/index.mjs';

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

test('validate rejects non-breaking declarations as coverage for breaking changes', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'amount', type: 'float' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'amount', type: 'integer' }] }] };
  const diff = diffSchemas(before, after);

  const scd = createDeclaration({
    id: 'scd_non_breaking_cover',
    summary: 'Track field',
    changeType: 'add',
    breaking: false,
    affectedObjects: [{ object: 't', property: 'amount' }],
    producerTeam: 'core',
    consumers: []
  });

  const result = validate(diff, [scd]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('no valid Schema Change Declaration')));
});

test('validate rejects invalid declarations as coverage for breaking changes', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'old', type: 'string' }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'new', type: 'string' }] }] };
  const diff = diffSchemas(before, after);

  const scd = createDeclaration({
    id: 'scd_invalid_cover',
    summary: 'Rename field',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });
  scd.migration = undefined;

  const result = validate(diff, [scd]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('scd_invalid_cover is invalid')));
  assert.ok(result.errors.some(e => e.includes('no valid Schema Change Declaration')));
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

test('validateDeclaration treats missing audit events as invalid', () => {
  const scd = createDeclaration({
    id: 'scd_missing_events',
    summary: 'Breaking change',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  delete scd.events;
  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('events array missing')));
});

test('validateDeclaration rejects unsafe declaration IDs', () => {
  const scd = createDeclaration({
    id: 'scd_safe',
    summary: 'Breaking change',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: []
  });

  scd.declaration_id = '../escape';
  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('declaration_id')));
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

test('validateDeclaration requires response timestamps', () => {
  const scd = createDeclaration({
    id: 'scd_missing_response_time',
    summary: 'Response timestamp',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: [{ team: 'analytics' }]
  });
  scd.responses.push({ team: 'analytics', status: 'ACKNOWLEDGED' });

  const result = validateDeclaration(scd);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('responses.responded_at')));
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
  propose(scd);

  assert.throws(
    () => respond(scd, { team: 'analytics', status: 'TYPO', message: 'oops' }),
    /Invalid response status/
  );
});

test('respond rejects undeclared consumers', () => {
  const scd = createDeclaration({
    id: 'scd_unknown_consumer',
    summary: 'Rename field',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: [{ team: 'analytics' }]
  });
  propose(scd);

  assert.throws(
    () => respond(scd, { team: 'risk', status: 'ACKNOWLEDGED', message: 'ok' }),
    /not a declared consumer/
  );
});

test('respond rejects responses before proposal', () => {
  const scd = createDeclaration({
    id: 'scd_draft_response',
    summary: 'Rename field',
    changeType: 'rename',
    breaking: true,
    affectedObjects: [{ object: 't', property: 'old' }],
    migrationStrategy: 'dual_write',
    producerTeam: 'core',
    consumers: [{ team: 'analytics' }]
  });

  assert.throws(
    () => respond(scd, { team: 'analytics', status: 'ACKNOWLEDGED', message: 'ok' }),
    /Cannot respond/
  );
});
