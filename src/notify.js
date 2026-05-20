import fs from 'fs';
import path from 'path';

function isDeclaration(value) {
  return value && typeof value === 'object' && value.declaration_id;
}

function loadDeclarationInput(declarationOrId, repoRoot = process.cwd()) {
  if (isDeclaration(declarationOrId)) return declarationOrId;

  const declarationId = String(declarationOrId || '');
  const decPath = path.resolve(repoRoot, `.seip/declarations/${declarationId}.json`);
  if (!fs.existsSync(decPath)) {
    throw new Error(`Declaration ${declarationId} not found.`);
  }

  return JSON.parse(fs.readFileSync(decPath, 'utf8'));
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function declarationUrl(declarationId, options = {}) {
  if (options.declarationUrl) return options.declarationUrl;
  if (!options.repoUrl) return `.seip/declarations/${declarationId}.json`;

  const repoUrl = stripTrailingSlash(options.repoUrl).replace(/\.git$/, '');
  const branch = options.branch || 'main';
  return `${repoUrl}/blob/${branch}/.seip/declarations/${declarationId}.json`;
}

function dateOnly(value) {
  return value ? String(value).split('T')[0] : 'unspecified';
}

function consumerRows(consumers) {
  if (!consumers.length) return 'No consumers declared.';
  return consumers.map(c => `| \`${c.team}\` | \`${c.status || 'PENDING'}\` |`).join('\n');
}

function slackConsumers(consumers) {
  if (!consumers.length) return 'None declared yet.';
  return consumers.map(c => `*${c.team}* (${c.status || 'PENDING'})`).join('\n');
}

function affectedText(affectedObjects) {
  if (!affectedObjects.length) return 'None listed.';
  return affectedObjects.map(a => `\`${a.object}.${a.property}\``).join(', ');
}

/**
 * Converts a SEIP declaration into adapter-neutral notification data.
 */
export function buildNotificationModel(declarationOrId, options = {}) {
  const decl = loadDeclarationInput(declarationOrId, options.repoRoot);
  const consumers = Array.isArray(decl.consumers) ? decl.consumers : [];
  const affectedObjects = Array.isArray(decl.change?.affected_objects)
    ? decl.change.affected_objects
    : [];

  return {
    id: decl.declaration_id,
    summary: decl.change?.summary || 'Schema change',
    status: decl.status || 'DRAFT',
    producer: decl.producer?.team || 'unknown',
    changeType: decl.change?.type || 'restructure',
    breaking: !!decl.change?.breaking,
    reviewDeadline: decl.timeline?.review_deadline || '',
    deprecationDate: decl.timeline?.deprecation_date || '',
    removalDate: decl.timeline?.removal_date || '',
    consumers: consumers.map(c => ({
      team: c.team,
      status: c.status || 'PENDING',
      contact: c.contact || ''
    })),
    affectedObjects: affectedObjects.map(a => ({
      object: a.object,
      property: a.property
    })),
    declarationUrl: declarationUrl(decl.declaration_id, options)
  };
}

/**
 * Generates a Slack Block Kit payload for a SEIP declaration.
 */
export function generateSlackPayload(declarationOrId, options = {}) {
  const model = buildNotificationModel(declarationOrId, options);
  const color = model.breaking ? '#D93F3C' : '#36A64F';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `SEIP Proposal: ${model.id}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary:*\n${model.summary}`
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Producer:*\n${model.producer}`
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${model.status}`
        },
        {
          type: 'mrkdwn',
          text: `*Breaking Change:*\n${model.breaking ? 'YES' : 'NO'}`
        },
        {
          type: 'mrkdwn',
          text: `*Type:*\n\`${model.changeType}\``
        },
        {
          type: 'mrkdwn',
          text: `*Review Deadline:*\n${dateOnly(model.reviewDeadline)}`
        },
        {
          type: 'mrkdwn',
          text: `*Affected:*\n${affectedText(model.affectedObjects)}`
        }
      ]
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Downstream Consumers:*\n${slackConsumers(model.consumers)}`
      }
    }
  ];

  if (/^https?:\/\//.test(model.declarationUrl)) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in GitHub',
            emoji: true
          },
          url: model.declarationUrl
        },
        {
          type: 'button',
          style: 'primary',
          text: {
            type: 'plain_text',
            text: 'Acknowledge Impact',
            emoji: true
          },
          value: `ack_${model.id}`
        },
        {
          type: 'button',
          style: 'danger',
          text: {
            type: 'plain_text',
            text: 'Object / Request Delay',
            emoji: true
          },
          value: `obj_${model.id}`
        }
      ]
    });
  }

  return {
    attachments: [
      {
        color,
        blocks
      }
    ]
  };
}

/**
 * Generates Markdown suitable for a GitHub PR comment or Actions summary.
 */
export function generateGitHubMarkdown(declarationOrId, options = {}) {
  const model = buildNotificationModel(declarationOrId, options);
  const firstConsumer = model.consumers[0]?.team || '<team>';

  return [
    `## SEIP Proposal: \`${model.id}\``,
    '',
    model.summary,
    '',
    `- Status: \`${model.status}\``,
    `- Producer: \`${model.producer}\``,
    `- Change type: \`${model.changeType}\``,
    `- Breaking: \`${model.breaking ? 'yes' : 'no'}\``,
    `- Review deadline: \`${dateOnly(model.reviewDeadline)}\``,
    `- Declaration: [\`${model.id}.json\`](${model.declarationUrl})`,
    `- Affected objects: ${affectedText(model.affectedObjects)}`,
    '',
    '### Consumers',
    '',
    '| Team | Status |',
    '| --- | --- |',
    consumerRows(model.consumers),
    '',
    '### Suggested consumer commands',
    '',
    '```bash',
    `npx seip validate-consumer ${model.id} --against <path-to-consumer-code> --command "<team-owned-check>"`,
    `npx seip respond ${model.id} --team ${firstConsumer} --status ACKNOWLEDGED --message "Validation passed."`,
    `npx seip respond ${model.id} --team ${firstConsumer} --status OBJECTED --message "Describe the blocker."`,
    '```'
  ].join('\n');
}

export async function runNotificationAdapter(declarationOrId, options = {}) {
  const adapter = (options.adapter || 'github').toLowerCase();
  const decl = loadDeclarationInput(declarationOrId, options.repoRoot);

  if (adapter === 'github') {
    return {
      adapter,
      delivered: false,
      target: 'github-markdown',
      payload: generateGitHubMarkdown(decl, options)
    };
  }

  if (adapter === 'slack') {
    const payload = generateSlackPayload(decl, options);
    const webhook = options.webhook || '';
    const dryRun = !!options.dryRun || !webhook || webhook.startsWith('mock:');

    if (!dryRun) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Slack API responded with ${response.status}: ${await response.text()}`);
      }
    }

    return {
      adapter,
      delivered: !dryRun,
      target: webhook || 'unspecified webhook',
      payload
    };
  }

  throw new Error(`Unknown notification adapter: ${adapter}`);
}

/**
 * Backward-compatible helper for existing demos.
 */
export async function sendToSlack(declarationId, webhookUrl, options = {}) {
  return runNotificationAdapter(declarationId, {
    ...options,
    adapter: 'slack',
    webhook: webhookUrl
  });
}
