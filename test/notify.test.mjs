import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationModel,
  generateGitHubMarkdown,
  generateSlackPayload,
  runNotificationAdapter
} from '../src/notify.js';

function declaration(overrides = {}) {
  return {
    seip_version: '0.1.0',
    declaration_id: 'seip_notify_test',
    created_at: '2026-04-23T10:00:00.000Z',
    status: 'PROPOSED',
    producer: { team: 'ledger-api' },
    change: {
      type: 'retype',
      breaking: true,
      summary: 'Change transaction.value from float to integer',
      affected_objects: [{ object: 'transaction', property: 'value' }]
    },
    migration: { strategy: 'dual_write' },
    timeline: {
      review_deadline: '2026-05-01T00:00:00.000Z',
      deprecation_date: '2026-06-01T00:00:00.000Z',
      removal_date: '2026-07-01T00:00:00.000Z'
    },
    consumers: [
      { team: 'payments-api', status: 'PENDING' },
      { team: 'risk-service', status: 'OBJECTED' }
    ],
    responses: [],
    events: [],
    ...overrides
  };
}

test('generateSlackPayload includes declaration details and repo-specific GitHub URL', () => {
  const payload = generateSlackPayload(declaration(), {
    repoUrl: 'https://github.com/acme/ledger'
  });

  const payloadText = JSON.stringify(payload);
  assert.match(payloadText, /seip_notify_test/);
  assert.match(payloadText, /Change transaction\.value/);
  assert.match(payloadText, /ledger-api/);
  assert.match(payloadText, /PROPOSED/);
  assert.match(payloadText, /payments-api/);
  assert.match(payloadText, /risk-service/);
  assert.match(
    payloadText,
    /https:\/\/github\.com\/acme\/ledger\/blob\/main\/\.seip\/declarations\/seip_notify_test\.json/
  );
  assert.doesNotMatch(payloadText, /github\.com\/example\/repo/);
});

test('generateGitHubMarkdown includes response commands and review context', () => {
  const markdown = generateGitHubMarkdown(declaration(), {
    repoUrl: 'https://github.com/acme/ledger'
  });

  assert.match(markdown, /SEIP Proposal: `seip_notify_test`/);
  assert.match(markdown, /Status: `PROPOSED`/);
  assert.match(markdown, /Producer: `ledger-api`/);
  assert.match(markdown, /Review deadline: `2026-05-01`/);
  assert.match(markdown, /payments-api/);
  assert.match(markdown, /risk-service/);
  assert.match(markdown, /seip respond seip_notify_test --team payments-api --status ACKNOWLEDGED/);
  assert.match(markdown, /seip respond seip_notify_test --team payments-api --status OBJECTED/);
});

test('buildNotificationModel exposes canonical notification data', () => {
  const model = buildNotificationModel(declaration(), {
    repoUrl: 'https://github.com/acme/ledger'
  });

  assert.equal(model.id, 'seip_notify_test');
  assert.equal(model.summary, 'Change transaction.value from float to integer');
  assert.equal(model.producer, 'ledger-api');
  assert.equal(model.consumers.length, 2);
  assert.equal(model.affectedObjects[0].object, 'transaction');
  assert.equal(
    model.declarationUrl,
    'https://github.com/acme/ledger/blob/main/.seip/declarations/seip_notify_test.json'
  );
});

test('runNotificationAdapter rejects unknown adapters clearly', async () => {
  await assert.rejects(
    () => runNotificationAdapter(declaration(), { adapter: 'carrier-pigeon' }),
    /Unknown notification adapter: carrier-pigeon/
  );
});
