import {createHash} from 'node:crypto';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const id = value => text(value) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exactKeys = (value, keys) => record(value)
  && keys.length === Object.keys(value).length && keys.every(key => Object.hasOwn(value, key));
const uniqueList = (value, predicate, minimum = 0) => Array.isArray(value)
  && value.length >= minimum && value.every(predicate) && new Set(value).size === value.length;
const prefix = value => value.replace(/\/$/, '');
const contains = (parent, child) => prefix(child) === prefix(parent)
  || prefix(child).startsWith(`${prefix(parent)}/`);

// Same literal-path semantics as the existing coordinator; not a filesystem ACL.
function repoPath(value) {
  if (!text(value) || value.startsWith('/') || /[\\\x00-\x1f\x7f:*?\[\]{}#%]/.test(value)) return false;
  return prefix(value).split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const n = Date.parse(value);
  return Number.isFinite(n) && new Date(n).toISOString() === value;
}

/** Data-only canonicalization for diagnostic bindings, NOT the product sourceDigest.
 * Never invoke accessors/toJSON. Reject cycles, sparse arrays and executable values.
 * A trusted caller must still fetch and authenticate the underlying observations.
 */
function canonicalData(value) {
  const active = new Set(); let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 100000 || depth > 32) throw Error('INVALID_READINESS_DATA');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || active.has(item)) throw Error('INVALID_READINESS_DATA');
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw Error('INVALID_READINESS_DATA');
    const descriptors = Object.getOwnPropertyDescriptors(item), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string'
      || !('value' in descriptors[key])
      || (!descriptors[key].enumerable && !(array && key === 'length')))) throw Error('INVALID_READINESS_DATA');
    active.add(item);
    let result;
    if (array) {
      if (item.length > 100000 || keys.length !== item.length + 1
        || !Array.from({length:item.length}, (_, index) => String(index)).every(key => Object.hasOwn(descriptors,key))) {
        throw Error('INVALID_READINESS_DATA');
      }
      result = '[' + Array.from({length:item.length}, (_, index) => visit(descriptors[index].value, depth + 1)).join(',') + ']';
    } else {
      result = '{' + keys.sort().map(key => JSON.stringify(key) + ':' + visit(descriptors[key].value, depth + 1)).join(',') + '}';
    }
    active.delete(item);
    return result;
  }
  return visit(value, 0);
}
export function readinessDigest(value) {
  return createHash('sha256').update(canonicalData(value), 'utf8').digest('hex');
}

/** Pure E1 diagnostic. The trusted runner supplies a validated canonical task,
 * approved requirements and freshly observed facts. No I/O, claim, credentials,
 * model switching, scope expansion, phase promotion or acceptance is performed.
 * READY here is a necessary preflight condition, never permission to write.
 *
 * @param {object} task Requested canonical task, unchanged from the adopted queue.
 * @param {object} context See docs/e1-task-readiness.md for the proposed contract.
 * @returns {{kind:string, acceptanceEvidence:false, authorizationGranted:false,
 * ready:boolean, blockers:Array<{code:string, detail:string}>, missingPaths:string[],
 * requiredEvidence:string[], binding:object|null}}
 */
