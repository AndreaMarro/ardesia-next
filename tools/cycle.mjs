import {readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const REPOSITORY = 'AndreaMarro/ardesia-next';
const MINUTE = 60_000;
const actors = new Set(['pro', 'codex']);
const dispositions = new Set(['READY', 'BLOCKED', 'WAITING_CI', 'READY_FOR_REVIEW', 'COMPLETE_INCREMENT', 'INTERRUPTED', 'IDLE']);
const outcomes = new Set(['HANDOFF', 'BLOCKED', 'WAITING_CI', 'READY_FOR_REVIEW', 'COMPLETE_INCREMENT', 'INTERRUPTED']);
const protectedBranches = new Set(['main', 'master', 'preview/m3', 'staging', 'production', 'ops/dual-run-state']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value.trim() === value;
const id = value => text(value) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fields = {
  root: ['schemaVersion', 'kind', 'repository', 'acceptanceEvidence', 'revision', 'updatedAt', 'procedureRef', 'activeRun', 'packet', 'lastRun'],
  packet: ['id', 'taskId', 'nextActor', 'disposition', 'kind', 'notBefore', 'expiresAt', 'source', 'goal', 'allowedPaths', 'exitCriteria', 'evidence', 'blockers', 'nextAction'],
  source: ['baseSha', 'headSha', 'branch', 'pr', 'sourceDigest'],
  evidence: ['kind', 'name', 'reference', 'headSha', 'sourceDigest', 'result', 'scope', 'access', 'artifactDigest'],
  activeRun: ['runId', 'actor', 'startedAt', 'claimedAt', 'writeUntil', 'closeBy'],
  lastRun: ['runId', 'actor', 'packetId', 'startedAt', 'claimedAt', 'writeUntil', 'closeBy', 'finishedAt', 'outcome', 'late', 'summary']
};

function timestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === `${year}-${month}-${day}` && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60
    && (offsetHour === undefined || Number(offsetHour) < 24 && Number(offsetMinute) < 60);
}

function repoPath(value) {
  if (!text(value) || isAbsolute(value) || /[\\\x00-\x1f\x7f:*?\[\]{}#%]/.test(value)) return false;
  const normalized = value.replace(/\/$/, '');
  return normalized.length > 0 && normalized.split('/').every(part => part !== '' && part !== '.' && part !== '..' && part !== '.git');
}
const contains = (parent, child) => child.replace(/\/$/, '') === parent.replace(/\/$/, '') || child.startsWith(`${parent.replace(/\/$/, '')}/`);
function https(value) {
  if (!text(value) || /\s/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}
function branch(value) {
  return text(value) && !['@', 'HEAD'].includes(value) && !value.startsWith('refs/') && !value.startsWith('-')
    && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.includes('..') && !value.includes('@{')
    && value.split('/').every(part => part !== '' && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'));
}
const expires = packet => packet.expiresAt === null ? Infinity : Date.parse(packet.expiresAt);
const sameEvidenceSource = (item, packet) => item.headSha === packet.source.headSha && digest(packet.source.sourceDigest)
  && item.sourceDigest === packet.source.sourceDigest;
const hasEvidence = (packet, kind, result, name) => packet.evidence.some(item => record(item) && item.kind === kind && item.result === result
  && (name === undefined || item.name === name) && sameEvidenceSource(item, packet));

/** Structural checks only: no URL authentication, live refs, task eligibility or product acceptance. */
export function validateCycle(data) {
  const errors = [];
  const fail = (path, reason) => errors.push(`${path}: ${reason}`);
  const shape = (value, kind, path) => {
    if (!record(value)) { fail(path, 'must be an object'); return false; }
    for (const key of fields[kind]) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'is required');
    for (const key of Object.keys(value)) if (!fields[kind].includes(key)) fail(`${path}.${key}`, 'is not supported');
    return true;
  };
  const check = (value, predicate, path, reason) => { if (!predicate(value)) fail(path, reason); };
  const time = (value, path) => check(value, timestamp, path, 'must be a valid ISO timestamp with timezone');
  const list = (value, path, predicate, minimum = 0) => {
    if (!Array.isArray(value)) { fail(path, 'must be an array'); return []; }
    if (value.length < minimum) fail(path, `must contain at least ${minimum} entry`);
    value.forEach((entry, index) => check(entry, predicate, `${path}[${index}]`, 'is invalid'));
    return value;
  };
  const run = (value, kind, path) => {
    if (!shape(value, kind, path)) return false;
    check(value.runId, id, `${path}.runId`, 'must be an identifier');
    check(value.actor, item => actors.has(item), `${path}.actor`, 'must be pro or codex');
    for (const key of ['startedAt', 'claimedAt', 'writeUntil', 'closeBy']) time(value[key], `${path}.${key}`);
    if ([value.startedAt, value.claimedAt, value.writeUntil, value.closeBy].every(timestamp)) {
      const start = Date.parse(value.startedAt), claim = Date.parse(value.claimedAt), write = Date.parse(value.writeUntil), close = Date.parse(value.closeBy);
      if (!(start <= claim && claim < write && close - write >= 10 * MINUTE && write - start <= 45 * MINUTE && close - start <= 55 * MINUTE)) {
        fail(path, 'must claim after the actual start, retain positive work and ten minutes of closure, and close within 55 minutes of the start');
      }
    }
    return true;
  };
  if (!shape(data, 'root', 'state')) return errors;
  if (data.schemaVersion !== '1.0.0') fail('schemaVersion', 'unsupported version');
  if (data.kind !== 'ardesia-dual-run-state') fail('kind', 'unsupported kind');
  if (data.repository !== REPOSITORY) fail('repository', 'must identify the canonical repository');
  if (data.acceptanceEvidence !== false) fail('acceptanceEvidence', 'must remain false');
  check(data.revision, integer, 'revision', 'must be a nonnegative safe integer');
  check(data.procedureRef, sha, 'procedureRef', 'must be a full commit SHA');
  time(data.updatedAt, 'updatedAt');
  const packet = data.packet;
  if (shape(packet, 'packet', 'packet')) {
    for (const key of ['id', 'taskId']) check(packet[key], id, `packet.${key}`, 'must be an identifier');
    check(packet.nextActor, value => actors.has(value), 'packet.nextActor', 'must be pro or codex');
    check(packet.disposition, value => dispositions.has(value), 'packet.disposition', 'unsupported disposition');
    check(packet.kind, value => ['implementation', 'review', 'coordination'].includes(value), 'packet.kind', 'unsupported kind');
    time(packet.notBefore, 'packet.notBefore');
    if (packet.expiresAt === null) {
      if (packet.kind !== 'coordination' || packet.nextActor !== 'pro') fail('packet.expiresAt', 'null is reserved for Pro coordination');
    } else {
      time(packet.expiresAt, 'packet.expiresAt');
      if (timestamp(packet.notBefore) && timestamp(packet.expiresAt) && Date.parse(packet.expiresAt) <= Date.parse(packet.notBefore)) fail('packet.expiresAt', 'must follow notBefore');
    }
    for (const key of ['goal', 'nextAction']) check(packet[key], text, `packet.${key}`, 'must be nonempty text');
    list(packet.exitCriteria, 'packet.exitCriteria', text, 1);
    const paths = list(packet.allowedPaths, 'packet.allowedPaths', repoPath, packet.kind === 'implementation' ? 1 : 0);
    if (packet.kind !== 'implementation' && paths.length) fail('packet.allowedPaths', 'only implementation tickets permit source writes');
    paths.forEach((path, index) => { if (repoPath(path) && paths.slice(0, index).some(previous => repoPath(previous) && (contains(previous, path) || contains(path, previous)))) fail('packet.allowedPaths', 'overlapping prefixes'); });
    const blockers = list(packet.blockers, 'packet.blockers', id);
    if (packet.disposition === 'BLOCKED' && !blockers.length) fail('packet.blockers', 'BLOCKED requires a blocker');
    if (['READY', 'READY_FOR_REVIEW', 'COMPLETE_INCREMENT'].includes(packet.disposition) && blockers.length) fail('packet.blockers', `${packet.disposition} requires no blockers`);
    if (packet.nextActor === 'codex' && (packet.kind === 'coordination' || !['READY', 'READY_FOR_REVIEW'].includes(packet.disposition))) fail('packet.nextActor', 'Codex requires assigned READY implementation/review or READY_FOR_REVIEW');
    if (packet.disposition === 'READY_FOR_REVIEW' && packet.kind !== 'review') fail('packet.kind', 'READY_FOR_REVIEW requires review');
    if (packet.disposition === 'IDLE' && packet.kind !== 'coordination') fail('packet.kind', 'IDLE permits coordination only');
    const sourceValid = shape(packet.source, 'source', 'packet.source');
    if (sourceValid) {
      for (const key of ['baseSha', 'headSha']) check(packet.source[key], sha, `packet.source.${key}`, 'must be a full commit SHA');
      check(packet.source.branch, branch, 'packet.source.branch', 'must be a valid branch name');
      if ((packet.kind === 'implementation' || packet.nextActor === 'codex') && protectedBranches.has(packet.source.branch)) fail('packet.source.branch', 'must be an isolated branch for implementation or Codex');
      if (packet.source.pr !== null) check(packet.source.pr, https, 'packet.source.pr', 'must be an HTTPS reference without credentials, or null');
      if (packet.source.sourceDigest !== null) check(packet.source.sourceDigest, digest, 'packet.source.sourceDigest', 'must be a SHA-256 digest, or null');
    }
    const evidence = list(packet.evidence, 'packet.evidence', record);
    evidence.forEach((item, index) => {
      const path = `packet.evidence[${index}]`;
      if (!shape(item, 'evidence', path)) return;
      check(item.kind, value => ['ci', 'check', 'review', 'observation'].includes(value), `${path}.kind`, 'unsupported kind');
      for (const key of ['name', 'scope']) check(item[key], text, `${path}.${key}`, 'must be nonempty text');
      check(item.reference, value => https(value) || repoPath(value), `${path}.reference`, 'must be an HTTPS reference without credentials or repository path');
      check(item.headSha, sha, `${path}.headSha`, 'must be a full commit SHA');
      if (item.sourceDigest !== null) check(item.sourceDigest, digest, `${path}.sourceDigest`, 'must be a SHA-256 digest, or null');
      check(item.result, value => ['PASS', 'FAIL', 'PENDING', 'NOT_RUN'].includes(value), `${path}.result`, 'unsupported result');
      check(item.access, value => ['artifact', 'metadata'].includes(value), `${path}.access`, 'must identify artifact or metadata access');
      if (item.artifactDigest !== null) check(item.artifactDigest, digest, `${path}.artifactDigest`, 'must be a SHA-256 digest, or null');
    });
    if (sourceValid && Array.isArray(packet.evidence)) {
      if (['READY_FOR_REVIEW', 'COMPLETE_INCREMENT'].includes(packet.disposition) && !hasEvidence(packet, 'ci', 'PASS', 'verify')) fail('packet.evidence', 'requires verify PASS on the exact head and sourceDigest');
      if (packet.disposition === 'COMPLETE_INCREMENT' && !hasEvidence(packet, 'review', 'PASS')) fail('packet.evidence', 'COMPLETE_INCREMENT requires a review reference on the exact source; this does not authenticate reviewer independence');
      if (packet.disposition === 'WAITING_CI' && !hasEvidence(packet, 'ci', 'PENDING', 'verify')) fail('packet.evidence', 'WAITING_CI requires pending verify on the exact head and sourceDigest');
      if (['READY_FOR_REVIEW', 'COMPLETE_INCREMENT'].includes(packet.disposition) && evidence.some(item => record(item) && sameEvidenceSource(item, packet) && ['FAIL', 'PENDING'].includes(item.result))) fail('packet.evidence', 'unresolved failing or pending evidence cannot be ready or complete');
    }
  }
  if (data.activeRun !== null && run(data.activeRun, 'activeRun', 'activeRun')) {
    const active = data.activeRun;
    if (record(packet)) {
      const reconciliationOnly = active.actor === 'pro' && timestamp(packet.expiresAt) && Date.parse(active.claimedAt) >= expires(packet);
      if (active.actor !== packet.nextActor && !reconciliationOnly) fail('activeRun.actor', 'must match the ticket actor except Pro reconciliation of an expired ticket');
      if (timestamp(packet.notBefore) && Date.parse(active.claimedAt) < Date.parse(packet.notBefore)) fail('activeRun.claimedAt', 'precedes the ticket window');
      if (!reconciliationOnly && timestamp(packet.expiresAt) && Date.parse(active.closeBy) > expires(packet)) fail('activeRun.closeBy', 'exceeds the ticket window');
    }
    if (timestamp(data.updatedAt) && Date.parse(active.claimedAt) > Date.parse(data.updatedAt)) fail('updatedAt', 'precedes the active claim');
  }
  if (data.lastRun !== null && run(data.lastRun, 'lastRun', 'lastRun')) {
    const last = data.lastRun;
    check(last.packetId, id, 'lastRun.packetId', 'must be an identifier');
    check(last.outcome, value => outcomes.has(value), 'lastRun.outcome', 'unsupported outcome');
    check(last.summary, text, 'lastRun.summary', 'must be nonempty text');
    time(last.finishedAt, 'lastRun.finishedAt');
    if (timestamp(last.finishedAt) && timestamp(last.claimedAt) && Date.parse(last.finishedAt) < Date.parse(last.claimedAt)) fail('lastRun.finishedAt', 'precedes the claim');
    if (typeof last.late !== 'boolean' || last.late !== (Date.parse(last.finishedAt) > Date.parse(last.closeBy))) fail('lastRun.late', 'must describe the actual deadline overrun');
    if (timestamp(data.updatedAt) && Date.parse(last.finishedAt) > Date.parse(data.updatedAt)) fail('updatedAt', 'precedes lastRun completion');
    if (record(data.activeRun) && Date.parse(data.activeRun.startedAt) < Date.parse(last.finishedAt)) fail('activeRun.startedAt', 'precedes lastRun completion');
  }
  return errors;
}

function valid(data) { const errors = validateCycle(data); if (errors.length) throw new Error(errors.join('\n')); }
function clock(data, now) {
  const moment = now instanceof Date ? now.getTime() : timestamp(now) ? Date.parse(now) : NaN;
  if (!Number.isFinite(moment)) throw new Error('Clock must be a valid Date or ISO timestamp.');
  if (moment < Date.parse(data.updatedAt)) throw new Error('Clock precedes updatedAt; reconcile clock or state before acting.');
  return moment;
}
function revision(data, expected) {
  if (!integer(expected) || expected !== data.revision) throw new Error('Expected revision is required and must equal the current revision.');
  if (!Number.isSafeInteger(data.revision + 1)) throw new Error('Revision cannot be incremented safely.');
}
function owner(data, {runId, actor}) {
  if (!data.activeRun || data.activeRun.runId !== runId || data.activeRun.actor !== actor) throw new Error('Run ID and actor must match the active owner.');
}

export function cycleBrief(data, {now = new Date()} = {}) {
  valid(data); const moment = clock(data, now), active = data.activeRun;
  return {kind: 'ardesia-dual-run-brief', acceptanceEvidence: false, revision: data.revision, procedureRef: data.procedureRef,
    packet: structuredClone(data.packet), activeRun: active === null ? null : {...active,
      reconciliationOnly: active.actor === 'pro' && Date.parse(active.claimedAt) >= expires(data.packet),
      workExpired: moment >= Date.parse(active.writeUntil), closeExpired: moment > Date.parse(active.closeBy), takeoverAuthorized: false},
    ticketExpired: moment >= expires(data.packet), lastRun: structuredClone(data.lastRun)};
}

export function claimCycle(data, {expectedRevision, runId, actor, startedAt}, {now = new Date()} = {}) {
  valid(data); revision(data, expectedRevision); const moment = clock(data, now);
  if (data.activeRun !== null) throw new Error('An active claim already exists; expiry never authorizes takeover.');
  if (!id(runId) || !actors.has(actor)) throw new Error('A valid run ID and actor are required.');
  if (data.lastRun?.runId === runId) throw new Error('A completed run ID cannot be reused.');
  if (!timestamp(startedAt)) throw new Error('startedAt must identify the actual run start with a valid ISO timestamp.');
  const start = Date.parse(startedAt);
  if (start > moment) throw new Error('startedAt cannot be in the future.');
  if (data.lastRun && start < Date.parse(data.lastRun.finishedAt)) throw new Error('startedAt precedes lastRun completion.');
  const expired = moment >= expires(data.packet), reconciliationOnly = actor === 'pro' && expired;
  if (data.packet.nextActor !== actor && !reconciliationOnly) throw new Error('Ticket is assigned to a different actor.');
  if (moment < Date.parse(data.packet.notBefore)) throw new Error('Ticket is not active yet.');
  if (expired && !reconciliationOnly) throw new Error('Ticket has expired; Pro must reconcile it before new work.');
  if (actor === 'codex' && (data.packet.kind === 'coordination' || !['READY', 'READY_FOR_REVIEW'].includes(data.packet.disposition)
    || protectedBranches.has(data.packet.source.branch))) throw new Error('Codex requires an active isolated implementation/review ticket.');
  const deadline = reconciliationOnly ? Infinity : expires(data.packet);
  const close = Math.min(start + 55 * MINUTE, deadline);
  const write = Math.min(start + 45 * MINUTE, deadline - 10 * MINUTE);
  if (write <= moment) throw new Error('Ticket window has insufficient time for work and ten minutes of closure.');
  const next = structuredClone(data);
  next.activeRun = {runId, actor, startedAt: new Date(start).toISOString(), claimedAt: new Date(moment).toISOString(), writeUntil: new Date(write).toISOString(), closeBy: new Date(close).toISOString()};
  next.revision += 1; next.updatedAt = new Date(moment).toISOString(); valid(next); return next;
}

/** A budget is a local precondition, not a reservation, watchdog or cross-service lock. */
export function cycleBudget(data, {runId, actor, seconds}, {now = new Date()} = {}) {
  valid(data); owner(data, {runId, actor}); const moment = clock(data, now);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error('Requested seconds must be a positive safe integer.');
  if (moment >= expires(data.packet)) throw new Error('Expired ticket permits Pro reconciliation only, never product work.');
  const remaining = Math.floor((Date.parse(data.activeRun.writeUntil) - moment) / 1000);
  if (seconds > remaining) throw new Error('Requested work does not fit before writeUntil.');
  return {kind: 'ardesia-cycle-budget', acceptanceEvidence: false, runId, actor, requestedSeconds: seconds,
    remainingSeconds: remaining, writeUntil: data.activeRun.writeUntil, closeBy: data.activeRun.closeBy};
}

export function finishCycle(data, {expectedRevision, runId, actor, outcome, packet, summary}, {now = new Date()} = {}) {
  valid(data); revision(data, expectedRevision); owner(data, {runId, actor}); const moment = clock(data, now);
  if (!outcomes.has(outcome) || !text(summary) || !record(packet)) throw new Error('A supported outcome, complete next packet and summary are required.');
  if (['HANDOFF', 'COMPLETE_INCREMENT'].includes(outcome) && actor !== 'pro') throw new Error('Only Pro can hand off new work or complete an increment.');
  const nextActor = outcome === 'HANDOFF' ? 'codex' : outcome === 'READY_FOR_REVIEW' ? actor === 'pro' ? 'codex' : 'pro' : 'pro';
  if (packet.nextActor !== nextActor || packet.disposition !== (outcome === 'HANDOFF' ? 'READY' : outcome)) throw new Error('Next packet actor/disposition must match the outcome.');
  if (nextActor === 'codex' && (!timestamp(packet.notBefore) || !timestamp(packet.expiresAt)
    || expires(packet) - Math.max(moment, Date.parse(packet.notBefore)) <= 10 * MINUTE)) throw new Error('Codex successor window must retain more than ten useful minutes after now or its future start.');
  if (outcome !== 'HANDOFF') {
    if (packet.id !== data.packet.id || packet.taskId !== data.packet.taskId || packet.goal !== data.packet.goal
      || JSON.stringify(packet.exitCriteria) !== JSON.stringify(data.packet.exitCriteria)
      || packet.source?.baseSha !== data.packet.source.baseSha || packet.source?.branch !== data.packet.source.branch) throw new Error('Finishing cannot silently change the assignment, branch or exit criteria.');
    if (!Array.isArray(packet.allowedPaths) || packet.allowedPaths.some(path => !repoPath(path) || !data.packet.allowedPaths.some(parent => contains(parent, path)))) throw new Error('Finishing cannot expand the assigned source scope.');
    if (data.packet.kind === 'review' && ['headSha', 'sourceDigest', 'pr'].some(key => packet.source?.[key] !== data.packet.source[key])) throw new Error('Finishing review must preserve the reviewed source identity, including head, digest and PR.');
  }
  const next = structuredClone(data);
  next.packet = structuredClone(packet); next.activeRun = null;
  next.lastRun = {...data.activeRun, packetId: data.packet.id, finishedAt: new Date(moment).toISOString(), outcome,
    late: moment > Date.parse(data.activeRun.closeBy), summary};
  next.revision += 1; next.updatedAt = new Date(moment).toISOString(); valid(next); return next;
}

const usage = 'Usage: node tools/cycle.mjs validate|brief STATE; claim STATE --revision N --actor pro|codex --run ID --started-at ISO; budget STATE --actor ROLE --run ID --seconds N; finish STATE --revision N --actor ROLE --run ID --outcome OUTCOME --packet PACKET --summary TEXT';
/** Reads local JSON and emits JSON to stdout. It never writes files, contacts GitHub or selects a clock. */
export function runCycleCli(args, {readText = path => readFileSync(path, 'utf8')} = {}) {
  try {
    if (!Array.isArray(args) || args.length < 2 || !['validate', 'brief', 'claim', 'budget', 'finish'].includes(args[0]) || !text(args[1]) || args[1].startsWith('--')) throw new Error(usage);
    const [command, file, ...flags] = args;
    const required = {validate: [], brief: [], claim: ['revision', 'actor', 'run', 'started-at'], budget: ['actor', 'run', 'seconds'], finish: ['revision', 'actor', 'run', 'outcome', 'packet', 'summary']}[command];
    const options = {};
    if (flags.length % 2) throw new Error(usage);
    for (let index = 0; index < flags.length; index += 2) {
      const key = flags[index].slice(2), value = flags[index + 1];
      if (!flags[index].startsWith('--') || !required.includes(key) || Object.hasOwn(options, key) || !text(value)) throw new Error(usage);
      options[key] = value;
    }
    if (required.some(key => !Object.hasOwn(options, key))) throw new Error(usage);
    for (const key of ['revision', 'seconds']) if (Object.hasOwn(options, key) && (!/^(0|[1-9][0-9]*)$/.test(options[key]) || !Number.isSafeInteger(Number(options[key])))) throw new Error(`${key} must be a safe unsigned integer.`);
    const data = JSON.parse(readText(file));
    const input = {expectedRevision: Number(options.revision), runId: options.run, actor: options.actor};
    let result;
    if (command === 'validate') { valid(data); result = {kind: 'ardesia-cycle-validation', acceptanceEvidence: false, revision: data.revision, valid: true}; }
    else if (command === 'brief') result = cycleBrief(data);
    else if (command === 'claim') result = claimCycle(data, {...input, startedAt: options['started-at']});
    else if (command === 'budget') result = cycleBudget(data, {...input, seconds: Number(options.seconds)});
    else result = finishCycle(data, {...input, outcome: options.outcome, packet: JSON.parse(readText(options.packet)), summary: options.summary});
    return {exitCode: 0, stdout: JSON.stringify(result, null, 2), stderr: ''};
  } catch (error) { return {exitCode: 1, stdout: '', stderr: error instanceof SyntaxError ? 'Input contains invalid JSON.' : error.message}; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runCycleCli(process.argv.slice(2));
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = result.exitCode;
}
