import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readinessDigest, validateTaskReadiness} from './task-preflight.mjs';

// Synthetic observations; refs/scopes mirror the documented M4 scope incident.
// An available capability in a fixture is NOT an observation of real access.
const PROCEDURE = '413de5bba02537cc090c91db58887b49de08eae4';
const SOURCE = '062e3d58ed9fa9e5444e402e26a9760f797d3c96';
const OLD_SCOPE = ['plugins', 'packages/plugin-sdk', 'packages/plugin-host', 'tools', 'docs'];
const CURRENT_SCOPE = [...OLD_SCOPE, 'package-lock.json', 'apps/web',
  'packages/server/package.json', 'packages/server/src/server.integration.test.ts', 'e2e'];
function fixture(scope = CURRENT_SCOPE) {
  const task = {id: 'M4-REUSE', title: 'Secondo dominio sullo stesso Core/Host',
    status: 'queued', owner: 'coordinator', priority: 6, scope: [...scope],
    dependsOn: ['M3-TRANSITION'], blockers: [],
    exitCriteria: ['Consumer reale e riapertura sul medesimo Core.'], evidence: [],
    nextAction: 'Completare il consumer senza modificare autorità.'};
  const requirements = {taskId: task.id, procedureRef: PROCEDURE,
    consumer: 'Poiseuille: catalogo, UI, salvataggio, riapertura, studente',
    risk: 'R2', requiredPaths: ['apps/web/src/App.tsx',
      'packages/server/src/server.integration.test.ts', 'e2e/poiseuille.spec.ts'],
    requiredCapabilities: ['node24', 'postgres-test', 'student-fixture', 'browser'],
    requiredEvidence: ['typecheck', 'boundaries', 'unit', 'postgres', 'browser', 'independent-review'],
    executionProfile: {id: 'qualified-builder', effort: 'high'},
    rollback: 'Revert only this increment; retain saved scientific data.',
    maxObservationAgeMs: 300000};
  const context = {canonicalTask: structuredClone(task), procedureRef: PROCEDURE,
    sourceSha: SOURCE, policyDigest: 'a'.repeat(64), requirements,
    dependencies: [{id: 'M3-TRANSITION', status: 'done'}], blockers: [],
    now: '2026-11-02T19:34:00.000Z', observed: {
      taskId: task.id, procedureRef: PROCEDURE, sourceSha: SOURCE,
      policyDigest: 'a'.repeat(64), taskDigest: readinessDigest(task),
      requirementsDigest: readinessDigest(requirements),
      observedAt: '2026-11-02T19:33:00.000Z',
      capabilities: ['node24','postgres-test','student-fixture','browser']
        .map(id => ({id, status: 'available'})),
      executionProfile: {id:'qualified-builder', effort:'high', status:'verified'}
    }};
  return {task, context};
}
const codes = result => result.blockers.map(value => value.code);
function reject(transform, code, base = fixture()) {
  transform(base);
  const result = validateTaskReadiness(base.task, base.context);
  assert.equal(result.ready, false);
  assert.ok(codes(result).includes(code), JSON.stringify(result));
  assert.equal(result.authorizationGranted, false);
  assert.equal(result.acceptanceEvidence, false);
  return result;
}

