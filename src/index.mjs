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

  const beforeObjects = schemaObjects(before);
  const afterObjects = schemaObjects(after);
  const objName = o => o.name || o.table;
  const propName = p => p.name || p.column;
  const snapshot = p => ({
    name: propName(p),
    type: p.type,
    required: p.required,
    nullable: p.nullable,
    enum: p.enum,
    format: p.format
  });

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
        // Evaluate if this type transition is inherently lossy
        const lossyTransitions = [
          { from: 'float', to: 'integer' },
          { from: 'number', to: 'integer' },
          { from: 'string', to: 'boolean' },
          { from: 'string', to: 'integer' },
          { from: 'object', to: 'string' }
        ];
        
        const isLossy = lossyTransitions.some(
          t => bProp.type.toLowerCase() === t.from && aProp.type.toLowerCase() === t.to
        );

        affected.push({
          object: name, property: bName, change_type: 'retype',
          lossy: isLossy,
          before: snapshot(bProp),
          after: snapshot(aProp)
        });
      }
      if (bProp.required !== true && aProp.required === true) {
        affected.push({
          object: name, property: bName, change_type: 'make_required',
          before: snapshot(bProp),
          after: snapshot(aProp)
        });
      }
      if (bProp.nullable === true && aProp.nullable === false) {
        affected.push({
          object: name, property: bName, change_type: 'make_non_nullable',
          before: snapshot(bProp),
          after: snapshot(aProp)
        });
      }
      if (Array.isArray(bProp.enum) && Array.isArray(aProp.enum)) {
        const beforeEnum = new Set(bProp.enum);
        const afterEnum = new Set(aProp.enum);
        const afterIsSubset = aProp.enum.every(value => beforeEnum.has(value));
        const beforeIsSubset = bProp.enum.every(value => afterEnum.has(value));
        if (afterIsSubset && aProp.enum.length < bProp.enum.length) {
          affected.push({
            object: name, property: bName, change_type: 'enum_narrow',
            before: snapshot(bProp),
            after: snapshot(aProp)
          });
        } else if (beforeIsSubset && aProp.enum.length > bProp.enum.length) {
          affected.push({
            object: name, property: bName, change_type: 'enum_widen',
            before: snapshot(bProp),
            after: snapshot(aProp)
          });
        }
      }
      if (bProp.format && aProp.format && bProp.format !== aProp.format) {
        affected.push({
          object: name, property: bName, change_type: 'format_change',
          before: snapshot(bProp),
          after: snapshot(aProp)
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
          before: snapshot(bProp),
          after: snapshot(renamed)
        });
      } else {
        affected.push({
          object: name, property: propName(bProp), change_type: 'remove',
          before: snapshot(bProp),
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
        before: {}, after: snapshot(aProp)
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
        after: snapshot(p)
      });
    }
  }

  const breaking = affected.some(isBreakingChange);
  return { affected, breaking };
}

function schemaObjects(schema) {
  if (!schema || typeof schema !== 'object') return [];
  if (Array.isArray(schema.objects)) return schema.objects;
  if (Array.isArray(schema.tables)) return schema.tables;

  if ((schema.properties && typeof schema.properties === 'object') || Array.isArray(schema.allOf)) {
    return [jsonSchemaObject(schema.title || 'root', schema, schema)];
  }

  const objects = [];
  const definitions = schema.$defs || schema.definitions || {};
  for (const [name, value] of Object.entries(definitions)) {
    if (value && typeof value === 'object' && value.properties) {
      objects.push(jsonSchemaObject(value.title || name, value, schema));
    }
  }

  return objects;
}

function jsonSchemaObject(name, schema, rootSchema) {
  return {
    name,
    properties: flattenJsonSchemaProperties(schema, rootSchema, '')
  };
}

function flattenJsonSchemaProperties(schema, rootSchema, prefix, seenRefs = new Set()) {
  const resolvedSchema = resolveJsonSchema(schema, rootSchema, seenRefs);
  const required = new Set(Array.isArray(resolvedSchema.required) ? resolvedSchema.required : []);
  const properties = [];

  for (const [propertyName, propertySchema] of Object.entries(resolvedSchema.properties || {})) {
    const propertyPath = prefix ? `${prefix}.${propertyName}` : propertyName;
    const resolvedProperty = resolveJsonSchema(propertySchema || {}, rootSchema, seenRefs);
    const typeInfo = jsonSchemaType(resolvedProperty);
    properties.push({
      name: propertyPath,
      type: typeInfo.type,
      required: required.has(propertyName),
      nullable: typeInfo.nullable,
      enum: resolvedProperty.enum,
      format: resolvedProperty.format
    });

    if (resolvedProperty.properties && typeof resolvedProperty.properties === 'object') {
      properties.push(...flattenJsonSchemaProperties(resolvedProperty, rootSchema, propertyPath, seenRefs));
    }

    const itemSchema = resolveJsonSchema(resolvedProperty.items || {}, rootSchema, seenRefs);
    if (itemSchema.properties && typeof itemSchema.properties === 'object') {
      properties.push(...flattenJsonSchemaProperties(itemSchema, rootSchema, `${propertyPath}[]`, seenRefs));
    }
  }

  return properties;
}