export function validateTaskReadiness(task, context) {
  const blockers = [], missingPaths = []; let requiredEvidence = [], binding = null;
  const fail = (code, detail) => blockers.push({code, detail});
  const finish = () => ({kind:'ardesia-readiness-diagnostic', acceptanceEvidence:false,
    authorizationGranted:false, ready:blockers.length === 0, blockers, missingPaths,
    requiredEvidence, binding});
  try {
    // Validate data before reading its properties; never log supplied objects.
    canonicalData(task); canonicalData(context);
    if (!record(task) || !id(task.id) || !record(context)) {
      fail('INVALID_CONTEXT', 'Expected a data-only task and observed context.'); return finish();
    }
    if (context.canonicalTask === null || context.canonicalTask === undefined) {
      fail('UNKNOWN_TASK', 'No matching task was found in the adopted canonical queue.'); return finish();
    }
    const contextKeys = ['canonicalTask','procedureRef','sourceSha','policyDigest','requirements',
      'dependencies','blockers','now','observed'];
    const observedKeys = ['taskId','procedureRef','sourceSha','policyDigest','taskDigest',
      'requirementsDigest','observedAt','capabilities','executionProfile'];
    const taskStates = ['queued','in_progress','ready_for_review','blocked','done','deferred'];
    const entries = (values, statuses) => Array.isArray(values)
      && values.every(item => exactKeys(item,['id','status']) && id(item.id) && statuses.includes(item.status))
      && new Set(values.map(item => item.id)).size === values.length;
    const observed = context.observed;
    if (!exactKeys(context,contextKeys) || !record(context.canonicalTask)
      || !id(context.canonicalTask.id) || !sha(context.procedureRef) || !sha(context.sourceSha)
      || !digest(context.policyDigest) || !utc(context.now)
      || !entries(context.dependencies,taskStates) || !entries(context.blockers,['blocked','resolved'])
      || !exactKeys(observed,observedKeys) || !id(observed.taskId)
      || !sha(observed.procedureRef) || !sha(observed.sourceSha) || !digest(observed.policyDigest)
      || !digest(observed.taskDigest) || !digest(observed.requirementsDigest) || !utc(observed.observedAt)
      || !entries(observed.capabilities,['available','unavailable','unknown'])
      || !exactKeys(observed.executionProfile,['id','effort','status'])
      || !id(observed.executionProfile.id) || !id(observed.executionProfile.effort)
      || !['verified','unavailable','unknown'].includes(observed.executionProfile.status)
      || !uniqueList(task.scope,repoPath,1) || !uniqueList(task.dependsOn,id)
      || !uniqueList(task.blockers,id) || !text(task.owner)
      || !uniqueList(task.exitCriteria,text,1)) {
      fail('INVALID_CONTEXT', 'Missing, malformed or duplicate data in the canonical context or observations.'); return finish();
    }
    if (task.id !== context.canonicalTask.id || readinessDigest(task) !== readinessDigest(context.canonicalTask)) {
      fail('TASK_CHANGED', 'The requested task differs from its canonical contract.'); return finish();
    }
    if (!['queued','in_progress'].includes(task.status)) fail('TASK_NOT_QUEUED', 'Implementation requires queued or active canonical work.');
    const requirements = context.requirements;
    const requirementKeys = ['taskId','procedureRef','consumer','risk','requiredPaths','requiredCapabilities',
      'requiredEvidence','executionProfile','rollback','maxObservationAgeMs'];
    if (!exactKeys(requirements,requirementKeys) || requirements.taskId !== task.id
      || !sha(requirements.procedureRef) || !text(requirements.consumer) || !['R0','R1','R2'].includes(requirements.risk)
      || !uniqueList(requirements.requiredPaths,path => repoPath(path) && !path.endsWith('/'),1)
      || !uniqueList(requirements.requiredCapabilities,id) || !uniqueList(requirements.requiredEvidence,id,1)
      || !exactKeys(requirements.executionProfile,['id','effort'])
      || !id(requirements.executionProfile.id) || !id(requirements.executionProfile.effort)
      || !text(requirements.rollback) || !Number.isSafeInteger(requirements.maxObservationAgeMs)
      || requirements.maxObservationAgeMs <= 0) {
      fail('INVALID_REQUIREMENTS', 'Approved consumer, exact paths, checks, profile, rollback and observation lifetime are required.'); return finish();
    }
    requiredEvidence = [...requirements.requiredEvidence];
    if (requirements.procedureRef !== context.procedureRef) {
      fail('UNADOPTED_REQUIREMENTS', 'Requirements are not bound to the currently adopted procedure.');
    }
    binding = {taskId:task.id, procedureRef:context.procedureRef, sourceSha:context.sourceSha,
      policyDigest:context.policyDigest, taskDigest:readinessDigest(task),
      requirementsDigest:readinessDigest(requirements)};
    if (Object.entries(binding).some(([key,value]) => observed[key] !== value)) {
      fail('STALE_BINDING', 'Task, procedure, source, policy or requirements changed since the observation.');
    }
    const age = Date.parse(context.now) - Date.parse(observed.observedAt);
    if (age < 0 || age > requirements.maxObservationAgeMs) {
      fail('STALE_OBSERVATION', 'Observations are in the future or exceed their approved lifetime.');
    }
    for (const path of requirements.requiredPaths) if (!task.scope.some(scope => contains(scope,path))) missingPaths.push(path);
    if (missingPaths.length) fail('MISSING_SCOPE', 'The consumer requires files outside the approved task scope.');
    for (const dependency of task.dependsOn) {
      if (context.dependencies.find(item => item.id === dependency)?.status !== 'done') {
        fail('DEPENDENCY_NOT_DONE', `Required dependency is not complete: ${dependency}.`);
      }
    }
    for (const blocker of task.blockers) {
      if (context.blockers.find(item => item.id === blocker)?.status !== 'resolved') {
        fail('BLOCKER_NOT_RESOLVED', `Required blocker is not resolved: ${blocker}.`);
      }
    }
    for (const capability of requirements.requiredCapabilities) {
      if (observed.capabilities.find(item => item.id === capability)?.status !== 'available') {
        fail('CAPABILITY_UNAVAILABLE', `Required capability is not available: ${capability}.`);
      }
    }
    if (observed.executionProfile.status !== 'verified') fail('PROFILE_UNVERIFIED', 'The required execution profile has not been observed as verified.');
    if (observed.executionProfile.id !== requirements.executionProfile.id
      || observed.executionProfile.effort !== requirements.executionProfile.effort) {
      fail('PROFILE_MISMATCH', 'Observed model profile or effort differs from the approved requirement.');
    }
    return finish();
  } catch {
    fail('INVALID_CONTEXT', 'Only bounded, finite, data-only inputs are supported.'); return finish();
  }
}

