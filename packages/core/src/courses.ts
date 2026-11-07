import {
  canonicalJson, CoreError, courseTarget, projectDocumentRevision,
  type Actor, type CoreEvent, type CoreSnapshot, type Course, type CourseCommand, type CourseDelivery,
  type CourseEdition, type CourseEvent, type CourseInput, type CourseSpace, type CourseWork,
} from '@ardesia/contracts';

const unavailable = (): never => {throw new CoreError('NOT_FOUND', 'The exact authorized course resource is unavailable.');};
const invalid = (): never => {throw new CoreError('INVALID_SNAPSHOT', 'Course history does not reproduce its exact committed state.');};
async function digest(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))), byte => byte.toString(16).padStart(2, '0')).join('');
}
function ownCourse(state: CoreSnapshot, actor: Actor, id: string) {
  return state.courses.find(course => course.id === id && course.ownerId === actor.actorId) ?? unavailable();
}
function edition(state: CoreSnapshot, id: string) {return state.courseEditions.find(value => value.id === id) ?? unavailable();}
function delivery(state: CoreSnapshot, id: string) {return state.courseDeliveries.find(value => value.id === id) ?? unavailable();}
function exactCourse(state: CoreSnapshot, source: CourseEdition): Course {
  const event = state.events.find((entry): entry is CourseEvent => 'courseEntity' in entry && entry.courseEntity === 'course'
    && entry.entityId === source.courseId && entry.entityRevision === source.courseRevision);
  if (!event || !('units' in event.payload.value) || event.payload.value.ownerId !== source.ownerId) return unavailable();
  return event.payload.value;
}
function activeWork(state: CoreSnapshot, actor: Actor, id: string) {
  const target = delivery(state, id);
  if (target.status !== 'active' || target.learnerId !== actor.actorId
    || (actor.role === 'teacher' && target.ownerId !== actor.actorId)) return unavailable();
  return target;
}
/** Authorization precedes receipt lookup: a revoked delivery never replays an old write grant. */
export function authorizeCourse(state: CoreSnapshot, actor: Actor, command: CourseCommand) {
  if (command.kind === 'save-course') {
    if (state.courses.some(value => value.id === command.courseId)) ownCourse(state, actor, command.courseId);
  } else if (command.kind === 'create-course-edition') ownCourse(state, actor, command.courseId);
  else if (command.kind === 'assign-course') {
    if (edition(state, command.editionId).ownerId !== actor.actorId) return unavailable();
    if (actor.role !== 'teacher' && command.learnerId !== actor.actorId) throw new CoreError('FORBIDDEN', 'Teaching delivery requires a teacher; personal study remains available to the author.');
  } else if (command.kind === 'revoke-course-delivery') {
    const target = delivery(state, command.deliveryId);
    if (target.ownerId !== actor.actorId) return unavailable();
    if (actor.role !== 'teacher' && target.learnerId !== actor.actorId) throw new CoreError('FORBIDDEN', 'Only a teacher can manage another learner’s delivery.');
  } else activeWork(state, actor, command.deliveryId);
}
function revision(actual: number, expected: number) {
  if (actual !== expected) throw new CoreError('REVISION_CONFLICT', 'The course or personal work changed. Read the saved version before retrying.');
}
function validateLessons(state: CoreSnapshot, ownerId: string, units: CourseInput['units']) {
  for (const unit of units) if (unit.lesson) {
    const document = state.documents.find(value => value.id === unit.lesson!.documentId && value.ownerId === ownerId) ?? unavailable();
    projectDocumentRevision(state.events.filter((event): event is CoreEvent => 'documentId' in event && event.documentId === document.id), document.id, unit.lesson.revision);
  }
}
function write<T extends {id: string}>(list: T[], value: T) {
  const index = list.findIndex(entry => entry.id === value.id);
  if (index < 0) list.push(value); else list[index] = value;
}