function resolveJsonSchema(schema, rootSchema, seenRefs = new Set()) {
  if (!schema || typeof schema !== 'object') return {};
  let resolved = schema;

  if (schema.$ref) {
    if (seenRefs.has(schema.$ref)) return schema;
    seenRefs.add(schema.$ref);

    const target = resolveLocalJsonPointer(rootSchema, schema.$ref);
    if (!target) return schema;

    const { $ref, ...overrides } = schema;
    resolved = { ...resolveJsonSchema(target, rootSchema, seenRefs), ...overrides };
  }

  if (Array.isArray(resolved.allOf)) {
    const { allOf, ...overrides } = resolved;
    return mergeJsonSchemas([
      ...allOf.map(part => resolveJsonSchema(part, rootSchema, new Set(seenRefs))),
      overrides
    ]);
  }

  return resolved;
}

function mergeJsonSchemas(schemas) {
  const merged = {};
  const required = new Set();
  for (const schema of schemas) {
    if (!schema || typeof schema !== 'object') continue;
    Object.assign(merged, schema);
    if (schema.properties && typeof schema.properties === 'object') {
      merged.properties = { ...(merged.properties || {}), ...schema.properties };
    }
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) required.add(field);
    }
  }
  if (required.size > 0) merged.required = [...required];
  return merged;
}

function resolveLocalJsonPointer(rootSchema, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref
    .slice(2)
    .split('/')
    .map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = rootSchema;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return null;
    current = current[part];
  }
  return current && typeof current === 'object' ? current : null;
}

function jsonSchemaType(schema) {
  const rawType = schema.type;
  const rawTypes = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
  const nonNullTypes = rawTypes.filter(type => type !== 'null');
  const nullable = rawTypes.includes('null') || schema.nullable === true;

  if (nonNullTypes.length === 0) return { type: 'unknown', nullable };
  return { type: nonNullTypes.join('|'), nullable };
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
  assertDeclarationId(scd.declaration_id);
  const dir = ensureSeipDir(repoRoot);
  const filepath = join(dir, `${scd.declaration_id}.json`);
  writeFileSync(filepath, JSON.stringify(scd, null, 2) + '\n');
  return filepath;
}

