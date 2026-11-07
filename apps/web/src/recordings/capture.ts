import {RecordingCaptureSchema, RECORDING_MAX_DURATION_MS, RECORDING_PART_BYTES, RECORDING_MAX_PARTS,
  type CoreEvent, type RecordingCapture, type RecordingMime} from '@ardesia/contracts';
import {sha256} from '@ardesia/remote-client';

export interface LocalTake {
  id: string; accountId: string; workspaceId: string; documentId: string; title: string; capturedAt: string;
  baseRevision: number; endRevision: number; durationMs: number; mimeType: RecordingMime; complete: boolean; chunkCount: number;
  observed: {eventId: string; revision: number; atMs: number}[];
  strokes: {objectId: string; sampleTimesMs: number[]}[];
  capture?: RecordingCapture;
}
export interface TakeStore {
  list(accountId: string, workspaceId: string, documentId: string): Promise<LocalTake[]>;
  save(take: LocalTake, chunk?: {index: number; blob: Blob}): Promise<void>;
  audio(take: LocalTake, allowPartial?: boolean): Promise<Blob>;
  remove(id: string): Promise<void>;
}
export function browserTakeStore(): TakeStore {
  let opened: Promise<IDBDatabase> | undefined;
  const db = () => opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('ardesia-next-audio-recovery-v1', 1);
    request.onupgradeneeded = () => {request.result.createObjectStore('takes', {keyPath: 'id'}); request.result.createObjectStore('chunks', {keyPath: ['takeId', 'index']});};
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  async function transaction<T>(mode: IDBTransactionMode, operation: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['takes', 'chunks'], mode); let value: T;
      tx.oncomplete = () => resolve(value); tx.onerror = tx.onabort = () => reject(tx.error ?? Error('Salvataggio locale audio non riuscito.'));
      try {operation(tx, result => {value = result;});} catch (error) {tx.abort(); reject(error);}
    });
  }
  return {
    list: (accountId, workspaceId, documentId) => transaction('readonly', (tx, done) => {
      const request = tx.objectStore('takes').getAll(); request.onsuccess = () => done((request.result as LocalTake[]).filter(take => take.accountId === accountId && take.workspaceId === workspaceId && take.documentId === documentId));
    }),
    save: (take, chunk) => transaction('readwrite', tx => {tx.objectStore('takes').put(structuredClone(take)); if (chunk) tx.objectStore('chunks').put({takeId: take.id, ...chunk});}),
    audio: (take, allowPartial = false) => transaction('readonly', (tx, done) => {
      const parts: Blob[] = []; let received = 0;
      if (!take.chunkCount) {done(new Blob()); return;}
      for (let index = 0; index < take.chunkCount; index++) {
        const request = tx.objectStore('chunks').get([take.id, index]); request.onsuccess = () => {
          if (!request.result?.blob && !allowPartial) {tx.abort(); return;}
          if (request.result?.blob) parts[index] = request.result.blob;
          received++;
          if (received === take.chunkCount) done(new Blob(parts.filter(Boolean), {type: take.mimeType}));
        };
      }
    }),
    remove: id => transaction('readwrite', tx => {
      tx.objectStore('takes').delete(id);
      const cursor = tx.objectStore('chunks').openCursor(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
      cursor.onsuccess = () => {if (cursor.result) {cursor.result.delete(); cursor.result.continue();}};
    }),
  };
}