/** Only the transaction clone is modified. Course material is never an executable grant. */
export async function applyCourse(state: CoreSnapshot, actor: Actor, command: CourseCommand, at: string): Promise<CourseEvent['payload']['value']> {
  authorizeCourse(state, actor, command);
  if (command.kind === 'save-course') {
    const old = state.courses.find(value => value.id === command.courseId);
    revision(old?.revision ?? 0, command.expectedRevision);
    validateLessons(state, actor.actorId, command.input.units);
    const units = command.input.units.map(unit => {
      const prior = old?.units.find(value => value.id === unit.id);
      const {revision: priorRevision = 0, ...priorInput} = prior ?? {};
      if (!prior && state.events.some(event => 'courseEntity' in event && event.courseEntity === 'course' && event.entityId === command.courseId
        && 'units' in event.payload.value && event.payload.value.units.some(value => value.id === unit.id))) {
        throw new CoreError('ALREADY_EXISTS', 'A removed unit identity cannot be reused. Create a new unit.');
      }
      return {...unit, revision: priorRevision + (canonicalJson(priorInput) === canonicalJson(unit) ? 0 : 1)};
    });
    const value: Course = {...structuredClone(command.input), units, id: command.courseId, ownerId: actor.actorId,
      revision: (old?.revision ?? 0) + 1, status: 'draft', createdAt: old?.createdAt ?? at, updatedAt: at};
    write(state.courses, value); return value;
  }
  if (command.kind === 'create-course-edition') {
    if (state.courseEditions.some(value => value.id === command.editionId)) throw new CoreError('ALREADY_EXISTS', 'Edition identity already exists.');
    const course = ownCourse(state, actor, command.courseId);
    revision(course.revision, command.courseRevision);
    if (course.units.some(unit => ['objective','prerequisites','explanation','prediction','activity','referenceFeedback','recovery','transfer']
      .some(key => !unit[key as keyof typeof unit]))) throw new CoreError('INVALID_COMMAND', 'Complete every learning phase before freezing an edition. This is not scientific approval.');
    validateLessons(state, actor.actorId, course.units);
    const value: CourseEdition = {id: command.editionId, courseId: course.id, courseRevision: course.revision,
      courseDigest: await digest(course), ownerId: actor.actorId, revision: 1, label: command.label, status: 'draft', createdAt: at};
    state.courseEditions.push(value); return value;
  }
  if (command.kind === 'assign-course') {
    if (state.courseDeliveries.some(value => value.id === command.deliveryId)) throw new CoreError('ALREADY_EXISTS', 'A delivery identity is never reused, including after revocation.');
    const value: CourseDelivery = {id: command.deliveryId, editionId: command.editionId, ownerId: actor.actorId,
      learnerId: command.learnerId, revision: 1, status: 'active', createdAt: at, updatedAt: at};
    state.courseDeliveries.push(value); return value;
  }
  const target = delivery(state, command.deliveryId);
  if (command.kind === 'revoke-course-delivery') {
    revision(target.revision, command.expectedRevision);
    if (target.status !== 'active') throw new CoreError('INVALID_COMMAND', 'This delivery is already revoked.');
    const value: CourseDelivery = {...target, revision: target.revision + 1, status: 'revoked', updatedAt: at};
    write(state.courseDeliveries, value); return value;
  }
  const course = exactCourse(state, edition(state, target.editionId));
  const previous = state.courseWork.find(value => value.id === target.id);
  revision(previous?.revision ?? 0, command.expectedRevision);
  const work: CourseWork = previous ? structuredClone(previous) : {
    id: target.id, revision: 0, currentUnitId: course.units[0]!.id, currentStage: 'prediction', shared: false, attempts: [], help: [], createdAt: at, updatedAt: at,
  };
  if (command.kind === 'share-course-work') work.shared = command.shared;
  else {
    const unit = course.units.find(value => value.id === command.unitId) ?? unavailable();
    work.currentUnitId = unit.id;
    if (command.kind === 'set-course-position') work.currentStage = command.stage ?? 'prediction';
    if (command.kind === 'record-course-attempt') {
      work.currentStage = command.stage;
      if (work.attempts.some(value => value.id === command.attemptId)) throw new CoreError('ALREADY_EXISTS', 'Attempt identity already exists.');
      work.attempts.push({id: command.attemptId, unitId: unit.id, unitRevision: unit.revision, stage: command.stage,
        answer: command.answer, createdAt: at, helpUsed: work.help.filter(value => value.unitId === unit.id).map(value => value.kind)});
    } else if (command.kind === 'view-course-help' && !work.help.some(value => value.unitId === unit.id && value.kind === command.help)) {
      work.help.push({unitId: unit.id, kind: command.help, firstViewedAt: at});
    }
  }
  work.revision++; work.updatedAt = at;
  write(state.courseWork, work); return work;
}

export function courseSpace(state: CoreSnapshot, actor: Actor): CourseSpace {
  const deliveries = state.courseDeliveries.filter(value => value.learnerId === actor.actorId || value.ownerId === actor.actorId);
  const editions = state.courseEditions.filter(value => value.ownerId === actor.actorId
    || deliveries.some(target => target.editionId === value.id && target.learnerId === actor.actorId && target.status === 'active'));
  return structuredClone({
    courses: state.courses.filter(value => value.ownerId === actor.actorId),
    editions: editions.map(value => ({edition: value, course: exactCourse(state, value)})), deliveries,
    work: state.courseWork.filter(work => deliveries.some(value => value.id === work.id
      && (value.learnerId === actor.actorId || value.status === 'active' && work.shared))),
  });
}

export function readCourseLesson(state: CoreSnapshot, actor: Actor, editionId: string, unitId: string) {
  const source = edition(state, editionId);
  if (source.ownerId !== actor.actorId && !state.courseDeliveries.some(value =>
    value.editionId === editionId && value.learnerId === actor.actorId && value.status === 'active')) return unavailable();
  const unit = exactCourse(state, source).units.find(value => value.id === unitId);
  if (!unit?.lesson) return unavailable();
  return projectDocumentRevision(state.events.filter((event): event is CoreEvent => 'documentId' in event), unit.lesson.documentId, unit.lesson.revision);
}

/** Replay original commands, not just the final hash. Reject forged identities, grants, revisions and private work. */
export async function validateCourseHistory(state: CoreSnapshot) {
  const replay: CoreSnapshot = {...state, courses: [], courseEditions: [], courseDeliveries: [], courseWork: [], events: []};
  for (const event of state.events) {
    if ('courseEntity' in event) {
      const actor: Actor = {actorId: event.actorId, role: event.actorRole};
      try {
        const target = courseTarget(event.payload.command);
        const value = await applyCourse(replay, actor, event.payload.command, event.occurredAt);
        const receipt = state.receipts.find(entry => entry.eventId === event.id);
        if (target.courseEntity !== event.courseEntity || target.entityId !== event.entityId || canonicalJson(value) !== canonicalJson(event.payload.value)
          || !receipt || receipt.fingerprint !== await digest({actor, command: event.payload.command})) return invalid();
      } catch {return invalid();}
    }
    replay.events.push(event);
  }
  for (const key of ['courses', 'courseEditions', 'courseDeliveries', 'courseWork'] as const) {
    if (canonicalJson(replay[key]) !== canonicalJson(state[key])) return invalid();
  }
}