export function loadDeclaration(id, repoRoot = '.') {
  assertDeclarationId(id);
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
  if (id) assertDeclarationId(id);
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
  if (!['PROPOSED', 'UNDER_REVIEW'].includes(scd.status)) {
    throw new Error(`Cannot respond: status is ${scd.status}`);
  }

  const fromStatus = scd.status;
  const consumer = scd.consumers.find(c => c.team === team);
  if (!consumer) {
    throw new Error(`${team} is not a declared consumer for ${scd.declaration_id}`);
  }
  consumer.status = normalizedStatus;

  scd.responses.push({
    team, status: normalizedStatus, message,
    responded_at: new Date().toISOString(),
    estimated_effort: estimatedEffort,
    requested_deadline: requestedDeadline
  });

  if (['OBJECTED', 'EXTENSION_REQUESTED'].includes(normalizedStatus)) {
    scd.status = 'UNDER_REVIEW';
  }

  const allAcknowledged = scd.consumers.length > 0 &&
    scd.consumers.every(c => c.status === 'ACKNOWLEDGED');
  if (allAcknowledged) {
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
  const declarationValidation = new Map();

  for (const scd of declarations) {
    const result = validateDeclaration(scd);
    declarationValidation.set(scd, result);
    if (!result.valid) {
      const id = scd?.declaration_id || '<unknown>';
      errors.push(`Declaration ${id} is invalid: ${result.errors.join('; ')}`);
    }
  }

  const matchingAffected = (scd, change) => {
    const names = new Set([change.property, change.before?.name, change.after?.name].filter(Boolean));
    const affectedObjects = scd.change?.affected_objects || [];
    return affectedObjects.filter(a =>
      a.object === change.object && names.has(a.property)
    );
  };

  const matchesAffected = (scd, change) => {
    if (change.change_type === 'rename') {
      const renames = scd.change?.renames || [];
      const renameHit = renames.some(r =>
        r.object === change.object &&
        r.from === change.before?.name &&
        r.to === change.after?.name
      );
      if (renameHit) return true;
    }
    return matchingAffected(scd, change).length > 0;
  };

  const matchesChangeType = (scd, change) => {
    const matchingEntries = matchingAffected(scd, change);
    const entryTypes = matchingEntries.map(a => a.change_type).filter(Boolean);
    if (entryTypes.length > 0 && !entryTypes.some(type => type === change.change_type)) {
      return false;
    }

    const allowedDeclarationTypes = declarationTypesForChange(change);
    return allowedDeclarationTypes.has(scd.change?.type);
  };

  const minStatus = options.min_status || 'DRAFT';
  const requiredConsumers = options.required_consumers || [];

  const isEligibleDeclaration = scd => {
    if (!declarationValidation.get(scd)?.valid) return false;
    if (['WITHDRAWN', 'REJECTED'].includes(scd.status)) return false;
    if (scd.change?.breaking !== true) return false;
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

  const breakingChanges = diff.affected.filter(isBreakingChange);

  for (const change of breakingChanges) {
    const covered = declarations.some(scd =>
      isEligibleDeclaration(scd) &&
      matchesAffected(scd, change) &&
      matchesChangeType(scd, change)
    );
    if (!covered) {
      const detail = change.change_type === 'rename' && change.after?.name
        ? `${change.property} → ${change.after.name}`
        : change.property;
      const typeHint = change.change_type === 'add_required' ? 'add' : change.change_type;
      errors.push(
        `BREAKING: ${change.object}.${detail} (${change.change_type}) has no valid Schema Change Declaration. ` +
        `Create one with: seip create --breaking --summary "..." --type ${typeHint}`
      );
    }
  }

  const nonBreaking = diff.affected.filter(a => a.change_type === 'add');
  for (const change of nonBreaking) {
    const covered = declarations.some(scd =>
      scd.change?.affected_objects?.some(a =>
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

export function isValidDeclarationId(id) {
  return typeof id === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id) &&
    !id.includes('..');
}

function assertDeclarationId(id) {
  if (!isValidDeclarationId(id)) {
    throw new Error(`Invalid declaration_id: ${id}`);
  }
}

export function isBreakingChange(change) {
  return BREAKING_CHANGE_TYPES.has(change.change_type) ||
    (change.change_type === 'retype' && change.lossy === true);
}

function declarationTypesForChange(change) {
  if (change.change_type === 'add_required') return new Set(['add', 'restructure']);
  if (['make_required', 'make_non_nullable', 'enum_narrow'].includes(change.change_type)) {
    return new Set(['restructure']);
  }
  if (change.change_type === 'format_change') return new Set(['retype', 'restructure']);
  return new Set([change.change_type, 'restructure']);
}

const BREAKING_CHANGE_TYPES = new Set([
  'remove',
  'rename',
  'add_required',
  'make_required',
  'make_non_nullable',
  'enum_narrow',
  'format_change'
]);

export function validateDeclaration(scd) {
  const errors = [];
  const warnings = [];

  if (!scd || typeof scd !== 'object') {
    errors.push('Declaration is not a JSON object.');
    return { valid: false, errors, warnings };
  }

  if (!scd.seip_version) errors.push('Missing seip_version.');
  if (!scd.declaration_id) {
    errors.push('Missing declaration_id.');
  } else if (!isValidDeclarationId(scd.declaration_id)) {
    errors.push('Invalid declaration_id. Use letters, numbers, dots, underscores, or hyphens; do not use path separators.');
  }
  if (!scd.created_at) errors.push('Missing created_at.');
  if (scd.created_at && !isIsoDate(scd.created_at)) errors.push('created_at is not a valid ISO date.');
  if (!ALLOWED_STATUSES.has(scd.status)) errors.push(`Invalid status: ${scd.status}`);

  const change = scd.change || {};
  if (!change.summary) errors.push('Missing change.summary.');
  if (!ALLOWED_CHANGE_TYPES.has(change.type)) errors.push(`Invalid change.type: ${change.type}`);
  if (typeof change.breaking !== 'boolean') errors.push('Missing or invalid change.breaking (boolean).');

  const affected = change.affected_objects;
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

  const consumers = scd.consumers;
  if (!Array.isArray(consumers)) {
    errors.push('consumers must be an array.');
  } else {
    for (const c of consumers) {
      if (!c.team) errors.push('consumers entries must include team.');
      if (c.status && !ALLOWED_CONSUMER_STATUSES.has(c.status)) errors.push(`Unknown consumer status: ${c.status}`);
    }
  }

  const responses = scd.responses;
  if (!Array.isArray(responses)) {
    errors.push('responses must be an array.');
  } else {
    for (const r of responses) {
      if (!r.team || !r.status) errors.push('responses entries must include team and status.');
      if (r.status && !ALLOWED_RESPONSE_STATUSES.has(r.status)) errors.push(`Unknown response status: ${r.status}`);
      if (!r.responded_at) errors.push('responses.responded_at is required.');
      if (r.responded_at && !isIsoDate(r.responded_at)) errors.push('responses.responded_at is not a valid ISO date.');
    }
  }

  const events = scd.events;
  if (!Array.isArray(events)) {
    errors.push('events array missing; audit trail not available.');
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
