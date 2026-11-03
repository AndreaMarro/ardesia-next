import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {validateCoordination} from './check-operations.mjs';

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
const sequential = data => data?.schemaVersion === '2.0.0';
const coordinator = data => sequential(data) ? 'codex' : 'pro';
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
    const supported = kind === 'packet' && sequential(data) ? [...fields.packet, 'review'] : fields[kind];
    for (const key of supported) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'is required');
    for (const key of Object.keys(value)) if (!supported.includes(key)) fail(`${path}.${key}`, 'is not supported');
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
  if (!['1.0.0', '2.0.0'].includes(data.schemaVersion)) fail('schemaVersion', 'unsupported version');
  if (data.kind !== (sequential(data) ? 'ardesia-sequential-state' : 'ardesia-dual-run-state')) fail('kind', 'unsupported kind');
  if (data.repository !== REPOSITORY) fail('repository', 'must identify the canonical repository');
  if (data.acceptanceEvidence !== false) fail('acceptanceEvidence', 'must remain false');
  check(data.revision, integer, 'revision', 'must be a nonnegative safe integer');
  check(data.procedureRef, sha, 'procedureRef', 'must be a full commit SHA');
  time(data.updatedAt, 'updatedAt');
  const packet = data.packet;
  if (shape(packet, 'packet', 'packet')) {
    for (const key of ['id', 'taskId']) check(packet[key], id, `packet.${key}`, 'must be an identifier');
    check(packet.nextActor, value => sequential(data) ? value === 'codex' : actors.has(value), 'packet.nextActor', 'must match the adopted execution mode');
    check(packet.disposition, value => dispositions.has(value), 'packet.disposition', 'unsupported disposition');
    check(packet.kind, value => ['implementation', 'review', 'coordination'].includes(value), 'packet.kind', 'unsupported kind');
    time(packet.notBefore, 'packet.notBefore');
    if (packet.expiresAt === null) {
      if (packet.kind !== 'coordination' || packet.nextActor !== coordinator(data)) fail('packet.expiresAt', 'null is reserved for coordination');
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
    if (!sequential(data) && packet.nextActor === 'codex' && (packet.kind === 'coordination' || !['READY', 'READY_FOR_REVIEW'].includes(packet.disposition))) fail('packet.nextActor', 'Codex requires assigned READY implementation/review or READY_FOR_REVIEW');
    if (packet.disposition === 'READY_FOR_REVIEW' && packet.kind !== 'review') fail('packet.kind', 'READY_FOR_REVIEW requires review');
    if (packet.disposition === 'IDLE' && packet.kind !== 'coordination') fail('packet.kind', 'IDLE permits coordination only');
    const sourceValid = shape(packet.source, 'source', 'packet.source');
    if (sourceValid) {
      for (const key of ['baseSha', 'headSha']) check(packet.source[key], sha, `packet.source.${key}`, 'must be a full commit SHA');
      check(packet.source.branch, branch, 'packet.source.branch', 'must be a valid branch name');
      if ((packet.kind === 'implementation' || !sequential(data) && packet.nextActor === 'codex') && protectedBranches.has(packet.source.branch)) fail('packet.source.branch', 'must be an isolated branch for implementation or Codex');
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
  if (sequential(data) && record(packet)) {
    const review = packet.review;
    if (review !== null) {
      const keys = ['authorContextId', 'reviewerContextId', 'sourceSha', 'reference'];
      if (!record(review) || keys.some(key => !Object.hasOwn(review, key)) || Object.keys(review).some(key => !keys.includes(key))) fail('packet.review', 'must be a complete review receipt or null');
      else {
        if (!id(review.authorContextId) || !id(review.reviewerContextId) || review.authorContextId === review.reviewerContextId) fail('packet.review', 'requires distinct author and reviewer contexts');
        if (review.sourceSha !== packet.source?.headSha || !https(review.reference)) fail('packet.review', 'must identify the exact reviewed source and reference');
      }
    }
    if (packet.disposition === 'COMPLETE_INCREMENT' && (!record(review) || !Array.isArray(packet.evidence)
      || !packet.evidence.some(item => record(item) && item.kind === 'review' && item.result === 'PASS'
        && item.reference === review.reference && sameEvidenceSource(item, packet)))) fail('packet.review', 'completion requires a matching review receipt; independence must still be observed');
    if (record(data.activeRun) && data.activeRun.actor !== 'codex') fail('activeRun.actor', 'sequential mode has one Codex coordinator');
  }
  if (data.activeRun !== null && run(data.activeRun, 'activeRun', 'activeRun')) {
    const active = data.activeRun;
    if (record(packet)) {
      const reconciliationOnly = active.actor === coordinator(data) && timestamp(packet.expiresAt) && Date.parse(active.claimedAt) >= expires(packet);
      if (active.actor !== packet.nextActor && !reconciliationOnly) fail('activeRun.actor', 'must match the ticket actor except coordinator reconciliation of an expired ticket');
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
    if (record(data.activeRun) && Date.parse(sequential(data) ? data.activeRun.claimedAt : data.activeRun.startedAt) < Date.parse(last.finishedAt)) fail('activeRun', 'claim precedes lastRun completion');
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
  return {kind: sequential(data) ? 'ardesia-sequential-brief' : 'ardesia-dual-run-brief', acceptanceEvidence: false, revision: data.revision, procedureRef: data.procedureRef,
    packet: structuredClone(data.packet), activeRun: active === null ? null : {...active,
      reconciliationOnly: active.actor === coordinator(data) && Date.parse(active.claimedAt) >= expires(data.packet),
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
  if (data.lastRun && (sequential(data) ? moment : start) < Date.parse(data.lastRun.finishedAt)) throw new Error('Claim precedes lastRun completion.');
  const expired = moment >= expires(data.packet), reconciliationOnly = actor === coordinator(data) && expired;
  if (data.packet.nextActor !== actor && !reconciliationOnly) throw new Error('Ticket is assigned to a different actor.');
  if (moment < Date.parse(data.packet.notBefore)) throw new Error('Ticket is not active yet.');
  if (expired && !reconciliationOnly) throw new Error('Ticket has expired; The coordinator must reconcile it before new work.');
  if (!sequential(data) && actor === 'codex' && (data.packet.kind === 'coordination' || !['READY', 'READY_FOR_REVIEW'].includes(data.packet.disposition)
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
  if (moment >= expires(data.packet)) throw new Error('Expired ticket permits coordinator reconciliation only, never product work.');
  const remaining = Math.floor((Date.parse(data.activeRun.writeUntil) - moment) / 1000);
  if (seconds > remaining) throw new Error('Requested work does not fit before writeUntil.');
  return {kind: 'ardesia-cycle-budget', acceptanceEvidence: false, runId, actor, requestedSeconds: seconds,
    remainingSeconds: remaining, writeUntil: data.activeRun.writeUntil, closeBy: data.activeRun.closeBy};
}

export function finishCycle(data, {expectedRevision, runId, actor, outcome, packet, summary, queue, retainClaim = false}, {now = new Date(), readQueue = gitQueue} = {}) {
  valid(data); revision(data, expectedRevision); owner(data, {runId, actor}); const moment = clock(data, now);
  if (!outcomes.has(outcome) || !text(summary) || !record(packet)) throw new Error('A supported outcome, complete next packet and summary are required.');
  if (typeof retainClaim !== 'boolean' || retainClaim && (!sequential(data) || outcome !== 'COMPLETE_INCREMENT'
    || moment >= Date.parse(data.activeRun.writeUntil))) throw new Error('Retaining a claim requires sequential exact-source completion before writeUntil.');
  if (['HANDOFF', 'COMPLETE_INCREMENT'].includes(outcome) && actor !== coordinator(data)) throw new Error(`Only ${sequential(data) ? 'the coordinator' : 'Pro'} can hand off new work or complete an increment.`);
  if (sequential(data) && outcome === 'HANDOFF' && (data.packet.disposition === 'WAITING_CI' || data.packet.kind !== 'coordination'
    && !['COMPLETE_INCREMENT', 'BLOCKED', 'INTERRUPTED'].includes(data.packet.disposition))) throw new Error('Resolve or preserve the current assignment before selecting its successor.');
  const nextActor = sequential(data) ? 'codex' : outcome === 'HANDOFF'
    ? packet.kind === 'coordination' && packet.nextActor === 'pro' ? 'pro' : 'codex'
    : outcome === 'READY_FOR_REVIEW' ? actor === 'pro' ? 'codex' : 'pro' : 'pro';
  if (packet.nextActor !== nextActor || packet.disposition !== (outcome === 'HANDOFF' ? 'READY' : outcome)) throw new Error('Next packet actor/disposition must match the outcome.');
  if (sequential(data) && outcome === 'HANDOFF') eligiblePacket(data, packet, queue, readQueue);
  if (nextActor === 'codex' && (!sequential(data) || outcome === 'HANDOFF') && !(sequential(data) && packet.kind === 'coordination' && packet.expiresAt === null) && (!timestamp(packet.notBefore) || !timestamp(packet.expiresAt)
    || expires(packet) - Math.max(moment, Date.parse(packet.notBefore)) <= 10 * MINUTE)) throw new Error('Codex successor window must retain more than ten useful minutes after now or its future start.');
  if (outcome !== 'HANDOFF') {
    if (packet.id !== data.packet.id || packet.taskId !== data.packet.taskId || packet.goal !== data.packet.goal
      || JSON.stringify(packet.exitCriteria) !== JSON.stringify(data.packet.exitCriteria)
      || packet.source?.baseSha !== data.packet.source.baseSha || packet.source?.branch !== data.packet.source.branch) throw new Error('Finishing cannot silently change the assignment, branch or exit criteria.');
    if (!Array.isArray(packet.allowedPaths) || packet.allowedPaths.some(path => !repoPath(path) || !data.packet.allowedPaths.some(parent => contains(parent, path)))) throw new Error('Finishing cannot expand the assigned source scope.');
    if (data.packet.kind === 'review' && ['headSha', 'sourceDigest', 'pr'].some(key => packet.source?.[key] !== data.packet.source[key])) throw new Error('Finishing review must preserve the reviewed source identity, including head, digest and PR.');
  }
  const next = structuredClone(data);
  next.packet = structuredClone(packet);
  if (!retainClaim) {
    next.activeRun = null;
    next.lastRun = {...data.activeRun, packetId: data.packet.id, finishedAt: new Date(moment).toISOString(), outcome,
      late: moment > Date.parse(data.activeRun.closeBy), summary};
  }
  next.revision += 1; next.updatedAt = new Date(moment).toISOString(); valid(next); return next;
}

/** Explicit interrupted-checkpoint reconstruction. Receipt assertions are not authenticated here.
 * The coordinator must observe the native terminal turn, stopped writers and preserved work,
 * then publish against the observed parent SHA. Expiry is deliberately insufficient. */
export function recoverCycle(data, {expectedRevision, runId, actor, terminal, packet, summary, queue}, {now = new Date(), readQueue = gitQueue} = {}) {
  valid(data); revision(data, expectedRevision); owner(data, {runId, actor});
  const moment = clock(data, now);
  if (!sequential(data) || actor !== 'codex' || !['READY', 'INTERRUPTED'].includes(data.packet.disposition)) throw new Error('Recovery requires the same sequential interrupted assignment; preserve pending CI separately.');
  if (!record(terminal) || terminal.kind !== 'ardesia-native-terminal-recovery' || terminal.runId !== runId
    || !id(terminal.threadId) || !['failed', 'interrupted'].includes(terminal.status)
    || !timestamp(terminal.completedAt) || !timestamp(terminal.observedAt)
    || Date.parse(terminal.completedAt) < Date.parse(data.activeRun.claimedAt)
    || Date.parse(terminal.observedAt) < Date.parse(terminal.completedAt) || Date.parse(terminal.observedAt) > moment
    || terminal.writersStopped !== true || !digest(terminal.preservationDigest) || !text(terminal.reference)) {
    throw new Error('Recovery requires an observed matching terminal failure, stopped writers and preserved-work receipt; expiry is not evidence.');
  }
  const comparable = value => Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !['disposition', 'nextAction'].includes(key)));
  if (!isDeepStrictEqual(comparable(packet), comparable(data.packet)) || packet?.disposition !== 'READY') throw new Error('Recovery must preserve the complete assignment, source and evidence.');
  eligiblePacket(data, packet, queue, readQueue);
  const receiptDigest = createHash('sha256').update(JSON.stringify(terminal)).digest('hex');
  const outcome = expires(packet) - moment > 10 * MINUTE ? 'HANDOFF' : 'INTERRUPTED';
  const interrupted = structuredClone(data); interrupted.packet.disposition = 'INTERRUPTED';
  return finishCycle(interrupted, {expectedRevision, runId, actor, outcome, packet: {...packet, disposition: outcome === 'HANDOFF' ? 'READY' : 'INTERRUPTED'},
    summary: `${summary} Terminal receipt SHA-256 ${receiptDigest}; preserved-work SHA-256 ${terminal.preservationDigest}.`, queue}, {now, readQueue});
}


/** Explicit format migration only. Caller must reconcile live writers and publish with expected SHA. */
export function migrateCycle(data, {expectedRevision, procedureRef, packet}, {now = new Date()} = {}) {
  valid(data); revision(data, expectedRevision); const moment = clock(data, now);
  if (sequential(data)) throw new Error('Sequential migration has already been applied.');
  if (data.activeRun !== null) throw new Error('Migration refuses an active run, even if expired.');
  if (!sha(procedureRef) || !record(packet) || packet.nextActor !== 'codex' || packet.kind !== 'coordination'
    || packet.disposition !== 'READY' || packet.review !== null) throw new Error('Migration requires an explicit procedure revision and a READY Codex coordination packet.');
  const next = structuredClone(data);
  next.schemaVersion = '2.0.0'; next.kind = 'ardesia-sequential-state'; next.procedureRef = procedureRef;
  next.packet = structuredClone(packet); next.revision += 1; next.updatedAt = new Date(moment).toISOString();
  valid(next); return next;
}

// Immutable, local Git reads only. The caller still observes live refs, evidence and CAS publication.
const gitJson = (ref, path) => JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
const gitQueue = ref => gitJson(ref, 'operations/coordination.json');
const gitCompletion = ref => gitJson(ref, 'handoff.json');
const procedureBaseline = ref => path => execFileSync('git', ['show', `${ref}:${path}`],
  {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
function canonicalQueue(data, queue, readQueue) {
  const errors = validateCoordination(queue, {readBaseline: procedureBaseline(data.procedureRef)});
  if (errors.length) throw new Error(`Canonical queue is invalid:\n${errors.join('\n')}`);
  if (!isDeepStrictEqual(queue, readQueue(data.procedureRef))) throw new Error('Queue must match operations/coordination.json at the adopted immutable procedureRef; hypothetical queues are not authority.');
}
function eligiblePacket(data, packet, queue, readQueue) {
  canonicalQueue(data, queue, readQueue);
  const candidates = queue.tasks.filter(task => task.id === packet.taskId);
  if (candidates.length !== 1) throw new Error('Assignment must identify exactly one canonical task.');
  const task = candidates[0];
  if (!Array.isArray(task.scope) || !Array.isArray(task.dependsOn) || !Array.isArray(task.blockers)) throw new Error('Task contract is incomplete.');
  if (!Array.isArray(packet.exitCriteria) || task.exitCriteria.some(criterion => !packet.exitCriteria.includes(criterion))) throw new Error('Assignment must preserve every canonical exit criterion.');
  if (!['queued', 'in_progress', 'ready_for_review', 'blocked'].includes(task.status)) throw new Error('Deferred or done work cannot be selected.');
  if (packet.kind === 'implementation') {
    if (!['queued', 'in_progress'].includes(task.status)) throw new Error('Implementation requires an eligible queued or active task.');
    if (queue.tasks.some(other => other.id !== task.id && other.status === 'in_progress')) throw new Error('Only one active increment may be implemented.');
    if (task.dependsOn.some(dependency => queue.tasks.find(item => item.id === dependency)?.status !== 'done')) throw new Error('Implementation has an incomplete dependency.');
    if (task.blockers.some(blocker => queue.blockers.find(item => item.id === blocker)?.status !== 'resolved')) throw new Error('Implementation has an unresolved blocker.');
    if (!Array.isArray(packet.allowedPaths) || packet.allowedPaths.some(path => !repoPath(path) || !task.scope.some(scope => repoPath(scope) && contains(scope, path)))) throw new Error('Assignment exceeds the canonical scope.');
  }
  if (queue.claims.some(claim => claim?.taskId === task.id || Array.isArray(claim?.paths) && Array.isArray(packet.allowedPaths)
    && claim.paths.some(path => packet.allowedPaths.some(scope => repoPath(path) && repoPath(scope) && (contains(path, scope) || contains(scope, path)))))) throw new Error('Assignment conflicts with a queue claim.');
}

/** Select within the existing claim. Does not change the queue, clock, ownership or authorization. */
export function assignCycle(data, {expectedRevision, runId, actor, packet, queue}, {now = new Date(), readQueue = gitQueue} = {}) {
  valid(data); revision(data, expectedRevision); owner(data, {runId, actor}); const moment = clock(data, now);
  if (!sequential(data) || actor !== 'codex' || data.packet.disposition === 'WAITING_CI'
    || data.packet.kind !== 'coordination' && data.packet.disposition !== 'COMPLETE_INCREMENT') throw new Error('Only sequential coordination or a completed assignment may select work; pending CI must be preserved.');
  if (moment >= Date.parse(data.activeRun.writeUntil)) throw new Error('Selection cannot renew an expired work budget.');
  if (!record(packet) || packet.nextActor !== 'codex' || packet.disposition !== 'READY') throw new Error('Selection requires a READY Codex packet.');
  eligiblePacket(data, packet, queue, readQueue);
  if (!timestamp(packet.notBefore) || Date.parse(packet.notBefore) > moment || expires(packet) < Date.parse(data.activeRun.closeBy)) throw new Error('Assignment window must preserve the existing run deadline.');
  const next = structuredClone(data); next.packet = structuredClone(packet); next.revision += 1; next.updatedAt = new Date(moment).toISOString();
  valid(next); return next;
}

/** Emit the one completed row under the existing OPS-004 authority; never write files or expand a task scope. */
export function reconcileCycle(data, {expectedRevision, runId, actor, queue, completionRef, releaseRef, nextAction}, {now = new Date(), readQueue = gitQueue, readCompletion = gitCompletion} = {}) {
  valid(data); revision(data, expectedRevision); owner(data, {runId, actor}); const moment = clock(data, now);
  if (!sequential(data) || actor !== 'codex' || data.packet.taskId !== 'OPS-004' || data.packet.kind !== 'implementation'
    || !['operations/coordination.json', 'docs/history.md'].every(path => data.packet.allowedPaths.some(scope => contains(scope, path)))) throw new Error('Canonical reconciliation requires an explicitly assigned OPS-004 metadata scope.');
  if (moment >= Date.parse(data.activeRun.writeUntil) || moment >= expires(data.packet)) throw new Error('Canonical reconciliation cannot renew an expired work budget.');
  if (!sha(completionRef) || !text(nextAction)) throw new Error('An immutable completion cursor ref and next action are required.');
  eligiblePacket(data, data.packet, queue, readQueue);
  const completed = readCompletion(completionRef); valid(completed);
  if (!sequential(completed) || completed.packet.disposition !== 'COMPLETE_INCREMENT' || completed.revision >= data.revision
    || Date.parse(completed.updatedAt) > Date.parse(data.updatedAt)) throw new Error('Reconciliation requires an earlier immutable completion receipt.');
  const receiptRun = completed.activeRun ?? completed.lastRun;
  if (!receiptRun || !completed.activeRun && (receiptRun.outcome !== 'COMPLETE_INCREMENT' || receiptRun.packetId !== completed.packet.id)) throw new Error('Completion must retain its original run identity.');
  if (receiptRun.runId === data.activeRun.runId) {
    if (!completed.activeRun || !isDeepStrictEqual(completed.activeRun, data.activeRun)
      || !isDeepStrictEqual(completed.lastRun, data.lastRun)) throw new Error('Retained completion must preserve the same claim and budget.');
  } else {
    // A prior claim must have a durable release. Time passing alone never authorizes takeover.
    let released = completed.activeRun === null ? completed : data;
    if (releaseRef !== undefined) {
      if (!sha(releaseRef)) throw new Error('Release ref must be an immutable cursor SHA.');
      released = readCompletion(releaseRef); valid(released);
      if (!sequential(released) || released.activeRun !== null || released.revision >= data.revision) throw new Error('Release receipt must precede the current claim.');
    }
    const last = released.lastRun, keys = ['runId', 'actor', 'startedAt', 'claimedAt', 'writeUntil', 'closeBy'];
    if (!last || keys.some(key => last[key] !== receiptRun[key]) || released.revision < completed.revision
      || Date.parse(last.finishedAt) < Date.parse(completed.updatedAt)
      || Date.parse(last.finishedAt) > Date.parse(data.activeRun.claimedAt)) throw new Error('Prior completion requires a matching released run before the current claim; expiry is not release.');
  }
  // Task authority comes from the adopted procedure, never a historical queue embedded in runtime source.
  const receiptQueue = readQueue(completed.procedureRef); canonicalQueue(completed, receiptQueue, readQueue);
  const original = receiptQueue.tasks.find(task => task.id === completed.packet.taskId);
  const task = queue.tasks.find(task => task.id === completed.packet.taskId);
  const contract = value => Object.fromEntries(['id', 'owner', 'scope', 'dependsOn', 'blockers', 'exitCriteria'].map(key => [key, value?.[key]]));
  if (!task || !original || task.id === 'OPS-004' || !['queued', 'in_progress', 'ready_for_review', 'done'].includes(task.status)
    || !isDeepStrictEqual(contract(task), contract(original))
    || task.exitCriteria.some(criterion => !completed.packet.exitCriteria.includes(criterion))) throw new Error('Completion must match the unchanged canonical task contract, never the recurring OPS-004 row.');
  if (queue.claims.some(claim => claim.taskId === task.id)) throw new Error('A canonical task claim must be reconciled explicitly, never removed by completion.');
  if (task.dependsOn.some(id => queue.tasks.find(item => item.id === id)?.status !== 'done')
    || task.blockers.some(id => queue.blockers.find(item => item.id === id)?.status !== 'resolved')) throw new Error('Reconciliation cannot bypass current dependencies or blockers.');
  const receiptUrl = `https://github.com/AndreaMarro/ardesia-next/blob/${completionRef}/handoff.json`;
  const references = [receiptUrl, ...completed.packet.evidence.filter(item => sameEvidenceSource(item, completed.packet)
    && item.result === 'PASS' && (item.kind === 'review' || item.kind === 'ci' && item.name === 'verify')).map(item => item.reference)];
  if (task.status === 'done') {
    if (!references.every(reference => task.evidence.includes(reference)) || task.nextAction !== nextAction) throw new Error('Done task belongs to another completion or next action; preserve it.');
    return structuredClone(queue);
  }
  if (task.evidence.includes(receiptUrl)) throw new Error('An already recorded completion cannot close a reopened task.');
  const proofIdentity = packet => [...new Set(packet.evidence.filter(item => sameEvidenceSource(item, packet)
    && item.result === 'PASS' && (item.kind === 'ci' && item.name === 'verify'
      || item.kind === 'review' && item.reference === packet.review?.reference))
    .map(item => JSON.stringify([item.kind, item.reference])))].sort();
  const recordedProofs = new Set();
  for (const reference of task.evidence) {
    const priorRef = /^https:\/\/github\.com\/AndreaMarro\/ardesia-next\/blob\/([a-f0-9]{40})\/handoff\.json$/.exec(reference)?.[1];
    if (!priorRef) continue;
    const prior = readCompletion(priorRef); valid(prior);
    if (sequential(prior) && prior.packet.disposition === 'COMPLETE_INCREMENT' && prior.packet.taskId === task.id
      && prior.packet.source.headSha === completed.packet.source.headSha
      && prior.packet.source.sourceDigest === completed.packet.source.sourceDigest) {
      for (const proof of proofIdentity(prior.packet)) recordedProofs.add(proof);
    }
  }
  if (recordedProofs.size && proofIdentity(completed.packet).every(proof => recordedProofs.has(proof))) {
    throw new Error('Already recorded candidate proofs cannot close a reopened task through another receipt.');
  }
  const next = structuredClone(queue), row = next.tasks.find(row => row.id === task.id);
  row.status = 'done'; row.nextAction = nextAction;
  row.evidence = [...new Set([...row.evidence, ...references])];
  // Replaying identical durable inputs emits identical source bytes, even after interruption.
  next.updatedAt = new Date(Math.max(Date.parse(queue.updatedAt), Date.parse(completed.updatedAt))).toISOString();
  const errors = validateCoordination(next, {readBaseline: procedureBaseline(data.procedureRef)});
  if (errors.length) throw new Error(errors.join('\n'));
  return next;
}

const usage = 'Usage: node tools/cycle.mjs validate|brief STATE; claim STATE --revision N --actor pro|codex --run ID --started-at ISO; budget STATE --actor ROLE --run ID --seconds N; finish STATE --revision N --actor ROLE --run ID --outcome OUTCOME --packet PACKET --summary TEXT [--queue QUEUE] [--retain-claim true|false]; recover STATE --revision N --actor codex --run ID --terminal RECEIPT --packet PACKET --queue QUEUE --summary TEXT; migrate STATE --revision N --procedure-ref SHA --packet PACKET; assign STATE --revision N --actor codex --run ID --packet PACKET --queue QUEUE; reconcile STATE --revision N --actor codex --run ID --queue QUEUE --completion-ref SHA --next-action TEXT [--release-ref SHA]';
/** Reads local JSON and emits JSON to stdout. It never writes files, contacts GitHub or selects a clock. */
export function runCycleCli(args, {readText = path => readFileSync(path, 'utf8'), readQueue = gitQueue, readCompletion = gitCompletion} = {}) {
  try {
    if (!Array.isArray(args) || args.length < 2 || !['validate', 'brief', 'claim', 'budget', 'finish', 'recover', 'migrate', 'assign', 'reconcile'].includes(args[0]) || !text(args[1]) || args[1].startsWith('--')) throw new Error(usage);
    const [command, file, ...flags] = args;
    const required = {validate: [], brief: [], claim: ['revision', 'actor', 'run', 'started-at'], budget: ['actor', 'run', 'seconds'], finish: ['revision', 'actor', 'run', 'outcome', 'packet', 'summary'], recover: ['revision', 'actor', 'run', 'terminal', 'packet', 'queue', 'summary'], migrate: ['revision', 'procedure-ref', 'packet'], assign: ['revision', 'actor', 'run', 'packet', 'queue'], reconcile: ['revision', 'actor', 'run', 'queue', 'completion-ref', 'next-action']}[command];
    const accepted = command === 'finish' ? [...required, 'queue', 'retain-claim'] : command === 'reconcile' ? [...required, 'release-ref'] : required;
    const options = {};
    if (flags.length % 2) throw new Error(usage);
    for (let index = 0; index < flags.length; index += 2) {
      const key = flags[index].slice(2), value = flags[index + 1];
      if (!flags[index].startsWith('--') || !accepted.includes(key) || Object.hasOwn(options, key) || !text(value)) throw new Error(usage);
      options[key] = value;
    }
    if (required.some(key => !Object.hasOwn(options, key))) throw new Error(usage);
    if (Object.hasOwn(options, 'retain-claim') && !['true', 'false'].includes(options['retain-claim'])) throw new Error(usage);
    for (const key of ['revision', 'seconds']) if (Object.hasOwn(options, key) && (!/^(0|[1-9][0-9]*)$/.test(options[key]) || !Number.isSafeInteger(Number(options[key])))) throw new Error(`${key} must be a safe unsigned integer.`);
    const data = JSON.parse(readText(file));
    const input = {expectedRevision: Number(options.revision), runId: options.run, actor: options.actor};
    let result;
    if (command === 'validate') { valid(data); result = {kind: 'ardesia-cycle-validation', acceptanceEvidence: false, revision: data.revision, valid: true}; }
    else if (command === 'brief') result = cycleBrief(data);
    else if (command === 'claim') result = claimCycle(data, {...input, startedAt: options['started-at']});
    else if (command === 'budget') result = cycleBudget(data, {...input, seconds: Number(options.seconds)});
    else if (command === 'recover') result = recoverCycle(data, {...input, terminal: JSON.parse(readText(options.terminal)), packet: JSON.parse(readText(options.packet)), queue: JSON.parse(readText(options.queue)), summary: options.summary}, {readQueue});
    else if (command === 'migrate') result = migrateCycle(data, {...input, procedureRef: options['procedure-ref'], packet: JSON.parse(readText(options.packet))});
    else if (command === 'assign') result = assignCycle(data, {...input, packet: JSON.parse(readText(options.packet)), queue: JSON.parse(readText(options.queue))}, {readQueue});
    else if (command === 'reconcile') result = reconcileCycle(data, {...input, queue: JSON.parse(readText(options.queue)), completionRef: options['completion-ref'], releaseRef: options['release-ref'], nextAction: options['next-action']}, {readQueue, readCompletion});
    else result = finishCycle(data, {...input, outcome: options.outcome, packet: JSON.parse(readText(options.packet)), summary: options.summary,
      queue: options.queue === undefined ? undefined : JSON.parse(readText(options.queue)), retainClaim: options['retain-claim'] === 'true'}, {readQueue});
    return {exitCode: 0, stdout: JSON.stringify(result, null, 2), stderr: ''};
  } catch (error) { return {exitCode: 1, stdout: '', stderr: error instanceof SyntaxError ? 'Input contains invalid JSON.' : error.message}; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runCycleCli(process.argv.slice(2));
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = result.exitCode;
}
