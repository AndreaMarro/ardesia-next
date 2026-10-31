import {readFileSync, realpathSync, statSync} from 'node:fs';
import {isAbsolute, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const identifier = value => text(value) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const fields = {
  root: ['schemaVersion', 'acceptanceEvidence', 'repository', 'updatedAt', 'policy', 'canonical', 'observations', 'blockers', 'tasks', 'claims'],
  policy: ['maxActiveIncrements', 'maxRemoteWriters', 'productionAuthorized', 'newSpendAuthorized', 'codexJobsAuthorized', 'mainFrozen', 'stagingFrozen'],
  canonical: ['entrypoint', 'handbook', 'history', 'lessons', 'product', 'acceptance'],
  observation: ['id', 'observedAt', 'kind', 'source', 'url', 'value'],
  blocker: ['id', 'status', 'reason', 'lastCheckedAt', 'recheckWhen', 'sources'],
  task: ['id', 'title', 'status', 'priority', 'owner', 'scope', 'dependsOn', 'blockers', 'exitCriteria', 'evidence', 'nextAction'],
  claim: ['taskId', 'owner', 'baseSha', 'branch', 'paths', 'claimedAt', 'expiresAt']
};
const taskStates = new Set(['in_progress', 'ready_for_review', 'blocked', 'queued', 'done', 'deferred']);

function timestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === `${year}-${month}-${day}`
    && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60
    && (offsetHour === undefined || Number(offsetHour) < 24 && Number(offsetMinute) < 60);
}

