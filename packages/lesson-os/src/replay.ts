import {canonicalJson, CoreError, CoreEventSchema, EducationalObjectSchema, LessonDocumentSchema, RecordingCaptureSchema,
  type CoreEvent, type EducationalObject, type LessonDocument, type RecordingCapture} from '@ardesia/contracts';

import {projectDocumentRevision} from '@ardesia/contracts';
export {projectDocumentRevision} from '@ardesia/contracts';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function invalid(): never {throw new CoreError('INVALID_SNAPSHOT', 'Exact replay requires coherent authorized history.');}

function immutable<T>(value: T): T {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) immutable(child); Object.freeze(value);} return value;
}

/** Compile validated, immutable references once; retain the last complete scene between ink samples. */
export function createRecordingReplay(captureInput: RecordingCapture, input: readonly CoreEvent[]) {
  const capture = RecordingCaptureSchema.parse(captureInput), events = structuredClone(input);
  if (capture.timeline.length !== capture.endRevision - capture.baseRevision) return invalid();
  projectDocumentRevision(events, capture.documentId, capture.endRevision);
  const byId = new Map(events.filter(event => event.documentId === capture.documentId).map(event => [event.id, event]));
  const marks = capture.timeline.map((mark, index) => {
    const event = byId.get(mark.eventId);
    if (!event || event.documentRevision !== capture.baseRevision + index + 1) return invalid();
    let ink: Extract<EducationalObject, {type: 'ink'}> | undefined;
    if (mark.ink) {
      if (event.type !== 'add-object' || !record(event.payload)) return invalid();
      const parsed = EducationalObjectSchema.safeParse(event.payload.object);
      if (!parsed.success || parsed.data.type !== 'ink' || parsed.data.id !== mark.ink.objectId || parsed.data.revision !== mark.ink.objectRevision
        || parsed.data.data.points.length !== mark.ink.sampleTimesMs.length) return invalid();
      ink = immutable(parsed.data);
    }
    return {mark, revision: event.documentRevision, ink};
  });
  let scene = immutable(projectDocumentRevision(events, capture.documentId, capture.baseRevision));
  return {
    frame(timeMs: number): LessonDocument {
      if (!Number.isFinite(timeMs)) return invalid();
      const at = Math.max(0, Math.min(capture.durationMs, timeMs));
      let revision = capture.baseRevision;
      for (const entry of marks) {if (entry.mark.atMs > at) break; revision = entry.revision;}
      if (scene.revision !== revision) scene = immutable(projectDocumentRevision(events, capture.documentId, revision));
      const partial: EducationalObject[] = [];
      for (const {mark, ink} of marks) {
        if (!ink || !mark.ink || mark.atMs <= at || mark.ink.sampleTimesMs[0]! > at) continue;
        let low = 0, high = mark.ink.sampleTimesMs.length;
        while (low < high) {const mid = (low + high) >>> 1; if (mark.ink.sampleTimesMs[mid]! <= at) low = mid + 1; else high = mid;}
        partial.push(immutable({...ink, data: {...ink.data, points: ink.data.points.slice(0, low)}}));
      }
      return partial.length ? Object.freeze({...scene, objects: Object.freeze([...scene.objects, ...partial])}) as unknown as LessonDocument : scene;
    },
  };
}

/** One-shot projection returns an independent mutable value; playback uses the compiled immutable reader. */
export function projectRecordingFrame(capture: RecordingCapture, events: readonly CoreEvent[], timeMs: number): LessonDocument {
  return structuredClone(createRecordingReplay(capture, events).frame(timeMs));
}
