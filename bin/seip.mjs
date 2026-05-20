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
 *   seip lint                         Validate declaration JSON files
 *   seip notify <id>                  Emit GitHub/Slack notification payloads
 *   seip log <id>                     Show audit history
 *   seip config                       Show effective config
 *   seip enforce <id>                 Mark declaration as ENFORCING
 *   seip close <id>                   Close declaration (COMPLETED/WITHDRAWN/REJECTED)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import {
  diffSchemas, createDeclaration, propose, respond, enforce, complete, withdraw, reject,
  saveDeclaration, loadDeclaration, listDeclarations,
  ensureSeipDir, validate, validateDeclaration,
  getConfig, saveConfig, defaultConfig, getConfigPath,
  isBreakingChange
} from '../src/index.mjs';
import { runNotificationAdapter } from '../src/notify.js';

const D = '\x1b[2m', R = '\x1b[0m', B = '\x1b[1m';
const GR = '\x1b[32m', RD = '\x1b[31m', YL = '\x1b[33m', CY = '\x1b[36m';

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1) return args[i + 1];
  const prefix = `--${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  if (!match) return undefined;
  return match.slice(prefix.length);
}

function hasFlag(name) {
  const prefix = `--${name}=`;
  return args.includes(`--${name}`) || args.some(arg => arg.startsWith(prefix));
}

function outputJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function parseRename(value) {
  const [left, right] = value.split(':');
  if (!left || !right) throw new Error('Rename must be in format object.from:object.to');
  const leftDot = left.lastIndexOf('.');
  if (leftDot === -1) throw new Error('Rename must include object and field: object.from:object.to');
  const object = left.slice(0, leftDot);
  const from = left.slice(leftDot + 1);
  let to = right;
  if (right.includes('.')) {
    const rightDot = right.lastIndexOf('.');
    const rightObject = right.slice(0, rightDot);
    if (rightObject !== object) throw new Error('Rename must stay within the same object');
    to = right.slice(rightDot + 1);
  }
  if (!object || !from || !to) throw new Error('Rename must include object, from, and to');
  return { object, from, to };
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
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      saveConfig(defaultConfig());
      console.log(`${D}  Created default config: ${configPath}${R}`);
    }
    console.log(`${D}  Next: seip diff schema-v1.json schema-v2.json${R}`);
    break;
  }

  case 'diff': {
    const [, beforeFile, afterFile] = args;
    if (!beforeFile || !afterFile) { console.error('Usage: seip diff <before.json> <after.json>'); process.exit(1); }
    const before = loadJson(beforeFile);
    const after = loadJson(afterFile);
    const config = getConfig();
    const strict = hasFlag('strict') || config.policy.strict_required_additions;
    const result = diffSchemas(before, after, { strict });

    if (hasFlag('json')) {
      outputJson({
        before: beforeFile,
        after: afterFile,
        strict,
        ...result
      });
      break;
    }

    console.log(`\n${B}Schema diff: ${beforeFile} → ${afterFile}${R}\n`);
    if (result.affected.length === 0) {
      console.log(`${GR}✓ No changes detected.${R}`);
      break;
    }
    for (const a of result.affected) {
      const icon = a.change_type === 'rename' ? '✏️ ' : a.change_type.startsWith('add') ? '➕' : a.change_type === 'remove' ? '❌' : '🔄';
      const isBreaking = isBreakingChange(a);
      const severity = isBreaking ? `${RD}BREAKING${R}` : `${GR}safe${R}`;
      const label = a.change_type === 'add_required'
        ? 'add (required)'
        : a.change_type === 'make_required'
          ? 'requiredness tightened'
        : a.change_type === 'make_non_nullable'
          ? 'nullability tightened'
        : a.change_type === 'enum_narrow'
          ? 'enum narrowed'
        : a.change_type === 'enum_widen'
          ? 'enum widened'
        : a.change_type === 'format_change'
          ? 'format changed'
        : a.change_type === 'retype' && a.lossy === true
          ? 'retype (lossy)'
          : a.change_type;
      console.log(`  ${icon} ${a.object}.${B}${a.property}${R}: ${label} [${severity}]`);
      if (a.before?.name) console.log(`     ${D}was: ${a.before.name} (${a.before.type})${R}`);
      if (a.after?.name) console.log(`     ${D}now: ${a.after.name} (${a.after.type})${R}`);
    }
    console.log(`\n  ${result.breaking ? `${RD}⚠ Breaking changes detected. Run: seip create` : `${GR}✓ Non-breaking changes only`}${R}\n`);
    break;
  }

  case 'create': {
    const config = getConfig();
    const id = flag('id');
    const summary = flag('summary') || 'Schema change';
    const type = flag('type') || 'restructure';
    const strategy = flag('strategy');
    const producer = flag('producer') || config.defaults.producer || 'unknown';
    const reviewDays = parseInt(flag('review-days') || String(config.defaults.review_days || 7), 10);
    const deprecateDays = parseInt(flag('deprecate-days') || String(config.defaults.deprecate_days || 30), 10);
    const removeDays = parseInt(flag('remove-days') || String(config.defaults.remove_days || 60), 10);
    const strict = hasFlag('strict') || config.policy.strict_required_additions;

    let breaking = hasFlag('breaking');
    let affectedObjects = [];
    const renames = [];
    const fromDiffIdx = args.indexOf('--from-diff');
    if (fromDiffIdx !== -1) {
      const beforeFile = args[fromDiffIdx + 1];
      const afterFile = args[fromDiffIdx + 2];
      if (!beforeFile || !afterFile) {
        console.error('Usage: seip create --from-diff <before.json> <after.json> [options]');
        process.exit(1);
      }
      const before = loadJson(beforeFile);
      const after = loadJson(afterFile);
      const diff = diffSchemas(before, after, { strict });
      affectedObjects = diff.affected.map(a => ({
        object: a.object,
        property: a.property,
        change_type: a.change_type,
        lossy: !!a.lossy,
        before_type: a.before?.type || null,
        after_type: a.after?.type || null
      }));
      if (!hasFlag('breaking')) breaking = diff.breaking;
    }

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--rename' && args[i + 1]) {
        try {
          renames.push(parseRename(args[i + 1]));
        } catch (e) {
          console.error(`${RD}${e.message}${R}`);
          process.exit(1);
        }
      }
    }
    for (const r of renames) {
      if (!affectedObjects.some(a => a.object === r.object && a.property === r.from)) {
        affectedObjects.push({ object: r.object, property: r.from });
      }
    }

    if (breaking && !strategy) {
      console.error(`${RD}Breaking changes require a migration strategy. Pass: --strategy dual_write (or similar).${R}`);
      process.exit(1);
    }

    // Parse consumers: --consumer team1 --consumer team2
    const consumers = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--consumer' && args[i + 1]) {
        consumers.push({ team: args[i + 1] });
      }
    }

    const now = new Date();
    const scd = createDeclaration({
      id, summary, changeType: type, breaking, affectedObjects, renames,
      migrationStrategy: strategy, producerTeam: producer,
      reviewDeadline: new Date(now.getTime() + reviewDays * 86400000).toISOString(),
      deprecationDate: new Date(now.getTime() + deprecateDays * 86400000).toISOString(),
      removalDate: new Date(now.getTime() + removeDays * 86400000).toISOString(),
      consumers
    });

    const filepath = saveDeclaration(scd);
    if (hasFlag('json')) {
      outputJson({
        declaration_id: scd.declaration_id,
        filepath,
        status: scd.status,
        breaking: scd.change.breaking,
        affected_objects: scd.change.affected_objects,
        renames: scd.change.renames
      });
      break;
    }
    console.log(`\n${GR}✓${R} Declaration created: ${B}${scd.declaration_id}${R}`);
    console.log(`  ${D}File: ${filepath}${R}`);
    console.log(`  ${D}Status: ${scd.status}${R}`);
    if (affectedObjects.length === 0) {
      console.log(`  ${D}Edit the JSON to add affected_objects, migration SQL, etc.${R}`);
    } else {
      console.log(`  ${D}Affected objects prefilled from diff (${affectedObjects.length}).${R}`);
    }
    if (renames.length > 0) {
      console.log(`  ${D}Renames captured: ${renames.length}.${R}`);
    }
    console.log(`  ${D}Then: seip propose ${scd.declaration_id}${R}\n`);
    break;
  }

  case 'propose': {
    const id = args[1];
    if (!id) { console.error('Usage: seip propose <declaration-id>'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    const actor = flag('actor');
    propose(scd, actor);
    saveDeclaration(scd);
    if (hasFlag('json')) {
      outputJson(scd);
      break;
    }
    console.log(`\n${GR}✓${R} Declaration ${B}${id}${R} proposed.`);
    console.log(`  ${D}Status: PROPOSED${R}`);
    console.log(`  ${D}Consumers: ${scd.consumers.map(c => c.team).join(', ') || 'none registered'}${R}`);
    console.log(`  ${D}Review deadline: ${scd.timeline.review_deadline.substring(0, 10)}${R}\n`);
    break;
  }

  case 'enforce': {
    const id = args[1];
    if (!id) { console.error('Usage: seip enforce <declaration-id>'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    const actor = flag('actor');
    enforce(scd, actor);
    saveDeclaration(scd);
    if (hasFlag('json')) {
      outputJson(scd);
      break;
    }
    console.log(`\n${GR}✓${R} Declaration ${B}${id}${R} is now ENFORCING.`);
    console.log(`  ${D}Status: ENFORCING${R}\n`);
    break;
  }

  case 'close': {
    const id = args[1];
    if (!id) { console.error('Usage: seip close <declaration-id> --status COMPLETED|WITHDRAWN|REJECTED [--reason "..."]'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    const status = (flag('status') || 'COMPLETED').toUpperCase();
    const reason = flag('reason') || '';
    const actor = flag('actor');

    if (status === 'COMPLETED') {
      complete(scd, actor);
    } else if (status === 'WITHDRAWN') {
      if (!reason) { console.error(`${RD}WITHDRAWN requires --reason.${R}`); process.exit(1); }
      withdraw(scd, reason, actor);
    } else if (status === 'REJECTED') {
      if (!reason) { console.error(`${RD}REJECTED requires --reason.${R}`); process.exit(1); }
      reject(scd, reason, actor);
    } else {
      console.error(`${RD}Invalid status: ${status}${R}`);
      process.exit(1);
    }

    saveDeclaration(scd);
    if (hasFlag('json')) {
      outputJson(scd);
      break;
    }
    console.log(`\n${GR}✓${R} Declaration ${B}${id}${R} closed.`);
    console.log(`  ${D}Status: ${scd.status}${R}\n`);
    break;
  }

  case 'respond': {
    const id = args[1];
    const team = flag('team');
    const status = (flag('status') || 'ACKNOWLEDGED').toUpperCase();
    const message = flag('message') || '';
    const effort = flag('effort');
    if (!id || !team) { console.error('Usage: seip respond <id> --team <name> --status ACKNOWLEDGED|OBJECTED|EXTENSION_REQUESTED --message "..."'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    try {
      respond(scd, { team, status, message, estimatedEffort: effort });
    } catch (error) {
      console.error(`${RD}${error.message}${R}`);
      process.exit(1);
    }
    saveDeclaration(scd);
    if (hasFlag('json')) {
      outputJson(scd);
      break;
    }
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
      if (hasFlag('json')) {
        outputJson(scd);
        break;
      }
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
        if (hasFlag('json')) {
          outputJson([]);
          break;
        }
        console.log(`\n${D}No declarations found. Run: seip init${R}\n`);
        break;
      }
      if (hasFlag('json')) {
        outputJson(all);
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

  case 'log': {
    const id = args[1];
    if (!id) { console.error('Usage: seip log <declaration-id>'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    const events = Array.isArray(scd.events) ? scd.events.slice() : [];
    if (events.length === 0) {
      if (hasFlag('json')) {
        outputJson([]);
        break;
      }
      console.log(`\n${D}No events recorded for ${id}.${R}\n`);
      break;
    }
    events.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    if (hasFlag('json')) {
      outputJson(events);
      break;
    }
    console.log(`\n${B}Audit Log: ${id}${R}\n`);
    for (const e of events) {
      const actor = e.actor ? ` by ${e.actor}` : '';
      const message = e.message ? ` — ${e.message}` : '';
      const fromTo = e.from_status || e.to_status ? ` (${e.from_status || '-'} → ${e.to_status || '-'})` : '';
      console.log(`  ${D}${e.at}${R} ${B}${e.type}${R}${fromTo}${actor}${message}`);
    }
    console.log();
    break;
  }

  case 'config': {
    const configPath = getConfigPath();
    if (hasFlag('init')) {
      if (existsSync(configPath)) {
        if (!hasFlag('json')) console.log(`${D}Config already exists: ${configPath}${R}`);
      } else {
        saveConfig(defaultConfig());
        if (!hasFlag('json')) console.log(`${GR}✓${R} Created config: ${configPath}`);
      }
    }
    const config = getConfig();
    if (hasFlag('json')) {
      outputJson(config);
      break;
    }
    console.log(`\n${B}SEIP Config${R}\n`);
    console.log(JSON.stringify(config, null, 2));
    console.log(`\n${D}Path: ${configPath}${R}\n`);
    break;
  }

  case 'validate': {
    const [, beforeFile, afterFile] = args;
    if (!beforeFile || !afterFile) { console.error('Usage: seip validate <before.json> <after.json>'); process.exit(1); }
    const before = loadJson(beforeFile);
    const after = loadJson(afterFile);
    const config = getConfig();
    const strict = hasFlag('strict') || config.policy.strict_required_additions;
    const diff = diffSchemas(before, after, { strict });
    const declarations = listDeclarations();
    const result = validate(diff, declarations, {
      min_status: config.policy.min_status,
      required_consumers: config.policy.required_consumers
    });

    if (hasFlag('json')) {
      outputJson({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        diff
      });
      process.exit(result.valid ? 0 : 1);
    }

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

  case 'validate-consumer': {
    const id = args[1];
    const against = flag('against');
    const command = flag('command');
    const team = flag('team');
    const record = hasFlag('record');
    if (!id || !against) { console.error('Usage: seip validate-consumer <id> --against <dir>'); process.exit(1); }
    const scd = loadDeclaration(id);
    if (!scd) { console.error(`${RD}Declaration not found: ${id}${R}`); process.exit(1); }
    if (record && !team) {
      console.error(`${RD}Recording validation evidence requires --team <consumer-team>.${R}`);
      process.exit(1);
    }

    if (!existsSync(against)) {
      console.error(`${RD}Consumer validation path not found: ${against}${R}`);
      process.exit(1);
    }

    const absoluteAgainst = resolve(against);
    const declarationPath = resolve('.seip', 'declarations', `${id}.json`);
    const targetKind = statSync(against).isDirectory() ? 'directory' : 'file';

    if (hasFlag('json') && !command) {
      outputJson({
        valid: true,
        declaration_id: id,
        against: absoluteAgainst,
        target_kind: targetKind,
        command: null
      });
      break;
    }

    if (!hasFlag('json')) {
      console.log(`\n${CY}Validating consumer ${targetKind} ${absoluteAgainst} against ${id}...${R}`);
    }

    if (command) {
      try {
        const output = execSync(command, {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            SEIP_DECLARATION_ID: id,
            SEIP_DECLARATION_PATH: declarationPath,
            SEIP_CONSUMER_PATH: absoluteAgainst
          },
          stdio: ['ignore', 'pipe', 'pipe']
        });
        const commandOutput = output.trim();
        if (record) {
          scd.events.push({
            type: 'CONSUMER_VALIDATED',
            at: new Date().toISOString(),
            actor: team,
            message: `Consumer validation passed for ${team}`,
            validation: {
              status: 'PASSED',
              team,
              target: absoluteAgainst,
              target_kind: targetKind,
              command,
              command_output: commandOutput
            }
          });
          saveDeclaration(scd);
        }
        if (hasFlag('json')) {
          outputJson({
            valid: true,
            recorded: record,
            declaration_id: id,
            against: absoluteAgainst,
            target_kind: targetKind,
            command,
            output: commandOutput
          });
          break;
        }
        if (commandOutput) console.log(commandOutput);
        console.log(`${GR}✓ Consumer validation command passed.${R}\n`);
      } catch (error) {
        if (record) {
          scd.events.push({
            type: 'CONSUMER_VALIDATED',
            at: new Date().toISOString(),
            actor: team,
            message: `Consumer validation failed for ${team}`,
            validation: {
              status: 'FAILED',
              team,
              target: absoluteAgainst,
              target_kind: targetKind,
              command,
              command_output: (error.stdout || '').trim(),
              command_error: (error.stderr || '').trim(),
              exit_status: error.status || 1
            }
          });
          saveDeclaration(scd);
        }
        if (hasFlag('json')) {
          outputJson({
            valid: false,
            recorded: record,
            declaration_id: id,
            against: absoluteAgainst,
            target_kind: targetKind,
            command,
            stdout: (error.stdout || '').trim(),
            stderr: (error.stderr || '').trim(),
            status: error.status
          });
        } else {
          if (error.stdout) console.log(error.stdout);
          if (error.stderr) console.error(error.stderr);
          console.error(`${RD}Consumer validation command failed with exit ${error.status ?? 1}.${R}`);
        }
        process.exit(error.status || 1);
      }
      break;
    }

    console.log(`${GR}✓ Consumer validation target exists.${R}`);
    console.log(`${D}  Add --command "..." to run local parser, query, dbt, contract, or model checks.${R}\n`);
    break;
  }

  case 'lint': {
    const all = listDeclarations();
    const jsonOutput = hasFlag('json');
    if (all.length === 0) {
      if (jsonOutput) {
        outputJson([]);
        break;
      }
      console.log(`\n${B}SEIP Lint${R}\n`);
      console.log(`${D}No declarations found. Run: seip init${R}\n`);
      break;
    }

    let errorCount = 0;
    let warningCount = 0;
    const report = [];
    if (!jsonOutput) console.log(`\n${B}SEIP Lint${R}\n`);

    for (const scd of all) {
      const result = validateDeclaration(scd);
      report.push({
        declaration_id: scd.declaration_id,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings
      });
      if (result.errors.length === 0 && result.warnings.length === 0) continue;

      if (!jsonOutput) console.log(`${B}${scd.declaration_id}${R}`);
      for (const e of result.errors) {
        errorCount += 1;
        if (!jsonOutput) console.log(`  ${RD}✗ ${e}${R}`);
      }
      for (const w of result.warnings) {
        warningCount += 1;
        if (!jsonOutput) console.log(`  ${YL}⚠ ${w}${R}`);
      }
      if (!jsonOutput) console.log();
    }

    if (jsonOutput) {
      outputJson(report);
      process.exit(errorCount === 0 ? 0 : 1);
    }

    if (errorCount === 0) {
      console.log(`${GR}✓ No lint errors.${R}`);
      if (warningCount > 0) console.log(`${YL}⚠ ${warningCount} warning(s).${R}`);
    } else {
      console.log(`${RD}✗ ${errorCount} error(s), ${warningCount} warning(s).${R}`);
    }
    console.log();
    process.exit(errorCount === 0 ? 0 : 1);
  }

  case 'notify': {
    const id = args[1];
    const adapter = flag('adapter') || 'github';
    const repoUrl = flag('repo-url');
    const webhook = flag('webhook');
    const dryRun = hasFlag('dry-run');
    if (!id) {
      console.error('Usage: seip notify <id> --adapter github|slack [--repo-url <url>] [--webhook <url>] [--dry-run]');
      process.exit(1);
    }
    try {
      const result = await runNotificationAdapter(id, {
        adapter,
        repoUrl,
        webhook,
        dryRun
      });
      if (hasFlag('json')) {
        outputJson(result);
        break;
      }
      if (result.adapter === 'github') {
        console.log(result.payload);
      } else {
        const mode = result.delivered ? 'sent' : 'dry-run';
        console.log(`${GR}✓${R} Slack notification ${mode}: ${result.target}`);
      }
    } catch (err) {
      console.error(`${RD}${err.message}${R}`);
      process.exit(1);
    }
    break;
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
  ${CY}seip log${R} <id>                       Show audit history
  ${CY}seip validate${R} <before> <after>      CI gate (exit 1 if undeclared)
  ${CY}seip lint${R}                          Validate declaration JSON files
  ${CY}seip notify${R} <id>                    Emit GitHub/Slack notification payloads
  ${CY}seip config${R}                         Show effective config
  ${CY}seip enforce${R} <id>                   Mark declaration as ENFORCING
  ${CY}seip close${R} <id>                     Close declaration (COMPLETED/WITHDRAWN/REJECTED)

${B}Create options:${R}
  --id <id>            Declaration ID
  --summary "..."      One-line description
  --type rename        Change type (add/remove/rename/retype/deprecate)
  --breaking           Mark as breaking
  --strategy dual_write   Migration strategy
  --producer <team>    Producer team name
  --consumer <team>    Consumer team (repeatable)
  --from-diff <before> <after>  Prefill affected_objects from a diff
  --rename <obj.old:obj.new>  Add explicit rename mapping (repeatable)
  --review-days <n>    Days until review deadline (default: 7)
  --deprecate-days <n> Days until deprecation (default: 30)
  --remove-days <n>    Days until removal (default: 60)

${B}Diff/validate options:${R}
  --strict             Treat required additions as breaking
  --json               Emit machine-readable JSON output

${B}Notify options:${R}
  --adapter <name>     github | slack (default: github)
  --repo-url <url>     Repository URL for declaration links
  --webhook <url>      Slack webhook URL
  --dry-run            Build payload without sending network requests

${B}Respond options:${R}
  --team <name>        Your team name
  --status <s>         ACKNOWLEDGED | OBJECTED | EXTENSION_REQUESTED
  --message "..."      Your response message
  --effort "..."       Estimated migration effort

${B}Propose options:${R}
  --actor <name>       Actor name for audit log

${B}Enforce/Close options:${R}
  --actor <name>       Actor name for audit log
  --status <s>         Close status: COMPLETED | WITHDRAWN | REJECTED
  --reason "..."       Required for WITHDRAWN/REJECTED

${B}Quick start:${R}
  ${D}seip init
  seip diff schema-v1.json schema-v2.json
  seip create --id seip_rename_institution --summary "Rename institution field" --breaking --strategy dual_write --consumer analytics --consumer risk
  seip propose seip_rename_institution
  seip respond seip_rename_institution --team analytics --status ACKNOWLEDGED --message "Can fix in 2 days"
  seip validate schema-v1.json schema-v2.json${R}
`);
}
