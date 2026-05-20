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

test('diffSchemas marks requiredness tightening as breaking', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'email', type: 'string', required: false }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'email', type: 'string', required: true }] }] };

  const diff = diffSchemas(before, after);

  assert.equal(diff.breaking, true);
  assert.deepEqual(diff.affected.map(a => a.change_type), ['make_required']);
});

test('diffSchemas marks enum narrowing as breaking', () => {
  const before = { objects: [{ name: 't', properties: [{ name: 'status', type: 'string', enum: ['pending', 'paid', 'failed'] }] }] };
  const after = { objects: [{ name: 't', properties: [{ name: 'status', type: 'string', enum: ['paid', 'failed'] }] }] };

  const diff = diffSchemas(before, after);

  assert.equal(diff.breaking, true);
  assert.equal(diff.affected[0].change_type, 'enum_narrow');
});

test('diffSchemas supports basic JSON Schema object inputs', () => {
  const before = {
    title: 'Transaction',
    type: 'object',
    required: ['id', 'amount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'number' },
      status: { type: 'string', enum: ['pending', 'paid', 'failed'] },
      note: { type: ['string', 'null'] }
    }
  };
  const after = {
    title: 'Transaction',
    type: 'object',
    required: ['id', 'amount', 'note'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'integer' },
      status: { type: 'string', enum: ['paid', 'failed'] },
      note: { type: 'string' }
    }
  };

  const diff = diffSchemas(before, after);
  const changeTypes = diff.affected.map(a => `${a.object}.${a.property}:${a.change_type}`);

  assert.equal(diff.breaking, true);
  assert.ok(changeTypes.includes('Transaction.amount:retype'));
  assert.equal(diff.affected.find(a => a.property === 'amount').lossy, true);
  assert.ok(changeTypes.includes('Transaction.status:enum_narrow'));
  assert.ok(changeTypes.includes('Transaction.note:make_required'));
  assert.ok(changeTypes.includes('Transaction.note:make_non_nullable'));
});

test('diffSchemas resolves local JSON Schema refs and nested object paths', () => {
  const before = {
    title: 'Order',
    type: 'object',
    required: ['customer'],
    properties: {
      customer: { $ref: '#/$defs/Customer' }
    },
    $defs: {
      Customer: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          email: { type: ['string', 'null'] }
        }
      }
    }
  };
  const after = {
    title: 'Order',
    type: 'object',
    required: ['customer'],
    properties: {
      customer: { $ref: '#/$defs/Customer' }
    },
    $defs: {
      Customer: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'string' },
          email: { type: 'string' }
        }
      }
    }
  };

  const diff = diffSchemas(before, after);
  const changeTypes = diff.affected.map(a => `${a.object}.${a.property}:${a.change_type}`);

  assert.equal(diff.breaking, true);
  assert.ok(changeTypes.includes('Order.customer.email:make_required'));
  assert.ok(changeTypes.includes('Order.customer.email:make_non_nullable'));
});

test('diffSchemas detects JSON Schema array item field removals', () => {
  const before = {
    title: 'Order',
    type: 'object',
    properties: {
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            price: { type: 'number' }
          }
        }
      }
    }
  };
  const after = {
    title: 'Order',
    type: 'object',
    properties: {
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sku: { type: 'string' }
          }
        }
      }
    }
  };

  const diff = diffSchemas(before, after);

  assert.equal(diff.breaking, true);
  assert.ok(diff.affected.some(a =>
    a.object === 'Order' &&
    a.property === 'line_items[].price' &&
    a.change_type === 'remove'
  ));
});

test('diffSchemas supports simple JSON Schema allOf composition', () => {
  const before = {
    title: 'Transaction',
    allOf: [
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' }
        }
      }
    ]
  };
  const after = {
    title: 'Transaction',
    allOf: [
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          amount: { type: 'integer' }
        }
      }
    ]
  };

  const diff = diffSchemas(before, after);

  assert.equal(diff.breaking, true);
  assert.ok(diff.affected.some(a =>
    a.object === 'Transaction' &&
    a.property === 'amount' &&
    a.change_type === 'retype' &&
    a.lossy === true
  ));
});

test('diffSchemas reports new objects as adds', () => {
  const before = { objects: [] };
  const after = { objects: [{ name: 'accounts', properties: [{ name: 'id', type: 'uuid' }] }] };

  const diff = diffSchemas(before, after);
  assert.equal(diff.affected.length, 1);
  assert.equal(diff.affected[0].change_type, 'add');
  assert.equal(diff.affected[0].object, 'accounts');
});