/** Immutable queue descriptor. Runtime observations are deliberately separate. */
export function validateReadinessContract(contract, task) {
  try {
    canonicalData(contract);
    if (!exactKeys(contract,['consumer','risk','requiredPaths','requiredCapabilities','requiredEvidence','executionProfiles','rollback','maxObservationAgeMs'])
      || !text(contract.consumer) || !['R0','R1','R2'].includes(contract.risk)
      || !uniqueList(contract.requiredPaths,p=>repoPath(p)&&!p.endsWith('/'),1)
      || contract.requiredPaths.some(p=>!task.scope.some(s=>contains(s,p)))
      || !uniqueList(contract.requiredCapabilities,id,1) || !uniqueList(contract.requiredEvidence,id,1)
      || !Array.isArray(contract.executionProfiles) || !contract.executionProfiles.length
      || !contract.executionProfiles.every(p=>exactKeys(p,['id','effort'])&&id(p.id)&&id(p.effort))
      || new Set(contract.executionProfiles.map(p=>p.id+':'+p.effort)).size!==contract.executionProfiles.length
      || !text(contract.rollback) || !Number.isSafeInteger(contract.maxObservationAgeMs)
      || contract.maxObservationAgeMs<=0 || contract.maxObservationAgeMs>300000) return ['READINESS_CONTRACT_INVALID'];
    return [];
  } catch { return ['READINESS_CONTRACT_INVALID']; }
}
export function taskReadinessRequirements(task, procedureRef, profile) {
  if (validateReadinessContract(task.readiness,task).length || !sha(procedureRef)) throw Error('READINESS_CONTRACT_INVALID');
  const {executionProfiles,...contract}=task.readiness;
  const executionProfile=executionProfiles.find(p=>p.id===profile?.id&&p.effort===profile?.effort)??executionProfiles[0];
  return {taskId:task.id,procedureRef,...contract,executionProfile};
}
