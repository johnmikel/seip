/**
 * SEIP Engine — Zero dependencies, pure JavaScript.
 * 
 * Manages Schema Change Declarations (SCDs) stored as JSON files
 * in a .seip/ directory inside your repo.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ── Schema Diffing ───────────────────────────────────────────────────────────

export function diffSchemas(before, after) {
  const affected = [];

  for (const bObj of (before.objects || before.tables || [])) {
    const objName = bObj.name || bObj.table;
    const aObj = (after.objects || after.tables || []).find(o => (o.name || o.table) === objName);
    if (!aObj) {
      // Entire object removed
      for (const p of (bObj.properties || bObj.columns || [])) {
        affected.push({
          object: objName,
          property: p.name || p.column,
          change_type: 'remove',
          before: { name: p.name || p.column, type: p.type },
          after: {}
        });
      }
      continue;
    }

    const bProps = bObj.properties || bObj.columns || [];
    const aProps = aObj.properties || aObj.columns || [];

    for (const bProp of bProps) {
      const bName = bProp.name || bProp.column;
      const aProp = aProps.find(p => (p.name || p.column) === bName);

      if (!aProp) {
        // Check for rename: same type, new name not in before
        const renamed = aProps.find(p =>
          p.type === bProp.type && !bProps.some(bp => (bp.name || bp.column) === (p.name || p.column))
        );
        if (renamed) {
          affected.push({
            object: objName, property: bName, change_type: 'rename',
            before: { name: bName, type: bProp.type },
            after: { name: renamed.name || renamed.column, type: renamed.type }
          });
        } else {
          affected.push({
            object: objName, property: bName, change_type: 'remove',
            before: { name: bName, type: bProp.type }, after: {}
          });
        }
      } else if (bProp.type !== aProp.type) {
        affected.push({
          object: objName, property: bName, change_type: 'retype',
          before: { name: bName, type: bProp.type },
          after: { name: bName, type: aProp.type }
        });
      }
    }

    // Detect additions
    for (const aProp of aProps) {
      const aName = aProp.name || aProp.column;
      if (!bProps.some(p => (p.name || p.column) === aName)) {
        if (affected.some(a => a.after?.name === aName)) continue; // already caught as rename
        affected.push({
          object: objName, property: aName, change_type: 'add',
          before: {}, after: { name: aName, type: aProp.type, required: aProp.required }
        });
      }
    }
  }

  const breaking = affected.some(a => ['remove', 'rename', 'retype'].includes(a.change_type));
  return { affected, breaking };
}

// ── File Store ────────────────────────────────────────────────────────────────

export function getSeipDir(repoRoot = '.') {
  return join(repoRoot, '.seip', 'declarations');
}

export function ensureSeipDir(repoRoot = '.') {
  const dir = getSeipDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  return dir;
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
  affectedObjects, migrationStrategy, migrationSteps,
  migrationSql, rollbackSql, reviewDeadline,
  deprecationDate, removalDate, producerTeam,
  producerContact, consumers
}) {
  if (breaking && !migrationStrategy) {
    throw new Error('Breaking changes require a migration strategy');
  }

  return {
    seip_version: '0.1.0',
    declaration_id: id || `scd_${randomBytes(4).toString('hex')}`,
    created_at: new Date().toISOString(),
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
    responses: []
  };
}

export function propose(scd) {
  if (scd.status !== 'DRAFT') throw new Error(`Cannot propose: status is ${scd.status}`);
  scd.status = 'PROPOSED';
  scd.timeline.proposed_at = new Date().toISOString();
  return scd;
}

export function respond(scd, { team, status, message, estimatedEffort, requestedDeadline }) {
  const consumer = scd.consumers.find(c => c.team === team);
  if (consumer) consumer.status = status;

  scd.responses.push({
    team, status, message,
    responded_at: new Date().toISOString(),
    estimated_effort: estimatedEffort,
    requested_deadline: requestedDeadline
  });

  if (status === 'OBJECTED') {
    scd.status = 'UNDER_REVIEW';
  }

  const allResponded = scd.consumers.every(c => c.status !== 'PENDING');
  const anyObjected = scd.consumers.some(c => c.status === 'OBJECTED');
  if (allResponded && !anyObjected) {
    scd.status = 'ACCEPTED';
  }

  return scd;
}

export function enforce(scd) {
  if (scd.status !== 'ACCEPTED') throw new Error(`Cannot enforce: status is ${scd.status}`);
  scd.status = 'ENFORCING';
  return scd;
}

export function complete(scd) {
  if (scd.status !== 'ENFORCING') throw new Error(`Cannot complete: status is ${scd.status}`);
  scd.status = 'COMPLETED';
  return scd;
}

export function withdraw(scd, reason) {
  if (['COMPLETED', 'ENFORCING'].includes(scd.status)) throw new Error(`Cannot withdraw: status is ${scd.status}`);
  scd.status = 'WITHDRAWN';
  scd.change.details += `\n[WITHDRAWN] ${reason}`;
  return scd;
}

// ── CI/CD Validation ──────────────────────────────────────────────────────────

/**
 * Validate that all breaking changes have a corresponding declaration.
 * Returns { valid, errors, warnings }.
 */
export function validate(diff, declarations) {
  const errors = [];
  const warnings = [];

  const breakingChanges = diff.affected.filter(a =>
    ['remove', 'rename', 'retype'].includes(a.change_type)
  );

  for (const change of breakingChanges) {
    const covered = declarations.some(scd =>
      ['DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'ACCEPTED', 'ENFORCING'].includes(scd.status) &&
      scd.change.affected_objects.some(a =>
        a.object === change.object && a.property === change.property
      )
    );
    if (!covered) {
      errors.push(
        `BREAKING: ${change.object}.${change.property} (${change.change_type}) has no Schema Change Declaration. ` +
        `Create one with: seip create --id scd_${change.property}_rename`
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
