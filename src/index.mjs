/**
 * SEIP Engine — Zero dependencies, pure JavaScript.
 * 
 * Manages schema change declarations stored as JSON files
 * in a .seip/ directory inside your repo.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ── Schema Diffing ───────────────────────────────────────────────────────────

export function diffSchemas(before, after, options = {}) {
  const affected = [];
  const strict = !!options.strict;

  const beforeObjects = before.objects || before.tables || [];
  const afterObjects = after.objects || after.tables || [];
  const objName = o => o.name || o.table;
  const propName = p => p.name || p.column;

  const beforeMap = new Map(beforeObjects.map(o => [objName(o), o]));
  const afterMap = new Map(afterObjects.map(o => [objName(o), o]));

  for (const [name, bObj] of beforeMap.entries()) {
    const aObj = afterMap.get(name);
    if (!aObj) {
      // Entire object removed
      for (const p of (bObj.properties || bObj.columns || [])) {
        affected.push({
          object: name,
          property: propName(p),
          change_type: 'remove',
          before: { name: propName(p), type: p.type, required: p.required },
          after: {}
        });
      }
      continue;
    }

    const bProps = bObj.properties || bObj.columns || [];
    const aProps = aObj.properties || aObj.columns || [];

    const bMap = new Map(bProps.map(p => [propName(p), p]));
    const aMap = new Map(aProps.map(p => [propName(p), p]));

    const removed = [];
    const added = [];

    for (const bProp of bProps) {
      const bName = propName(bProp);
      const aProp = aMap.get(bName);
      if (!aProp) {
        removed.push(bProp);
        continue;
      }
      if (bProp.type !== aProp.type) {
        affected.push({
          object: name, property: bName, change_type: 'retype',
          before: { name: bName, type: bProp.type, required: bProp.required },
          after: { name: bName, type: aProp.type, required: aProp.required }
        });
      }
    }

    for (const aProp of aProps) {
      const aName = propName(aProp);
      if (!bMap.has(aName)) added.push(aProp);
    }

    // Match renames only when there's a single unambiguous candidate
    const usedAdded = new Set();
    for (const bProp of removed) {
      const candidates = added.filter(aProp => {
        if (usedAdded.has(propName(aProp))) return false;
        if (aProp.type !== bProp.type) return false;
        if (typeof aProp.required === 'boolean' && typeof bProp.required === 'boolean') {
          if (aProp.required !== bProp.required) return false;
        }
        return true;
      });
      if (candidates.length === 1) {
        const renamed = candidates[0];
        usedAdded.add(propName(renamed));
        affected.push({
          object: name, property: propName(bProp), change_type: 'rename',
          before: { name: propName(bProp), type: bProp.type, required: bProp.required },
          after: { name: propName(renamed), type: renamed.type, required: renamed.required }
        });
      } else {
        affected.push({
          object: name, property: propName(bProp), change_type: 'remove',
          before: { name: propName(bProp), type: bProp.type, required: bProp.required },
          after: {}
        });
      }
    }

    // Remaining additions
    for (const aProp of added) {
      const aName = propName(aProp);
      if (usedAdded.has(aName)) continue;
      const changeType = strict && aProp.required === true ? 'add_required' : 'add';
      affected.push({
        object: name, property: aName, change_type: changeType,
        before: {}, after: { name: aName, type: aProp.type, required: aProp.required }
      });
    }
  }

  // New objects (present only in "after")
  for (const [name, aObj] of afterMap.entries()) {
    if (beforeMap.has(name)) continue;
    for (const p of (aObj.properties || aObj.columns || [])) {
      const changeType = strict && p.required === true ? 'add_required' : 'add';
      affected.push({
        object: name,
        property: propName(p),
        change_type: changeType,
        before: {},
        after: { name: propName(p), type: p.type, required: p.required }
      });
    }
  }

  const breaking = affected.some(a => ['remove', 'rename', 'retype', 'add_required'].includes(a.change_type));
  return { affected, breaking };
}

// ── File Store ────────────────────────────────────────────────────────────────

export function getSeipDir(repoRoot = '.') {
  return join(repoRoot, '.seip', 'declarations');
}

export function getSeipRoot(repoRoot = '.') {
  return join(repoRoot, '.seip');
}

export function ensureSeipRoot(repoRoot = '.') {
  const dir = getSeipRoot(repoRoot);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureSeipDir(repoRoot = '.') {
  const dir = getSeipDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getConfigPath(repoRoot = '.') {
  return join(getSeipRoot(repoRoot), 'config.json');
}

export function defaultConfig() {
  return {
    defaults: {
      producer: 'unknown',
      review_days: 7,
      deprecate_days: 30,
      remove_days: 60
    },
    policy: {
      strict_required_additions: false,
      min_status: 'DRAFT',
      required_consumers: []
    }
  };
}

function mergeConfig(base, override) {
  const merged = { ...base, ...override };
  merged.defaults = { ...base.defaults, ...(override.defaults || {}) };
  merged.policy = { ...base.policy, ...(override.policy || {}) };
  return merged;
}

export function loadConfig(repoRoot = '.') {
  const filepath = getConfigPath(repoRoot);
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

export function saveConfig(config, repoRoot = '.') {
  ensureSeipRoot(repoRoot);
  const filepath = getConfigPath(repoRoot);
  writeFileSync(filepath, JSON.stringify(config, null, 2) + '\n');
  return filepath;
}

export function getConfig(repoRoot = '.') {
  const loaded = loadConfig(repoRoot) || {};
  return mergeConfig(defaultConfig(), loaded);
}

export function saveDeclaration(scd, repoRoot = '.') {
  const dir = ensureSeipDir(repoRoot);
  const filepath = join(dir, `${scd.declaration_id}.json`);
  writeFileSync(filepath, JSON.stringify(scd, null, 2) + '\n');
  return filepath;
}

export function loadDeclaration(id, repoRoot = '.') {
  const filepath = join(getSeipDir(repoRoot), `${id}.json`);
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

export function listDeclarations(repoRoot = '.') {
  const dir = getSeipDir(repoRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}

// ── Declaration Lifecycle ─────────────────────────────────────────────────────

export function createDeclaration({
  id, summary, details, changeType, breaking,
  affectedObjects, renames, migrationStrategy, migrationSteps,
  migrationSql, rollbackSql, reviewDeadline,
  deprecationDate, removalDate, producerTeam,
  producerContact, consumers, actor
}) {
  if (breaking && !migrationStrategy) {
    throw new Error('Breaking changes require a migration strategy');
  }

  const createdAt = new Date().toISOString();
  const eventActor = actor || producerTeam || 'unknown';

  return {
    seip_version: '0.1.0',
    declaration_id: id || `seip_${randomBytes(4).toString('hex')}`,
    created_at: createdAt,
    status: 'DRAFT',
    producer: {
      team: producerTeam || 'unknown',
      contact: producerContact || ''
    },
    change: {
      type: changeType || 'restructure',
      breaking: !!breaking,
      summary: summary || 'Schema change',
      details: details || '',
      affected_objects: affectedObjects || [],
      renames: renames || [],
      compatibility: {
        backward: !breaking,
        forward: true,
        migration_available: !!migrationStrategy
      }
    },
    migration: migrationStrategy ? {
      strategy: migrationStrategy,
      steps: migrationSteps || [],
      sql: migrationSql || [],
      rollback: rollbackSql || ''
    } : undefined,
    timeline: {
      review_deadline: reviewDeadline || futureDate(7),
      migration_start: reviewDeadline || futureDate(7),
      deprecation_date: deprecationDate || futureDate(30),
      removal_date: removalDate || futureDate(60)
    },
    consumers: (consumers || []).map(c => ({
      team: c.team,
      contact: c.contact || '',
      dependencies: c.dependencies || [],
      status: 'PENDING'
    })),
    responses: [],
    events: [
      {
        type: 'CREATED',
        at: createdAt,
        actor: eventActor,
        message: 'Declaration created',
        from_status: null,
        to_status: 'DRAFT'
      }
    ]
  };
}

export function propose(scd, actor) {
  if (scd.status !== 'DRAFT') throw new Error(`Cannot propose: status is ${scd.status}`);
  const fromStatus = scd.status;
  scd.status = 'PROPOSED';
  scd.timeline.proposed_at = new Date().toISOString();
  addEvent(scd, {
    type: 'PROPOSED',
    actor: actor || scd.producer?.team || 'unknown',
    message: 'Declaration proposed',
    from_status: fromStatus,
    to_status: scd.status
  });
  return scd;
}

export function respond(scd, { team, status, message, estimatedEffort, requestedDeadline }) {
  const normalizedStatus = String(status || '').toUpperCase();
  if (!ALLOWED_RESPONSE_STATUSES.has(normalizedStatus)) {
    throw new Error(`Invalid response status: ${status}`);
  }

  const fromStatus = scd.status;
  const consumer = scd.consumers.find(c => c.team === team);
  if (consumer) consumer.status = normalizedStatus;

  scd.responses.push({
    team, status: normalizedStatus, message,
    responded_at: new Date().toISOString(),
    estimated_effort: estimatedEffort,
    requested_deadline: requestedDeadline
  });

  if (normalizedStatus === 'OBJECTED') {
    scd.status = 'UNDER_REVIEW';
  }

  const allResponded = scd.consumers.every(c => c.status !== 'PENDING');
  const anyObjected = scd.consumers.some(c => c.status === 'OBJECTED');
  if (allResponded && !anyObjected) {
    scd.status = 'ACCEPTED';
  }

  addEvent(scd, {
    type: 'RESPONDED',
    actor: team,
    message: message || `Response: ${normalizedStatus}`,
    response_status: normalizedStatus,
    from_status: fromStatus,
    to_status: scd.status
  });

  return scd;
}

export function enforce(scd, actor) {
  if (scd.status !== 'ACCEPTED') throw new Error(`Cannot enforce: status is ${scd.status}`);
  const fromStatus = scd.status;
  scd.status = 'ENFORCING';
  addEvent(scd, {
    type: 'ENFORCING',
    actor: actor || scd.producer?.team || 'unknown',
    message: 'Declaration moved to ENFORCING',
    from_status: fromStatus,
    to_status: scd.status
  });
  return scd;
}

export function complete(scd, actor) {
  if (scd.status !== 'ENFORCING') throw new Error(`Cannot complete: status is ${scd.status}`);
  const fromStatus = scd.status;
  scd.status = 'COMPLETED';
  addEvent(scd, {
    type: 'COMPLETED',
    actor: actor || scd.producer?.team || 'unknown',
    message: 'Declaration completed',
    from_status: fromStatus,
    to_status: scd.status
  });
  return scd;
}

export function withdraw(scd, reason, actor) {
  if (['COMPLETED', 'ENFORCING'].includes(scd.status)) throw new Error(`Cannot withdraw: status is ${scd.status}`);
  const fromStatus = scd.status;
  scd.status = 'WITHDRAWN';
  scd.change.details += `\n[WITHDRAWN] ${reason}`;
  addEvent(scd, {
    type: 'WITHDRAWN',
    actor: actor || scd.producer?.team || 'unknown',
    message: reason || 'Declaration withdrawn',
    from_status: fromStatus,
    to_status: scd.status
  });
  return scd;
}

export function reject(scd, reason, actor) {
  if (['COMPLETED', 'ENFORCING'].includes(scd.status)) throw new Error(`Cannot reject: status is ${scd.status}`);
  const fromStatus = scd.status;
  scd.status = 'REJECTED';
  scd.change.details += `\n[REJECTED] ${reason}`;
  addEvent(scd, {
    type: 'REJECTED',
    actor: actor || scd.producer?.team || 'unknown',
    message: reason || 'Declaration rejected',
    from_status: fromStatus,
    to_status: scd.status
  });
  return scd;
}

// ── CI/CD Validation ──────────────────────────────────────────────────────────

/**
 * Validate that all breaking changes have a corresponding declaration.
 * Returns { valid, errors, warnings }.
 */
