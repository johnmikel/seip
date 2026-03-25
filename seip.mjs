#!/usr/bin/env node

/**
 * seip — Schema Evolution Intent Protocol CLI
 *
 * Usage:
 *   seip init                         Set up .seip/ in your repo
 *   seip diff <before> <after>        Compare two schema JSON files
 *   seip create [options]             Create a new declaration
 *   seip propose <id>                 Propose a draft declaration
 *   seip respond <id> [options]       Respond to a declaration
 *   seip status [id]                  Show declaration status
 *   seip validate <before> <after>    CI gate: fail if undeclared breaking changes
 */

import { readFileSync, existsSync } from 'fs';
import {
  diffSchemas, createDeclaration, propose, respond,
  saveDeclaration, loadDeclaration, listDeclarations,
  ensureSeipDir, validate
} from '../src/index.mjs';

const D = '\x1b[2m', R = '\x1b[0m', B = '\x1b[1m';
const GR = '\x1b[32m', RD = '\x1b[31m', YL = '\x1b[33m', CY = '\x1b[36m';

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}

function loadJson(filepath) {
  if (!existsSync(filepath)) { console.error(`${RD}File not found: ${filepath}${R}`); process.exit(1); }
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

// ── Commands ──────────────────────────────────────────────────────────────────

switch (cmd) {
  case 'init': {
    const dir = ensureSeipDir();
    console.log(`${GR}✓${R} Initialised ${B}.seip/declarations/${R}`);
    console.log(`${D}  Add .seip/ to version control so declarations travel with your schema.${R}`);
    console.log(`${D}  Next: seip diff schema-v1.json schema-v2.json${R}`);
    break;
  }

  case 'diff': {
    const [, beforeFile, afterFile] = args;
    if (!beforeFile || !afterFile) { console.error('Usage: seip diff <before.json> <after.json>'); process.exit(1); }
    const before = loadJson(beforeFile);
    const after = loadJson(afterFile);
    const result = diffSchemas(before, after);

    console.log(`\n${B}Schema diff: ${beforeFile} → ${afterFile}${R}\n`);
    if (result.affected.length === 0) {
      console.log(`${GR}✓ No changes detected.${R}`);
      break;
    }
    for (const a of result.affected) {
      const icon = a.change_type === 'rename' ? '✏️ ' : a.change_type === 'add' ? '➕' : a.change_type === 'remove' ? '❌' : '🔄';
      const severity = ['remove', 'rename', 'retype'].includes(a.change_type) ? `${RD}BREAKING${R}` : `${GR}safe${R}`;
      console.log(`  ${icon} ${a.object}.${B}${a.property}${R}: ${a.change_type} [${severity}]`);
      if (a.before?.name) console.log(`     ${D}was: ${a.before.name} (${a.before.type})${R}`);
      if (a.after?.name) console.log(`     ${D}now: ${a.after.name} (${a.after.type})${R}`);
    }
    console.log(`\n  ${result.breaking ? `${RD}⚠ Breaking changes detected. Run: seip create` : `${GR}✓ Non-breaking changes only`}${R}\n`);
    break;
  }

  case 'create': {
    const id = flag('id');
    const summary = flag('summary') || 'Schema change';
    const type = flag('type') || 'restructure';
    const breaking = args.includes('--breaking');
    const strategy = flag('strategy');
    const producer = flag('producer') || 'unknown';
    const reviewDays = parseInt(flag('review-days') || '7', 10);
    const deprecateDays = parseInt(flag('deprecate-days') || '30', 10);
    const removeDays = parseInt(flag('remove-days') || '60', 10);

    // Parse consumers: --consumer team1 --consumer team2
    const consumers = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--consumer' && args[i + 1]) {
        consumers.push({ team: args[i + 1] });
      }
    }

    const now = new Date();
    const scd = createDeclaration({
      id, summary, changeType: type, breaking, affectedObjects: [],
      migrationStrategy: strategy, producerTeam: producer,
      reviewDeadline: new Date(now.getTime() + reviewDays * 86400000).toISOString(),
      deprecationDate: new Date(now.getTime() + deprecateDays * 86400000).toISOString(),
      removalDate: new Date(now.getTime() + removeDays * 86400000).toISOString(),
      consumers
    });

    const filepath = saveDeclaration(scd);
    console.log(`\n${GR}✓${R} Declaration created: ${B}${scd.declaration_id}${R}`);
    console.log(`  ${D}File: ${filepath}${R}`);
    console.log(`  ${D}Status: ${scd.status}${R}`);
    console.log(`  ${D}Edit the JSON to add affected_objects, migration SQL, etc.${R}`);
    console.log(`  ${D}Then: seip propose ${scd.declaration_id}${R}\n`);
    break;
  }

  case 'propose': {
    const id = args[1];
    if (!id) { console.error('Usage: seip propose <declaration-id>'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    propose(scd);
    saveDeclaration(scd);
    console.log(`\n${GR}✓${R} Declaration ${B}${id}${R} proposed.`);
    console.log(`  ${D}Status: PROPOSED${R}`);
    console.log(`  ${D}Consumers: ${scd.consumers.map(c => c.team).join(', ') || 'none registered'}${R}`);
    console.log(`  ${D}Review deadline: ${scd.timeline.review_deadline.substring(0, 10)}${R}\n`);
    break;
  }

  case 'respond': {
    const id = args[1];
    const team = flag('team');
    const status = flag('status') || 'ACKNOWLEDGED';
    const message = flag('message') || '';
    const effort = flag('effort');
    if (!id || !team) { console.error('Usage: seip respond <id> --team <name> --status ACKNOWLEDGED|OBJECTED|EXTENSION_REQUESTED --message "..."'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    respond(scd, { team, status, message, estimatedEffort: effort });
    saveDeclaration(scd);
    const color = status === 'ACKNOWLEDGED' ? GR : status === 'OBJECTED' ? RD : YL;
    console.log(`\n${color}${status === 'ACKNOWLEDGED' ? '✓' : status === 'OBJECTED' ? '✗' : '⚠'}${R} ${team}: ${color}${status}${R}`);
    console.log(`  ${D}Declaration status: ${scd.status}${R}`);
    for (const c of scd.consumers) {
      const cc = c.status === 'ACKNOWLEDGED' ? GR : c.status === 'OBJECTED' ? RD : c.status === 'PENDING' ? D : YL;
      console.log(`  ${cc}● ${c.team}: ${c.status}${R}`);
    }
    console.log();
    break;
  }

  case 'status': {
    const id = args[1];
    if (id) {
      const scd = loadDeclaration(id);
      if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
      const sc = { DRAFT: D, PROPOSED: CY, UNDER_REVIEW: YL, ACCEPTED: GR, ENFORCING: '\x1b[35m', COMPLETED: GR, WITHDRAWN: D, REJECTED: RD };
      console.log(`\n${B}${scd.change.summary}${R}`);
      console.log(`  ${D}ID:${R}         ${scd.declaration_id}`);
      console.log(`  ${D}Status:${R}     ${sc[scd.status] || ''}${scd.status}${R}`);
      console.log(`  ${D}Breaking:${R}   ${scd.change.breaking ? `${RD}yes${R}` : `${GR}no${R}`}`);
      console.log(`  ${D}Producer:${R}   ${scd.producer.team}`);
      console.log(`  ${D}Strategy:${R}   ${scd.migration?.strategy || 'none'}`);
      console.log(`  ${D}Review by:${R}  ${scd.timeline.review_deadline.substring(0, 10)}`);
      console.log(`  ${D}Deprecate:${R}  ${scd.timeline.deprecation_date.substring(0, 10)}`);
      console.log(`  ${D}Remove:${R}     ${scd.timeline.removal_date.substring(0, 10)}`);
      if (scd.consumers.length > 0) {
        console.log(`\n  ${B}Consumers${R}`);
        for (const c of scd.consumers) {
          const cc = c.status === 'ACKNOWLEDGED' ? GR : c.status === 'OBJECTED' ? RD : c.status === 'PENDING' ? D : YL;
          console.log(`  ${cc}● ${c.team.padEnd(20)} ${c.status}${R}`);
        }
      }
      if (scd.responses.length > 0) {
        console.log(`\n  ${B}Responses${R}`);
        for (const r of scd.responses) {
          const rc = r.status === 'ACKNOWLEDGED' ? GR : r.status === 'OBJECTED' ? RD : YL;
          console.log(`  ${rc}${r.status.padEnd(14)}${R} ${r.team.padEnd(18)} ${D}${(r.message || '').substring(0, 50)}${R}`);
        }
      }
      console.log();
    } else {
      const all = listDeclarations();
      if (all.length === 0) {
        console.log(`\n${D}No declarations found. Run: seip init${R}\n`);
        break;
      }
      console.log(`\n${B}Schema Change Declarations${R}\n`);
      for (const scd of all) {
        const sc = { DRAFT: D, PROPOSED: CY, UNDER_REVIEW: YL, ACCEPTED: GR, ENFORCING: '\x1b[35m', COMPLETED: GR, WITHDRAWN: D };
        const breaking = scd.change.breaking ? `${RD}breaking${R}` : `${GR}safe${R}`;
        const pending = scd.consumers.filter(c => c.status === 'PENDING').length;
        const pendingStr = pending > 0 ? ` ${YL}(${pending} pending)${R}` : '';
        console.log(`  ${sc[scd.status] || ''}${scd.status.padEnd(14)}${R} ${scd.declaration_id.padEnd(35)} [${breaking}]${pendingStr}`);
        console.log(`  ${D}${' '.repeat(14)} ${scd.change.summary}${R}`);
      }
      console.log();
    }
    break;
  }

  case 'validate': {
    const [, beforeFile, afterFile] = args;
    if (!beforeFile || !afterFile) { console.error('Usage: seip validate <before.json> <after.json>'); process.exit(1); }
    const before = loadJson(beforeFile);
    const after = loadJson(afterFile);
    const diff = diffSchemas(before, after);
    const declarations = listDeclarations();
    const result = validate(diff, declarations);

    console.log(`\n${B}SEIP Validation${R}\n`);

    if (result.errors.length > 0) {
      for (const e of result.errors) console.log(`  ${RD}✗ ${e}${R}`);
    }
    for (const w of result.warnings) console.log(`  ${YL}⚠ ${w}${R}`);

    if (result.valid) {
      console.log(`  ${GR}✓ All breaking changes have declarations. Build passed.${R}`);
    } else {
      console.log(`\n  ${RD}✗ Build FAILED: ${result.errors.length} undeclared breaking change(s).${R}`);
      console.log(`  ${D}Create declarations with: seip create --breaking --summary "..."${R}`);
    }
    console.log();
    process.exit(result.valid ? 0 : 1);
  }

  default:
    console.log(`
${B}seip${R} — Schema Evolution Intent Protocol

${B}Commands:${R}
  ${CY}seip init${R}                          Set up .seip/ in your repo
  ${CY}seip diff${R} <before> <after>          Compare two schema files
  ${CY}seip create${R} [options]               Create a declaration
  ${CY}seip propose${R} <id>                   Propose to consumers
  ${CY}seip respond${R} <id> --team <t>        Respond to a declaration
  ${CY}seip status${R} [id]                    Show declarations
  ${CY}seip validate${R} <before> <after>      CI gate (exit 1 if undeclared)

${B}Create options:${R}
  --id <id>            Declaration ID
  --summary "..."      One-line description
  --type rename        Change type (add/remove/rename/retype/deprecate)
  --breaking           Mark as breaking
  --strategy dual_write   Migration strategy
  --producer <team>    Producer team name
  --consumer <team>    Consumer team (repeatable)
  --review-days <n>    Days until review deadline (default: 7)
  --deprecate-days <n> Days until deprecation (default: 30)
  --remove-days <n>    Days until removal (default: 60)

${B}Respond options:${R}
  --team <name>        Your team name
  --status <s>         ACKNOWLEDGED | OBJECTED | EXTENSION_REQUESTED
  --message "..."      Your response message
  --effort "..."       Estimated migration effort

${B}Quick start:${R}
  ${D}seip init
  seip diff schema-v1.json schema-v2.json
  seip create --id scd_rename_org --summary "Rename org field" --breaking --strategy dual_write --consumer analytics --consumer search
  seip propose scd_rename_org
  seip respond scd_rename_org --team analytics --status ACKNOWLEDGED --message "Can fix in 2 days"
  seip validate schema-v1.json schema-v2.json${R}
`);
}
