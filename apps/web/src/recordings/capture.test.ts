import {describe, it, expect, vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {AudioCapture, browserTakeStore, finalizeTake, type TakeStore, type LocalTake} from './capture';
import type {CoreEvent} from '@ardesia/contracts';

const input = {accountId: 'owner', workspaceId: 'workspace', documentId: 'lesson', title: 'Audio', baseRevision: 1};
const deferred = <T,>() => {let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => {resolve = done; reject = fail;}); return {promise, resolve, reject};};
function stream() {const track = {stop: vi.fn(), addEventListener: vi.fn()}; return {track, media: {getTracks: () => [track]} as unknown as MediaStream};}
class Recorder {
  static isTypeSupported = () => true;
  ondataavailable: ((event: {data: Blob}) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  static instances: Recorder[] = [];
  constructor() {Recorder.instances.push(this);}
  start() {}
  stop() {this.ondataavailable?.({data: new Blob(['synthetic-media'])}); this.onstop?.();}
}
function storage(): TakeStore {
  const takes = new Map<string, LocalTake>(), parts = new Map<string, Blob[]>();
  return {list: async (owner, workspace, document) => [...takes.values()].filter(t => t.accountId === owner && t.workspaceId === workspace && t.documentId === document),
    save: vi.fn(async (take, part) => {takes.set(take.id, structuredClone(take)); if (part) {const list = parts.get(take.id) ?? []; list[part.index] = part.blob; parts.set(take.id, list);}}),
    audio: async take => new Blob(parts.get(take.id)), remove: async id => {takes.delete(id); parts.delete(id);}};
}
describe('microphone consent and durable audio recovery', () => {
  it('stops a late microphone stream after consent withdrawal without starting the recorder', async () => {
    const pending = deferred<MediaStream>(), source = stream(), before = Recorder.instances.length;
    const capture = new AudioCapture(storage(), vi.fn(), {getUserMedia: () => pending.promise}, Recorder as unknown as typeof MediaRecorder);
    const starting = capture.start(input); expect(capture.status).toBe('requesting'); capture.cancelPermission();
    pending.resolve(source.media); await starting;
    expect(source.track.stop).toHaveBeenCalledOnce(); expect(capture.status).toBe('idle'); expect(Recorder.instances.length).toBe(before);
  });
  it('late recovery preparation from cancelled A never releases the new B stream', async () => {
    const firstSave = deferred<void>(), sourceA = stream(), sourceB = stream(), store = storage();
    vi.mocked(store.save).mockImplementationOnce(() => firstSave.promise);
    const capture = new AudioCapture(store, vi.fn(), {getUserMedia: vi.fn().mockResolvedValueOnce(sourceA.media).mockResolvedValueOnce(sourceB.media)}, Recorder as unknown as typeof MediaRecorder);
    const a = capture.start(input); await vi.waitFor(() => expect(store.save).toHaveBeenCalledOnce()); capture.cancelPermission();
    await capture.start(input); expect(capture.status).toBe('recording');
    firstSave.resolve(); await a;
    expect(sourceA.track.stop).toHaveBeenCalled(); expect(sourceB.track.stop).not.toHaveBeenCalled(); expect(capture.status).toBe('recording');
    capture.stop(); await vi.waitFor(() => expect(capture.status).toBe('idle'));
  });
  it('begins from the revision at actual media start and freezes elapsed time at stop', async () => {
    const source = stream(), store = storage(); let clock = 1000;
    const capture = new AudioCapture(store, vi.fn(), {getUserMedia: async () => source.media}, Recorder as unknown as typeof MediaRecorder, () => clock);
    await capture.start(input, () => 3); clock = 2500; capture.stop(); clock = 8000;
    await vi.waitFor(() => expect(capture.status).toBe('idle'));
    const [take] = await store.list('owner', 'workspace', 'lesson');
    expect(take).toMatchObject({baseRevision: 3, endRevision: 3, durationMs: 1500, complete: true, chunkCount: 1});
    expect(await (await store.audio(take!)).text()).toBe('synthetic-media');
  });
  it('never starts recording if durable storage is unavailable', async () => {
    const source = stream(), store = storage(), before = Recorder.instances.length;
    vi.mocked(store.save).mockRejectedValue(Error('Quota exceeded'));
    const capture = new AudioCapture(store, vi.fn(), {getUserMedia: async () => source.media}, Recorder as unknown as typeof MediaRecorder);
    await expect(capture.start(input)).rejects.toThrow('Quota'); expect(capture.status).toBe('idle'); expect(source.track.stop).toHaveBeenCalled();
    expect(Recorder.instances.length).toBe(before + 1); // Created but start() was never called.
  });
  it('reopens local metadata and audio in a new store while isolating accounts and workspaces', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const take: LocalTake = {...input, id: 'take', capturedAt: '2026-11-07T10:00:00.000Z', endRevision: 1, durationMs: 1000,
      mimeType: 'audio/webm', complete: true, chunkCount: 2, observed: [], strokes: []};
    const first = browserTakeStore(); await first.save({...take, chunkCount: 1}, {index: 0, blob: new Blob(['first'])});
    await first.save(take, {index: 1, blob: new Blob(['second'])});
    const reopened = browserTakeStore(); expect(await reopened.list('other', 'workspace', 'lesson')).toEqual([]);
    expect(await reopened.list('owner', 'other', 'lesson')).toEqual([]);
    expect(await reopened.list('owner', 'workspace', 'lesson')).toEqual([take]);
    expect(await (await reopened.audio(take)).text()).toBe('firstsecond');
    const partial = {...take, id: 'partial', complete: false};
    await first.save(partial, {index: 0, blob: new Blob(['only durable fragment'])});
    await expect(reopened.audio(partial)).rejects.toThrow();
    expect(await (await reopened.audio(partial, true)).text()).toBe('only durable fragment');
    vi.unstubAllGlobals();
  });
  it('never labels missing final media as complete and keeps durable fragments exportable', async () => {
    const store = storage(), source = stream(), failure = deferred<void>(); let clock = 0;
    const original = store.save;
    store.save = vi.fn(async (take, part) => {if (part?.index === 1) return failure.promise; return original(take, part);});
    const capture = new AudioCapture(store, vi.fn(), {getUserMedia: async () => source.media}, Recorder as unknown as typeof MediaRecorder, () => clock);
    await capture.start(input); clock = 1000;
    Recorder.instances.at(-1)!.ondataavailable?.({data: new Blob(['durable'])});
    await vi.waitFor(() => expect(store.save).toHaveBeenCalledTimes(2));
    clock = 2000; capture.stop(); await vi.waitFor(() => expect(store.save).toHaveBeenCalledTimes(3));
    // Simulate the last chunk failing after stop, followed by successful metadata persistence.
    failure.reject(Error('Quota'));
    await vi.waitFor(() => expect(capture.status).toBe('idle'));
    const [take] = await store.list('owner', 'workspace', 'lesson'); expect(take?.complete).toBe(false);
    expect(await capture.memoryAudio()!.text()).toBe('durablesynthetic-media');
  });
  it('waits for original ink to be confirmed, then pins its exact event and samples', async () => {
    const take: LocalTake = {...input, id: 'take', capturedAt: '2026-11-07T10:00:00.000Z', endRevision: 1, durationMs: 1000,
      mimeType: 'audio/webm', complete: true, chunkCount: 1, observed: [], strokes: [{objectId: 'ink', sampleTimesMs: [300, 700]}]};
    const audio = new Blob(['audio']);
    await expect(finalizeTake(take, audio, [])).rejects.toThrow('Conferma le annotazioni');
    const events = [{id: 'e2', actorId: 'owner', sequence: 2, occurredAt: '2026-11-07T10:00:00.000Z', documentId: 'lesson', documentRevision: 2, type: 'add-object', payload: {object: {id: 'ink', revision: 1}}}] as CoreEvent[];
    const capture = await finalizeTake(take, audio, events);
    expect(capture.endRevision).toBe(2); expect(capture.timeline).toEqual([{eventId: 'e2', atMs: 700, timing: 'captured', ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [300, 700]}}]);
    expect(await finalizeTake({...take, capture}, audio, [])).toEqual(capture);
  });
});