export function validate(diff, declarations, options = {}) {
  const errors = [];
  const warnings = [];

  const statusOrder = ['DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'ACCEPTED', 'ENFORCING', 'COMPLETED'];
  const statusRank = status => statusOrder.indexOf(status);

  const matchesAffected = (scd, change) => {
    const names = new Set([change.property, change.before?.name, change.after?.name].filter(Boolean));
    const affectedObjects = scd.change?.affected_objects || [];
    if (change.change_type === 'rename') {
      const renames = scd.change?.renames || [];
      const renameHit = renames.some(r =>
        r.object === change.object &&
        r.from === change.before?.name &&
        r.to === change.after?.name
      );
      if (renameHit) return true;
    }
    return affectedObjects.some(a =>
      a.object === change.object && names.has(a.property)
    );
  };

  const minStatus = options.min_status || 'DRAFT';
  const requiredConsumers = options.required_consumers || [];

  const isEligibleDeclaration = scd => {
    if (['WITHDRAWN', 'REJECTED'].includes(scd.status)) return false;
    const rank = statusRank(scd.status);
    const minRank = statusRank(minStatus);
    if (rank === -1 || minRank === -1) return false;
    if (rank < minRank) return false;
    if (!requiredConsumers || requiredConsumers.length === 0) return true;
    const consumers = Array.isArray(scd.consumers) ? scd.consumers : [];
    return requiredConsumers.every(team => {
      const consumer = consumers.find(c => c.team === team);
      return consumer && consumer.status === 'ACKNOWLEDGED';
    });
  };

  const breakingChanges = diff.affected.filter(a =>
    ['remove', 'rename', 'retype', 'add_required'].includes(a.change_type)
  );

  for (const change of breakingChanges) {
    const covered = declarations.some(scd =>
      isEligibleDeclaration(scd) &&
      matchesAffected(scd, change)
    );
    if (!covered) {
      const detail = change.change_type === 'rename' && change.after?.name
        ? `${change.property} → ${change.after.name}`
        : change.property;
      const typeHint = change.change_type === 'add_required' ? 'add' : change.change_type;
      errors.push(
        `BREAKING: ${change.object}.${detail} (${change.change_type}) has no Schema Change Declaration. ` +
        `Create one with: seip create --breaking --summary "..." --type ${typeHint}`
      );
    }
  }

  const nonBreaking = diff.affected.filter(a => a.change_type === 'add');
  for (const change of nonBreaking) {
    const covered = declarations.some(scd =>
      scd.change.affected_objects.some(a =>
        a.object === change.object && a.property === change.property
      )
    );
    if (!covered) {
      warnings.push(
        `INFO: ${change.object}.${change.property} (${change.change_type}) — non-breaking, declaration recommended but not required.`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function addEvent(scd, event) {
  if (!Array.isArray(scd.events)) scd.events = [];
  const entry = { ...event, at: event.at || new Date().toISOString() };
  scd.events.push(entry);
}

const ALLOWED_STATUSES = new Set([
  'DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'ACCEPTED', 'ENFORCING', 'COMPLETED', 'WITHDRAWN', 'REJECTED'
]);
const ALLOWED_CHANGE_TYPES = new Set(['add', 'remove', 'rename', 'retype', 'deprecate', 'restructure']);
const ALLOWED_RESPONSE_STATUSES = new Set(['ACKNOWLEDGED', 'OBJECTED', 'EXTENSION_REQUESTED']);
const ALLOWED_CONSUMER_STATUSES = new Set(['PENDING', 'ACKNOWLEDGED', 'OBJECTED', 'EXTENSION_REQUESTED']);

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(Date.parse(value));
}

export function validateDeclaration(scd) {
  const errors = [];
  const warnings = [];

  if (!scd || typeof scd !== 'object') {
    errors.push('Declaration is not a JSON object.');
    return { valid: false, errors, warnings };
  }

  if (!scd.seip_version) errors.push('Missing seip_version.');
  if (!scd.declaration_id) errors.push('Missing declaration_id.');
  if (!scd.created_at) errors.push('Missing created_at.');
  if (scd.created_at && !isIsoDate(scd.created_at)) errors.push('created_at is not a valid ISO date.');
  if (!ALLOWED_STATUSES.has(scd.status)) errors.push(`Invalid status: ${scd.status}`);

  const change = scd.change || {};
  if (!change.summary) errors.push('Missing change.summary.');
  if (!ALLOWED_CHANGE_TYPES.has(change.type)) errors.push(`Invalid change.type: ${change.type}`);
  if (typeof change.breaking !== 'boolean') errors.push('Missing or invalid change.breaking (boolean).');

  const affected = change.affected_objects || [];
  if (!Array.isArray(affected)) {
    errors.push('change.affected_objects must be an array.');
  } else if (change.breaking && affected.length === 0) {
    warnings.push('Breaking change has no affected_objects listed.');
  } else {
    for (const a of affected) {
      if (!a.object || !a.property) errors.push('affected_objects entries must include object and property.');
    }
  }

  const renames = change.renames || [];
  if (!Array.isArray(renames)) {
    errors.push('change.renames must be an array if provided.');
  } else {
    for (const r of renames) {
      if (!r.object || !r.from || !r.to) errors.push('change.renames entries must include object, from, and to.');
    }
  }

  const timeline = scd.timeline || {};
  if (!timeline.review_deadline) errors.push('Missing timeline.review_deadline.');
  if (!timeline.deprecation_date) errors.push('Missing timeline.deprecation_date.');
  if (!timeline.removal_date) errors.push('Missing timeline.removal_date.');
  if (timeline.review_deadline && !isIsoDate(timeline.review_deadline)) errors.push('timeline.review_deadline is not a valid ISO date.');
  if (timeline.deprecation_date && !isIsoDate(timeline.deprecation_date)) errors.push('timeline.deprecation_date is not a valid ISO date.');
  if (timeline.removal_date && !isIsoDate(timeline.removal_date)) errors.push('timeline.removal_date is not a valid ISO date.');

  const producer = scd.producer || {};
  if (!producer.team) errors.push('Missing producer.team.');

  const consumers = scd.consumers || [];
  if (!Array.isArray(consumers)) {
    errors.push('consumers must be an array.');
  } else {
    for (const c of consumers) {
      if (!c.team) errors.push('consumers entries must include team.');
      if (c.status && !ALLOWED_CONSUMER_STATUSES.has(c.status)) errors.push(`Unknown consumer status: ${c.status}`);
    }
  }

  const responses = scd.responses || [];
  if (!Array.isArray(responses)) {
    errors.push('responses must be an array.');
  } else {
    for (const r of responses) {
      if (!r.team || !r.status) errors.push('responses entries must include team and status.');
      if (r.status && !ALLOWED_RESPONSE_STATUSES.has(r.status)) errors.push(`Unknown response status: ${r.status}`);
      if (r.responded_at && !isIsoDate(r.responded_at)) errors.push('responses.responded_at is not a valid ISO date.');
    }
  }

  const events = scd.events;
  if (!Array.isArray(events)) {
    warnings.push('events array missing; audit trail not available.');
  } else {
    for (const e of events) {
      if (!e.type) errors.push('events entries must include type.');
      if (!e.at) errors.push('events entries must include at.');
      if (e.at && !isIsoDate(e.at)) errors.push('events.at is not a valid ISO date.');
    }
  }

  if (change.breaking && !(scd.migration && scd.migration.strategy)) {
    errors.push('Breaking changes require migration.strategy.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