// Prefixes are literal repository paths, never glob patterns or filesystem roots.
function repoPath(value) {
  if (!text(value) || isAbsolute(value) || /[\\\x00-\x1f\x7f:*?\[\]{}#%]/.test(value)) return false;
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  return normalized.length > 0 && normalized.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
const prefix = value => value.replace(/\/$/, '');
const contains = (parent, child) => prefix(child) === prefix(parent) || prefix(child).startsWith(`${prefix(parent)}/`);
const overlaps = (left, right) => contains(left, right) || contains(right, left);

function httpsReference(value) {
  if (!text(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
const reference = value => httpsReference(value) || repoPath(value);
function isolatedBranch(value) {
  return text(value) && !['@', 'HEAD'].includes(value) && !value.startsWith('refs/') && !value.startsWith('-')
    && !['main', 'preview/m3'].includes(value)
    && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.includes('..') && !value.includes('@{')
    && value.split('/').every(part => part !== '' && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'));
}

/** Validate coordination metadata only. This neither verifies evidence nor accepts a product milestone. */
export function validateCoordination(data, {root} = {}) {
  const errors = [];
  const fail = (path, reason) => errors.push(`${path}: ${reason}`);
  const shape = (value, name, path, optional = []) => {
    if (!record(value)) { fail(path, 'must be an object'); return false; }
    for (const key of fields[name]) if (!optional.includes(key) && !Object.hasOwn(value, key)) fail(`${path}.${key}`, 'is required');
    for (const key of Object.keys(value)) if (!fields[name].includes(key)) fail(`${path}.${key}`, 'is not a supported field');
    return true;
  };
  const list = (value, path, predicate = text, minimum = 0) => {
    if (!Array.isArray(value)) { fail(path, 'must be an array'); return []; }
    if (value.length < minimum) fail(path, `must contain at least ${minimum} entry`);
    value.forEach((item, index) => { if (!predicate(item)) fail(`${path}[${index}]`, 'is invalid'); });
    return value;
  };
  const time = (value, path) => { if (!timestamp(value)) fail(path, 'must be a valid ISO timestamp with timezone'); };
  const uniqueIds = (items, path) => {
    const seen = new Set();
    for (const item of items) {
      if (!identifier(item?.id)) { fail(`${path}.id`, 'must be an identifier'); continue; }
      if (seen.has(item.id)) fail(`${path}.${item.id}`, 'duplicate id');
      seen.add(item.id);
    }
  };
  if (!shape(data, 'root', 'coordination')) return errors;
  if (data.schemaVersion !== '1.0.0') fail('schemaVersion', 'unsupported version');
  if (data.acceptanceEvidence !== false) fail('acceptanceEvidence', 'must remain false');
  if (data.repository !== 'AndreaMarro/ardesia-next') fail('repository', 'must identify the canonical repository');
  time(data.updatedAt, 'updatedAt');
  if (shape(data.policy, 'policy', 'policy')) {
    const required = {maxActiveIncrements: 1, maxRemoteWriters: 1, productionAuthorized: false, newSpendAuthorized: false,
      codexJobsAuthorized: false, mainFrozen: true, stagingFrozen: true};
    for (const [key, value] of Object.entries(required)) if (data.policy[key] !== value) fail(`policy.${key}`, 'violates the current mandate');
  }
  if (shape(data.canonical, 'canonical', 'canonical')) {
    let realRoot;
    if (root !== undefined) {
      try { realRoot = realpathSync(root); if (!statSync(realRoot).isDirectory()) throw new Error(); }
      catch { fail('root', 'must be an existing directory'); }
    }
    for (const key of fields.canonical) {
      const path = data.canonical[key];
      if (!repoPath(path) || path.endsWith('/')) { fail(`canonical.${key}`, 'must be a relative file path'); continue; }
      if (realRoot) {
        try {
          const realFile = realpathSync(resolve(realRoot, path));
          const local = relative(realRoot, realFile);
          if (local === '..' || local.startsWith('../') || isAbsolute(local) || !statSync(realFile).isFile()) throw new Error();
        } catch { fail(`canonical.${key}`, 'must resolve to an existing file inside the repository'); }
      }
    }
    if (data.canonical.acceptance !== 'tools/status.mjs') fail('canonical.acceptance', 'must retain the existing acceptance engine');
  }
  const observations = list(data.observations, 'observations', record);
  uniqueIds(observations, 'observations');
  observations.forEach((observation, index) => {
    const path = `observations[${index}]`;
    if (!shape(observation, 'observation', path, ['url'])) return;
    time(observation.observedAt, `${path}.observedAt`);
    if (!['live', 'historical', 'handoff'].includes(observation.kind)) fail(`${path}.kind`, 'is unsupported');
    if (!text(observation.source)) fail(`${path}.source`, 'must name the observation source');
    if (Object.hasOwn(observation, 'url') && !httpsReference(observation.url)) fail(`${path}.url`, 'must be an HTTPS reference without credentials');
  });
  const blockers = list(data.blockers, 'blockers', record);
  uniqueIds(blockers, 'blockers');
  blockers.forEach((blocker, index) => {
    const path = `blockers[${index}]`;
    if (!shape(blocker, 'blocker', path)) return;
    if (!['blocked', 'resolved'].includes(blocker.status)) fail(`${path}.status`, 'is unsupported');
    for (const key of ['reason', 'recheckWhen']) if (!text(blocker[key])) fail(`${path}.${key}`, 'must be nonempty text');
    time(blocker.lastCheckedAt, `${path}.lastCheckedAt`);
    list(blocker.sources, `${path}.sources`, text, 1);
  });
  const tasks = list(data.tasks, 'tasks', record);
  uniqueIds(tasks, 'tasks');
  const taskById = new Map(tasks.filter(record).map(task => [task.id, task]));
  const blockerById = new Map(blockers.filter(record).map(blocker => [blocker.id, blocker]));
  tasks.forEach((task, index) => {
    const path = `tasks[${index}]`;
    if (!shape(task, 'task', path)) return;
    for (const key of ['title', 'owner', 'nextAction']) if (!text(task[key])) fail(`${path}.${key}`, 'must be nonempty text');
    if (!taskStates.has(task.status)) fail(`${path}.status`, 'is unsupported; coordination cannot declare acceptance');
    if (!Number.isSafeInteger(task.priority) || task.priority < 0) fail(`${path}.priority`, 'must be a nonnegative integer');
    list(task.scope, `${path}.scope`, repoPath, 1);
    list(task.exitCriteria, `${path}.exitCriteria`, text, 1);
    list(task.evidence, `${path}.evidence`, reference, ['ready_for_review', 'done'].includes(task.status) ? 1 : 0);
    for (const id of list(task.dependsOn, `${path}.dependsOn`, identifier)) {
      if (!taskById.has(id)) fail(`${path}.dependsOn`, 'references an unknown task');
      else if (task.status === 'in_progress' && taskById.get(id).status !== 'done') fail(`${path}.dependsOn`, 'in-progress work requires completed direct dependencies');
    }
    for (const id of list(task.blockers, `${path}.blockers`, identifier)) {
      if (!blockerById.has(id)) fail(`${path}.blockers`, 'references an unknown blocker');
      else if (task.status === 'in_progress' && blockerById.get(id).status !== 'resolved') fail(`${path}.blockers`, 'in-progress work requires resolved blockers');
    }
  });
  if (tasks.filter(task => task?.status === 'in_progress').length > 1) fail('tasks', 'only one increment may be in progress');
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { fail('tasks.dependsOn', 'dependency cycle'); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const dependencies = taskById.get(id)?.dependsOn;
    if (Array.isArray(dependencies)) for (const dependency of dependencies) if (taskById.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of taskById.keys()) visit(id);

  const claims = list(data.claims, 'claims', record);
  const claimedPaths = [];
  claims.forEach((claim, index) => {
    const path = `claims[${index}]`;
    if (!shape(claim, 'claim', path)) return;
    const task = taskById.get(claim.taskId);
    if (!task) fail(`${path}.taskId`, 'references an unknown task');
    else {
      if (task.status !== 'in_progress') fail(`${path}.taskId`, 'requires an in-progress task');
      if (claim.owner !== task.owner) fail(`${path}.owner`, 'must match the task owner');
    }
    if (!text(claim.owner)) fail(`${path}.owner`, 'must be nonempty text');
    if (typeof claim.baseSha !== 'string' || !/^[a-f0-9]{40}$/.test(claim.baseSha)) fail(`${path}.baseSha`, 'must be a full commit SHA');
    if (!isolatedBranch(claim.branch)) fail(`${path}.branch`, 'must be an isolated valid branch, never a protected candidate');
    time(claim.claimedAt, `${path}.claimedAt`); time(claim.expiresAt, `${path}.expiresAt`);
    if (timestamp(claim.claimedAt) && timestamp(claim.expiresAt) && Date.parse(claim.expiresAt) <= Date.parse(claim.claimedAt)) fail(`${path}.expiresAt`, 'must follow claimedAt');
    for (const claimed of list(claim.paths, `${path}.paths`, repoPath, 1)) {
      if (!repoPath(claimed)) continue;
      if (task && (!Array.isArray(task.scope) || !task.scope.some(scope => repoPath(scope) && contains(scope, claimed)))) fail(`${path}.paths`, 'must stay within the task scope');
      if (claimedPaths.some(previous => overlaps(previous, claimed))) fail(`${path}.paths`, 'overlaps an existing claim; expiry never transfers ownership');
      claimedPaths.push(claimed);
    }
  });
  tasks.forEach((task, index) => {
    if (task?.status === 'in_progress' && !claims.some(claim => record(claim) && claim.taskId === task.id)) fail(`tasks[${index}]`, 'in-progress work requires at least one claim');
  });
  return errors;
}

/** Display-only clock use: expiry cannot invalidate CI or silently authorize takeover. */
export function coordinationBrief(data, {now = new Date()} = {}) {
  const moment = new Date(now).getTime();
  if (!Number.isFinite(moment)) throw new Error('Brief clock must be a valid date.');
  return {
    kind: 'ardesia-coordination-brief', acceptanceEvidence: false, repository: data.repository, updatedAt: data.updatedAt,
    policy: data.policy, canonical: data.canonical,
    tasks: [...data.tasks].filter(task => !['done', 'deferred'].includes(task.status)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .map(({id, status, owner, dependsOn, blockers, nextAction}) => ({id, status, owner, dependsOn, blockers, nextAction})),
    blockers: data.blockers.filter(blocker => blocker.status === 'blocked').map(({id, reason, lastCheckedAt, recheckWhen}) => ({id, reason, lastCheckedAt, recheckWhen})),
    claims: data.claims.map(({taskId, owner, baseSha, branch, paths, expiresAt}) => ({taskId, owner, baseSha, branch, paths, expiresAt,
      expired: Date.parse(expiresAt) <= moment, takeoverAuthorized: false}))
  };
}

export function runCoordinationCli(args, {root = process.cwd(), now = new Date()} = {}) {
  try {
    if (!Array.isArray(args) || args.length > 1 || args.length === 1 && args[0] !== '--brief') throw new Error('Usage: node tools/check-operations.mjs [--brief]');
    const data = JSON.parse(readFileSync(resolve(root, 'operations/coordination.json'), 'utf8'));
    const errors = validateCoordination(data, {root});
    if (errors.length) throw new Error(errors.join('\n'));
    return {exitCode: 0, stdout: args[0] === '--brief' ? JSON.stringify(coordinationBrief(data, {now}), null, 2)
      : 'Coordination structure verified. Product acceptance is not evaluated here.', stderr: ''};
  } catch (error) {
    return {exitCode: 1, stdout: '', stderr: error instanceof SyntaxError ? 'Coordination file contains invalid JSON.' : error.message};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runCoordinationCli(process.argv.slice(2));
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = result.exitCode;
}
