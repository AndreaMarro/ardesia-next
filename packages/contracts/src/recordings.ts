import {z} from 'zod';

export const RECORDING_VERSION = 1 as const;
export const RECORDING_PART_BYTES = 512 * 1024;
export const RECORDING_MAX_PARTS = 1024;
export const RECORDING_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const revision = z.number().int().positive();
const time = z.number().finite().nonnegative().max(RECORDING_MAX_DURATION_MS);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const RecordingMimeSchema = z.enum(['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/ogg;codecs=opus',
  'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/wav']);
export type RecordingMime = z.infer<typeof RecordingMimeSchema>;
export const RecordingPartSchema = z.object({
  index: z.number().int().nonnegative().max(RECORDING_MAX_PARTS - 1), sha256: digest,
  bytes: z.number().int().positive().max(RECORDING_PART_BYTES),
}).strict();
export type RecordingPart = z.infer<typeof RecordingPartSchema>;

/** Times are measured in the recording's media clock, never wall-clock event timestamps. */
export const RecordingMarkSchema = z.object({
  eventId: id, atMs: time, timing: z.enum(['captured', 'observed']),
  ink: z.object({objectId: id, objectRevision: revision, sampleTimesMs: z.array(time).min(1).max(20_000)}).strict().optional(),
}).strict();
export type RecordingMark = z.infer<typeof RecordingMarkSchema>;
export const RecordingCaptureSchema = z.object({
  format: z.literal('ardesia-recording-v1'), recordingId: id, documentId: id,
  title: z.string().trim().min(1).max(240), capturedAt: z.iso.datetime(),
  baseRevision: revision, endRevision: revision, durationMs: time.positive(), mimeType: RecordingMimeSchema,
  parts: z.array(RecordingPartSchema).min(1).max(RECORDING_MAX_PARTS),
  timeline: z.array(RecordingMarkSchema).max(10_000),
}).strict().superRefine((capture, context) => {
  const issue = (message: string) => context.addIssue({code: 'custom', message});
  if (capture.endRevision < capture.baseRevision) issue('The recording cannot precede its base revision.');
  if (capture.parts.some((part, index) => part.index !== index)) issue('Media parts must be complete and ordered from zero.');
  let previous = 0; const ids = new Set<string>();
  for (const mark of capture.timeline) {
    if (ids.has(mark.eventId) || mark.atMs < previous || mark.atMs > capture.durationMs) issue('Timeline marks must be unique, ordered and within the audio.');
    ids.add(mark.eventId); previous = mark.atMs;
    if (mark.ink) {
      let prior = 0;
      for (const time of mark.ink.sampleTimesMs) {if (time < prior || time > mark.atMs) issue('Ink samples must be ordered before their committed marker.'); prior = time;}
    }
  }
});
export type RecordingCapture = z.infer<typeof RecordingCaptureSchema>;
export const TranscriptCueSchema = z.object({
  id, fromMs: time, toMs: time, text: z.string().trim().min(1).max(10_000),
}).strict().refine(cue => cue.toMs > cue.fromMs, 'A transcript cue needs a positive interval.');
export type TranscriptCue = z.infer<typeof TranscriptCueSchema>;
export const RecordingTranscriptSchema = z.object({
  revision, origin: z.enum(['manual', 'imported']),
  cues: z.array(TranscriptCueSchema).max(10_000), updatedBy: id, updatedAt: z.iso.datetime(),
}).strict();
export type RecordingTranscript = z.infer<typeof RecordingTranscriptSchema>;
export const RecordingSummarySchema = z.object({
  recordingId: id, documentId: id, ownerId: id, title: z.string().max(240), revision,
  status: z.enum(['uploading', 'ready', 'erased']), capturedAt: z.iso.datetime(), createdAt: z.iso.datetime(),
  durationMs: time.nullable(), mediaDigest: digest.nullable(),
}).strict();
export type RecordingSummary = z.infer<typeof RecordingSummarySchema>;
export const RecordingReceiptSchema = z.object({
  commandId: id, recordingId: id, actorId: id, revision, fingerprint: digest,
}).strict();
export type RecordingReceipt = z.infer<typeof RecordingReceiptSchema>;
export const RecordingStateSchema = z.object({
  format: z.literal('ardesia-recording-state-v1'), summary: RecordingSummarySchema,
  capture: RecordingCaptureSchema.nullable(), transcripts: z.array(RecordingTranscriptSchema).max(10_000),
  receipts: z.array(RecordingReceiptSchema).max(10_000),
}).strict().superRefine((state, context) => {
  const issue = (message: string) => context.addIssue({code: 'custom', message});
  if (state.summary.revision !== state.receipts.length || new Set(state.receipts.map(receipt => receipt.commandId)).size !== state.receipts.length
    || state.receipts.some((receipt, index) => receipt.recordingId !== state.summary.recordingId || receipt.actorId !== state.summary.ownerId || receipt.revision !== index + 1)) issue('Recording receipts must account for every revision.');
  if (state.transcripts.some((transcript, index) => transcript.revision !== index + 1 || transcript.updatedBy !== state.summary.ownerId)) issue('Transcript versions must be contiguous and owned.');
  if (state.summary.status === 'erased') {
    if (state.capture !== null || state.transcripts.length || state.summary.durationMs !== null) issue('Erasure must remove media metadata and every transcript version.');
  } else if (!state.capture || state.capture.recordingId !== state.summary.recordingId || state.capture.documentId !== state.summary.documentId
    || state.capture.title !== state.summary.title || state.capture.capturedAt !== state.summary.capturedAt || state.capture.durationMs !== state.summary.durationMs) issue('The recording capture must match its owner summary.');
  for (const transcript of state.transcripts) {
    let previous = 0; const ids = new Set<string>();
    for (const cue of transcript.cues) {
      if (cue.fromMs < previous || !state.capture || cue.toMs > state.capture.durationMs || ids.has(cue.id)) issue('Transcript cues must be unique, ordered and within the recording.');
      previous = cue.fromMs; ids.add(cue.id);
    }
  }
  if (state.summary.status === 'ready' && !state.summary.mediaDigest) issue('A ready recording requires verified media identity.');
  if (state.summary.status === 'uploading' && (state.summary.mediaDigest || state.transcripts.length || state.summary.revision !== 1)) issue('An upload is not a published recording.');
});
export type RecordingState = z.infer<typeof RecordingStateSchema>;
const command = {commandId: id, recordingId: id, expectedRevision: z.number().int().nonnegative()};
export const RecordingCommandSchema = z.discriminatedUnion('kind', [
  z.object({...command, kind: z.literal('prepare-recording'), expectedRevision: z.literal(0), capture: RecordingCaptureSchema}).strict(),
  z.object({...command, kind: z.literal('finish-recording')}).strict(),
  z.object({...command, kind: z.literal('edit-recording-transcript'), origin: z.enum(['manual', 'imported']), cues: z.array(TranscriptCueSchema).max(10_000)}).strict(),
  z.object({...command, kind: z.literal('erase-recording')}).strict(),
]);
export type RecordingCommand = z.infer<typeof RecordingCommandSchema>;

export const RecordingSearchSchema = z.object({
  total: z.number().int().nonnegative(),
  matches: z.array(z.object({recordingId: id, documentId: id, recordingRevision: revision, title: z.string(),
    atMs: time, transcriptRevision: z.number().int().nonnegative(), excerpt: z.string()}).strict()).max(100),
}).strict();
export type RecordingSearch = z.infer<typeof RecordingSearchSchema>;
