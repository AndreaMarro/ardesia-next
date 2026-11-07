import {RecordingSearchSchema, type RecordingSearch, RecordingCommandSchema, RecordingPartSchema, RecordingStateSchema, RecordingSummarySchema, RecordingReceiptSchema,
  type RecordingCommand, type RecordingState, type RecordingPart, type RecordingSummary} from '@ardesia/contracts';

export interface RecordingAccess {
  readonly accountId: string; readonly workspaceId: string;
  search(documentId: string, query: string): Promise<RecordingSearch>;
  list(documentId: string): Promise<RecordingSummary[]>;
  read(recordingId: string): Promise<RecordingState>;
  command(command: RecordingCommand): Promise<RecordingState>;
  upload(recordingId: string, part: RecordingPart, bytes: Blob): Promise<void>;
  download(state: RecordingState): Promise<Blob>;
}
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const invalid = (): never => {throw Error('Audio o risposta non coerente: i dati originali sono conservati.');};
function base64(bytes: Uint8Array): string {let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text);}

/** Bound to one authenticated account/selection epoch by the existing Remote Client. */
export function recordingAccess(accountId: string, workspaceId: string, send: (input: Record<string, unknown>) => Promise<unknown>, authorize: () => Promise<void>): RecordingAccess {
  return {
    accountId, workspaceId,
    async search(documentId, query) {return RecordingSearchSchema.parse(await send({action: 'search-recordings', workspaceId, documentId, query}));},
    async list(documentId) {
      const value = await send({action: 'list-recordings', workspaceId, documentId});
      if (!Array.isArray(value)) return invalid();
      const items = value.map(item => RecordingSummarySchema.parse(item));
      if (items.some(item => item.documentId !== documentId)) return invalid(); return items;
    },
    async read(recordingId) {
      const state = RecordingStateSchema.parse(await send({action: 'read-recording', workspaceId, recordingId}));
      if (state.summary.recordingId !== recordingId) return invalid(); return state;
    },
    async command(input) {
      const command = RecordingCommandSchema.parse(input), value = await send({action: 'recording-command', workspaceId, command});
      if (!record(value)) return invalid();
      const receipt = RecordingReceiptSchema.parse(value.receipt), state = RecordingStateSchema.parse(value.state);
      if (receipt.commandId !== command.commandId || receipt.recordingId !== command.recordingId || state.summary.recordingId !== command.recordingId) return invalid();
      return state;
    },
    async upload(recordingId, part, blob) {
      const bytes = await blob.arrayBuffer();
      if (bytes.byteLength !== part.bytes || await sha256(bytes) !== part.sha256) return invalid();
      const saved = RecordingPartSchema.parse(await send({action: 'put-recording-part', workspaceId, recordingId, index: part.index, base64: base64(new Uint8Array(bytes))}));
      if (saved.index !== part.index || saved.sha256 !== part.sha256 || saved.bytes !== part.bytes) return invalid();
    },
    async download(state) {
      if (state.summary.status !== 'ready' || !state.capture) return invalid();
      const parts: Uint8Array<ArrayBuffer>[] = [];
      for (const part of state.capture.parts) {
        const value = await send({action: 'read-recording-part', workspaceId, recordingId: state.summary.recordingId, index: part.index});
        if (!record(value) || typeof value.base64 !== 'string') return invalid();
        const bytes = Uint8Array.from(atob(value.base64), char => char.charCodeAt(0));
        if (bytes.byteLength !== part.bytes || await sha256(bytes.buffer) !== part.sha256) return invalid();
        parts.push(bytes);
      }
      await authorize();
      return new Blob(parts, {type: state.capture.mimeType});
    },
  };
}