export type CaptureStatus = 'idle' | 'requesting' | 'recording' | 'stopping';
/** A consent generation invalidates every late permission response. No AI or server in the capture path. */
export class AudioCapture {
  status: CaptureStatus = 'idle';
  private generation = 0; private recorder: MediaRecorder | null = null; private stream: MediaStream | null = null;
  private started = 0; private take: LocalTake | null = null; private writes = Promise.resolve(); private error: unknown;
  private timer: ReturnType<typeof setTimeout> | undefined; private buffers: Blob[] = [];
  constructor(private store: TakeStore, private notify: (status: CaptureStatus, error?: unknown) => void,
    private devices: Pick<MediaDevices, 'getUserMedia'> = navigator.mediaDevices, private Recorder: typeof MediaRecorder = MediaRecorder,
    private clock = () => performance.now()) {}
  private publish(status: CaptureStatus) {this.status = status; this.notify(status, this.error);}
  private release() {this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; clearTimeout(this.timer);}
  private write(chunk?: Blob) {
    const take = this.take!; const index = take.chunkCount;
    if (chunk?.size) {take.chunkCount++; this.buffers.push(chunk);}
    const snapshot = structuredClone(take);
    this.writes = this.writes.then(() => this.store.save(snapshot, chunk?.size ? {index, blob: chunk} : undefined))
      .catch(error => {this.error = error; this.notify(this.status, error);});
  }
  async start(input: Pick<LocalTake, 'accountId' | 'workspaceId' | 'documentId' | 'title' | 'baseRevision'>, currentRevision = () => input.baseRevision) {
    if (this.status !== 'idle') throw Error('Una registrazione è già in corso.');
    const generation = ++this.generation; this.error = undefined; this.publish('requesting');
    try {
      const stream = await this.devices.getUserMedia({audio: {echoCancellation: true}, video: false});
      if (generation !== this.generation) {stream.getTracks().forEach(track => track.stop()); return;}
      this.stream = stream;
      const mimeType = (['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'] as const).find(type => this.Recorder.isTypeSupported(type));
      if (!mimeType) throw Error('Questo browser non offre un formato audio supportato.');
      const recorder = new this.Recorder(stream, {mimeType}); this.recorder = recorder;
      this.take = {...input, id: crypto.randomUUID(), capturedAt: new Date().toISOString(), endRevision: input.baseRevision,
        durationMs: 0, mimeType, complete: false, chunkCount: 0, observed: [], strokes: []};
      // A writable recovery target is a precondition, before recording any sound.
      await this.store.save(this.take);
      if (generation !== this.generation) {stream.getTracks().forEach(track => track.stop()); return;}
      this.take.baseRevision = this.take.endRevision = currentRevision();
      this.buffers = []; this.started = this.clock();
      recorder.ondataavailable = event => {if (event.data.size && this.take) {if (this.status === 'recording') this.take.durationMs = Math.min(RECORDING_MAX_DURATION_MS, Math.max(this.take.durationMs, this.clock() - this.started)); this.write(event.data);}};
      recorder.onerror = () => {this.error = Error('Registrazione interrotta dal browser. Conserva i frammenti disponibili.'); this.stop();};
      recorder.onstop = () => {this.release(); this.recorder = null;
        void this.writes.then(() => {if (this.take) {this.take.complete = !this.error; this.write();} return this.writes;}).then(() => this.publish('idle'));};
      recorder.start(1000); this.publish('recording');
      stream.getTracks().forEach(track => track.addEventListener('ended', () => this.stop(), {once: true}));
      this.timer = setTimeout(() => this.stop(), RECORDING_MAX_DURATION_MS);
    } catch (error) {if (generation === this.generation) {this.release(); this.recorder = null; this.error = error; this.publish('idle');} throw error;}
  }
  cancelPermission() {++this.generation; if (this.status === 'requesting') {this.release(); this.recorder = null; this.publish('idle');} else this.stop();}
  stop() {
    if (this.status === 'requesting') {this.cancelPermission(); return;}
    if (this.status !== 'recording') return;
    this.publish('stopping'); if (this.take) this.take.durationMs = Math.max(1, Math.min(RECORDING_MAX_DURATION_MS, this.clock() - this.started));
    this.recorder?.stop(); this.release();
  }
  ink(objectId: string, timestamps: number[]) {
    if (this.status !== 'recording' || !this.take) return;
    this.take.strokes.push({objectId, sampleTimesMs: timestamps.map(time => Math.max(0, Math.min(RECORDING_MAX_DURATION_MS, time - this.started)))});
  }
  observe(events: readonly CoreEvent[]) {
    if (!this.take || this.status !== 'recording') return;
    for (const event of events.filter(event => event.documentId === this.take!.documentId && event.documentRevision > this.take!.endRevision).sort((a, b) => a.documentRevision - b.documentRevision)) {
      this.take.observed.push({eventId: event.id, revision: event.documentRevision, atMs: Math.min(RECORDING_MAX_DURATION_MS, this.clock() - this.started)});
      this.take.endRevision = event.documentRevision;
    }
  }
  /** Memory fallback remains exportable if durable storage failed. Never presented as saved. */
  memoryAudio() {return this.take ? new Blob(this.buffers, {type: this.take.mimeType}) : null;}
}

/** Build once, then retain the immutable manifest across lost replies and retries. */
export async function finalizeTake(take: LocalTake, audio: Blob, events: readonly CoreEvent[]): Promise<RecordingCapture> {
  if (take.capture) return RecordingCaptureSchema.parse(take.capture);
  if (!take.complete || !audio.size) throw Error('Registrazione incompleta: esporta i frammenti locali disponibili.');
  if (audio.size > RECORDING_PART_BYTES * RECORDING_MAX_PARTS) throw Error('Audio troppo grande per questo caricamento: esporta l’originale.');
  const relevant = events.filter(event => event.documentId === take.documentId).sort((a, b) => a.documentRevision - b.documentRevision);
  let endRevision = take.endRevision;
  for (const stroke of take.strokes) {
    const event = relevant.find(event => event.type === 'add-object' && (event.payload as {object?: {id?: string}}).object?.id === stroke.objectId);
    if (!event) throw Error('Conferma le annotazioni nel pannello di recupero prima di archiviare l’audio.');
    endRevision = Math.max(endRevision, event.documentRevision);
  }
  let prior = 0;
  const timeline = relevant.filter(event => event.documentRevision > take.baseRevision && event.documentRevision <= endRevision).map(event => {
    const object = (event.payload as {object?: {id?: string; revision?: number}}).object;
    const stroke = event.type === 'add-object' ? take.strokes.find(stroke => stroke.objectId === object?.id) : undefined;
    const observed = take.observed.find(mark => mark.eventId === event.id)?.atMs ?? take.durationMs;
    const samples = stroke?.sampleTimesMs.map(time => Math.min(take.durationMs, time));
    const atMs = Math.max(prior, Math.min(take.durationMs, samples?.at(-1) ?? observed)); prior = atMs;
    return {eventId: event.id, atMs, timing: stroke ? 'captured' as const : 'observed' as const,
      ...(samples && object?.id && object.revision ? {ink: {objectId: object.id, objectRevision: object.revision, sampleTimesMs: samples}} : {})};
  });
  const parts = [];
  for (let offset = 0; offset < audio.size; offset += RECORDING_PART_BYTES) {
    const bytes = await audio.slice(offset, offset + RECORDING_PART_BYTES).arrayBuffer();
    parts.push({index: parts.length, bytes: bytes.byteLength, sha256: await sha256(bytes)});
  }
  return RecordingCaptureSchema.parse({format: 'ardesia-recording-v1', recordingId: take.id, documentId: take.documentId,
    title: take.title, capturedAt: take.capturedAt, baseRevision: take.baseRevision, endRevision, durationMs: take.durationMs, mimeType: take.mimeType, parts, timeline});
}