test('rejects the pre-38 M4 scope before implementation, naming exact missing paths', () => {
  const {task, context} = fixture(OLD_SCOPE);
  const result = validateTaskReadiness(task, context);
  assert.equal(result.ready, false);
  assert.ok(codes(result).includes('MISSING_SCOPE'));
  assert.deepEqual(result.missingPaths, context.requirements.requiredPaths);
});
test('valid current scope returns diagnostics without a grant or PASS evidence', () => {
  const {task, context} = fixture();
  const result = validateTaskReadiness(task, context);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.requiredEvidence, context.requirements.requiredEvidence);
  assert.equal(result.authorizationGranted, false);
  assert.equal(result.acceptanceEvidence, false);
  assert.equal(result.binding.sourceSha, SOURCE);
});
test('refuses an unknown canonical task', () => reject(x => {x.context.canonicalTask = null;}, 'UNKNOWN_TASK'));
test('refuses caller-expanded scope despite matching task identity', () => reject(x => {
  x.task.scope.push('packages/server');
}, 'TASK_CHANGED'));
test('refuses caller-weakened exit criteria', () => reject(x => {x.task.exitCriteria = ['Anything'];}, 'TASK_CHANGED'));
test('does not start a done task', () => reject(x => {
  x.task.status = x.context.canonicalTask.status = 'done';
  x.context.observed.taskDigest = readinessDigest(x.task);
}, 'TASK_NOT_QUEUED'));
test('refuses an incomplete dependency', () => reject(x => {x.context.dependencies[0].status = 'queued';}, 'DEPENDENCY_NOT_DONE'));
test('refuses a missing dependency observation', () => reject(x => {x.context.dependencies = [];}, 'DEPENDENCY_NOT_DONE'));
test('refuses an unresolved task blocker', () => reject(x => {
  x.task.blockers = x.context.canonicalTask.blockers = ['QA'];
  x.context.observed.taskDigest = readinessDigest(x.task);
  x.context.blockers = [{id:'QA',status:'blocked'}];
}, 'BLOCKER_NOT_RESOLVED'));
test('refuses duplicate prerequisite IDs instead of last-write wins', () => reject(x => {
  x.context.dependencies.push({id:'M3-TRANSITION',status:'queued'});
}, 'INVALID_CONTEXT'));
test('refuses missing observations', () => reject(x => {delete x.context.observed;}, 'INVALID_CONTEXT'));
test('refuses unknown or unavailable capability', () => {
  for (const status of ['unknown','unavailable']) reject(x => {x.context.observed.capabilities[0].status = status;}, 'CAPABILITY_UNAVAILABLE');
});
test('refuses a missing student fixture even when database is available', () => reject(x => {
  x.context.observed.capabilities = x.context.observed.capabilities.filter(c => c.id !== 'student-fixture');
}, 'CAPABILITY_UNAVAILABLE'));
test('refuses an unknown effective execution profile', () => reject(x => {
  x.context.observed.executionProfile.status = 'unknown';
}, 'PROFILE_UNVERIFIED'));
test('refuses unsupported effort or silent model substitution', () => {
  reject(x => {x.context.observed.executionProfile.effort = 'max';}, 'PROFILE_MISMATCH');
  reject(x => {x.context.observed.executionProfile.id = 'other-builder';}, 'PROFILE_MISMATCH');
});
test('refuses old observations when policy changes', () => reject(x => {x.context.policyDigest = 'b'.repeat(64);}, 'STALE_BINDING'));
test('refuses old observations when source changes', () => reject(x => {x.context.sourceSha = 'b'.repeat(40);}, 'STALE_BINDING'));
test('refuses requirements from an unadopted procedure', () => reject(x => {
  x.context.requirements.procedureRef = 'b'.repeat(40);
}, 'UNADOPTED_REQUIREMENTS'));
test('refuses reused READY when canonical task changes', () => reject(x => {
  x.task.exitCriteria.push('New requirement');
  x.context.canonicalTask = structuredClone(x.task);
}, 'STALE_BINDING'));
test('refuses reused READY when requirements change', () => reject(x => {
  x.context.requirements.requiredEvidence.push('new-adverse-case');
}, 'STALE_BINDING'));
test('refuses expired or future observations', () => {
  reject(x => {x.context.now = '2026-11-02T20:00:00.000Z';}, 'STALE_OBSERVATION');
  reject(x => {x.context.observed.observedAt = '2026-11-02T20:00:00.000Z';}, 'STALE_OBSERVATION');
});
test('rejects invalid dates instead of normalizing them', () => reject(x => {
  x.context.now = '2026-02-30T19:34:00.000Z';
}, 'INVALID_CONTEXT'));
test('does not confuse apps/web-old with apps/web', () => {
  const base = fixture(OLD_SCOPE.concat(['apps/web-old','e2e','packages/server/src']));
  const result = validateTaskReadiness(base.task, base.context);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingPaths, ['apps/web/src/App.tsx']);
});
test('rejects traversal, globs, absolute and ambiguous repository paths', () => {
  for (const path of ['../outside','apps/web/../server','/tmp/a','apps/**','apps//web',
    'apps\\web','apps/web%2foutside','apps/web\u0000x','apps/web#x']) {
    reject(x => {x.context.requirements.requiredPaths = [path];}, 'INVALID_REQUIREMENTS');
  }
});
test('rejects missing required checks, rollback, or consumer', () => {
  for (const key of ['requiredEvidence','rollback','consumer']) {
    reject(x => {delete x.context.requirements[key];}, 'INVALID_REQUIREMENTS');
  }
});
test('rejects duplicate capability reports', () => reject(x => {
  x.context.observed.capabilities.push({id:'node24',status:'available'});
}, 'INVALID_CONTEXT'));
test('refuses mismatched requirement task identity', () => reject(x => {
  x.context.requirements.taskId = 'OTHER';
}, 'INVALID_REQUIREMENTS'));
test('requires immutable full SHAs and policy digest', () => {
  reject(x => {x.context.sourceSha = 'main';}, 'INVALID_CONTEXT');
  reject(x => {x.context.procedureRef = '413de5b';}, 'INVALID_CONTEXT');
  reject(x => {x.context.policyDigest = '';}, 'INVALID_CONTEXT');
});
test('input stays unchanged and output arrays are independent', () => {
  const {task, context} = fixture();
  const before = JSON.stringify({task,context});
  const result = validateTaskReadiness(task,context);
  result.requiredEvidence.push('not-persisted');
  assert.equal(JSON.stringify({task,context}), before);
});
test('does not invoke accessors or accept non-data input', () => {
  const {task,context} = fixture(); let reads = 0;
  Object.defineProperty(task, 'title', {enumerable:true, get() {reads++; return 'injected';}});
  const result = validateTaskReadiness(task,context);
  assert.equal(reads, 0);
  assert.equal(result.ready,false);
  assert.ok(codes(result).includes('INVALID_CONTEXT'));
});
test('rejects cyclic input without throwing', () => reject(x => {x.context.loop=x.context;}, 'INVALID_CONTEXT'));
test('canonical digest ignores object key order but preserves array order', () => {
  assert.equal(readinessDigest({a:1,b:2}),readinessDigest({b:2,a:1}));
  assert.notEqual(readinessDigest([1,2]),readinessDigest([2,1]));
  assert.throws(() => readinessDigest({n:NaN}));
});

test('rejects arrays with an executable inherited prototype without invoking it',()=>{
 const values=[];Object.setPrototypeOf(values,{toJSON(){throw Error('must not run');}});
 assert.throws(()=>readinessDigest(values),/INVALID_READINESS_DATA/);
});
