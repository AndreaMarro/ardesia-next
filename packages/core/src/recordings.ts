import {ActorSchema, canonicalJson, CoreError, EducationalObjectSchema, RecordingCaptureSchema,
  RecordingCommandSchema, RecordingStateSchema, type Actor, type RecordingCapture, type RecordingPart, type RecordingState} from '@ardesia/contracts';
import type {CoreService} from './index';

/** Recording metadata is an aggregate of the same Core; the server persists media effects separately. */
export function validateRecordingCapture(core: Pick<CoreService, 'getDocument' | 'events'>, actor: Actor, input: unknown): RecordingCapture {
  const parsed = RecordingCaptureSchema.safeParse(input);
  if (!parsed.success) throw new CoreError('INVALID_COMMAND', 'Recording metadata violates its versioned contract.');
  const capture = parsed.data, document = core.getDocument(actor, capture.documentId);
  if (document.ownerId !== actor.actorId) throw new CoreError('FORBIDDEN', 'Only the lesson owner can save a personal recording.');
  if (capture.endRevision > document.revision) throw new CoreError('REVISION_CONFLICT', 'Recording references a document revision not yet confirmed.');
  const events = core.events(actor, document.id).sort((a, b) => a.documentRevision - b.documentRevision);
  if (capture.timeline.length !== capture.endRevision - capture.baseRevision) throw new CoreError('INVALID_REFERENCE', 'A recording must account for every lesson revision in its interval.');
  for (let index = 0; index < capture.timeline.length; index++) {
    const mark = capture.timeline[index]!, event = events.find(event => event.documentRevision === capture.baseRevision + index + 1);
    if (!event || event.id !== mark.eventId) throw new CoreError('INVALID_REFERENCE', 'Recording markers must refer to the exact authorized Core events, in order.');
    if (mark.ink) {
      const payload = event.payload;
      const object = EducationalObjectSchema.safeParse(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.object : null);
      if (event.type !== 'add-object' || !object.success || object.data.type !== 'ink'
        || object.data.id !== mark.ink.objectId || object.data.revision !== mark.ink.objectRevision
        || object.data.data.points.length !== mark.ink.sampleTimesMs.length) {
        throw new CoreError('INVALID_REFERENCE', 'Ink timing must describe every sample of the exact added stroke.');
      }
    }
  }
  if (!events.some(event => event.documentRevision === capture.baseRevision)) throw new CoreError('INVALID_REFERENCE', 'The exact initial lesson revision is unavailable.');
  return structuredClone(capture);
}

async function sha(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

/** Domain transition only. The existing server transaction writes this aggregate and media effects together. */
export async function applyRecordingCommand(core: Pick<CoreService, 'getDocument' | 'events'>, actorInput: Actor, current: RecordingState | null,
  commandInput: unknown, uploadedParts: readonly RecordingPart[], now: string): Promise<{state: RecordingState; receipt: RecordingState['receipts'][number]}> {
  const actor = ActorSchema.parse(actorInput), parsed = RecordingCommandSchema.safeParse(commandInput);
  if (!parsed.success) throw new CoreError('INVALID_COMMAND', 'Recording command violates its contract.');
  const command = parsed.data;
  let state = current === null ? null : RecordingStateSchema.parse(current);
  if (state && (state.summary.recordingId !== command.recordingId || state.summary.ownerId !== actor.actorId)) throw new CoreError('NOT_FOUND', 'Recording unavailable.');
  const documentId = state?.summary.documentId ?? (command.kind === 'prepare-recording' ? command.capture.documentId : null);
  if (!documentId) throw new CoreError('NOT_FOUND', 'Recording unavailable.');
  core.getDocument(actor, documentId); // Reauthorize even an identical retry after erasure or session change.
  const fingerprint = await sha({actor, command}), prior = state?.receipts.find(receipt => receipt.commandId === command.commandId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new CoreError('IDEMPOTENCY_CONFLICT', 'The recording command ID already identifies a different payload.');
    return {state: structuredClone(state!), receipt: structuredClone(prior)};
  }
  if ((state?.summary.revision ?? 0) !== command.expectedRevision) throw new CoreError('REVISION_CONFLICT', 'Recording revision changed.');
  if (state?.summary.status === 'erased') throw new CoreError('NOT_FOUND', 'Recording has been erased; media cannot be resurrected.');
  if (command.kind === 'prepare-recording') {
    if (state || command.capture.recordingId !== command.recordingId) throw new CoreError('INVALID_REFERENCE', 'Recording identity differs from its capture.');
    const capture = validateRecordingCapture(core, actor, command.capture);
    state = {format: 'ardesia-recording-state-v1', summary: {recordingId: command.recordingId, documentId, ownerId: actor.actorId,
      title: capture.title, capturedAt: capture.capturedAt, createdAt: now, revision: 1, status: 'uploading',
      durationMs: capture.durationMs, mediaDigest: null}, capture, transcripts: [], receipts: []};
  } else {
    if (!state?.capture) throw new CoreError('NOT_FOUND', 'Recording unavailable.');
    if (command.kind === 'finish-recording') {
      if (state.summary.status !== 'uploading') throw new CoreError('INVALID_COMMAND', 'Recording is already finalized.');
      validateRecordingCapture(core, actor, state.capture);
      if (canonicalJson(uploadedParts) !== canonicalJson(state.capture.parts)) throw new CoreError('INVALID_REFERENCE', 'Not every exact media part is available.');
      state.summary.status = 'ready'; state.summary.mediaDigest = await sha({mimeType: state.capture.mimeType, parts: state.capture.parts});
    } else if (command.kind === 'edit-recording-transcript') {
      if (state.summary.status !== 'ready') throw new CoreError('INVALID_COMMAND', 'A transcript requires a finalized recording.');
      let from = 0; const ids = new Set<string>();
      for (const cue of command.cues) {
        if (cue.fromMs < from || cue.toMs > state.capture.durationMs || ids.has(cue.id)) throw new CoreError('INVALID_REFERENCE', 'Transcript cues must have unique identities and ordered timecodes within the recording.');
        from = cue.fromMs; ids.add(cue.id);
      }
      state.transcripts.push({revision: state.transcripts.length + 1, origin: command.origin, cues: command.cues, updatedBy: actor.actorId, updatedAt: now});
    } else {
      state.capture = null; state.transcripts = [];
      state.summary = {...state.summary, status: 'erased', title: 'Registrazione rimossa', durationMs: null};
    }
    state.summary.revision++;
  }
  const receipt = {commandId: command.commandId, recordingId: command.recordingId, actorId: actor.actorId, revision: state.summary.revision, fingerprint};
  state.receipts.push(receipt);
  return {state: RecordingStateSchema.parse(state), receipt: structuredClone(receipt)};
}
