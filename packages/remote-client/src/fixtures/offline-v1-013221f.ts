// Historical reader fixture from 013221ffc7812073cb490ef2ba6b9000b445b568.
// Original SHA256: 7007d8a6411537a80986a6e429365adc7449ab6f2aea54d44d589cac0189d04d
// Only relative imports are adjusted; runtime logic is unchanged.
import type {MaterialDraft} from '../materials';
import {MaterialStateSchema,MaterialManifestSchema,NewObjectSchema,canonicalJson,type MaterialState} from '@ardesia/contracts';
import {sha256} from '../recordings';
import {ActorSchema, LessonDocumentSchema, type Actor, type LessonDocument} from '@ardesia/contracts';

/** A local reading copy. It never supplies a server identity or a permission. */
export interface OfflineSnapshot {
  format: 'ardesia-own-lessons-v1';
  account: {id: string; role: Actor['role']; displayName: string};
  workspaceId: string; title: string; workspaceRevision: number; actor: Actor;
  documents: LessonDocument[]; savedAt: string;
}
export interface OfflineGate {
  generation: string; accountId: string | null; role: 'teacher' | 'student' | null; signedOut: boolean; workspaceId: string | null;
}
export interface OfflineStore {
  saveMaterialDraft?(generation:string,accountId:string,workspaceId:string,draft:MaterialDraft):Promise<void>;
  loadMaterialDraft?(generation:string,accountId:string,workspaceId:string,documentId:string):Promise<MaterialDraft|null>;
  clearMaterialDraft?(generation:string,accountId:string,workspaceId:string,documentId:string,assetId:string):Promise<void>;
  putMaterial?(generation: string, accountId: string, workspaceId: string, state: MaterialState, blob: Blob): Promise<void>;
  getMaterial?(generation: string, accountId: string, workspaceId: string, assetId: string): Promise<{state: MaterialState; blob: Blob} | null>;
  gate(): Promise<OfflineGate>;
  close(expectedGeneration?: string): Promise<OfflineGate>;
  confirm(generation: string, accountId: string, role: 'teacher' | 'student', explicitLogin: boolean): Promise<OfflineGate>;
  save(generation: string, snapshot: OfflineSnapshot, enable?: boolean): Promise<boolean>;
  load(): Promise<{gate: OfflineGate; snapshot: OfflineSnapshot} | null>;
  subscribe?(listener: () => void): () => void;
}
export class OfflineError extends Error {
  constructor(readonly code: string, message: string) {super(message); this.name = 'OfflineError';}
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(v);
const invalid = (): never => {throw new OfflineError('INVALID_OFFLINE_COPY', 'Copia offline non valida. Gli originali sono conservati.');};
const changed = (): never => {throw new OfflineError('SESSION_CHANGED', 'Accesso locale chiuso o cambiato in un’altra scheda.');};
export function parseOfflineSnapshot(value: unknown): OfflineSnapshot {
  try {
    if (!object(value) || value.format !== 'ardesia-own-lessons-v1' || !object(value.account)
      || !id(value.account.id) || !['teacher','student'].includes(String(value.account.role)) || typeof value.account.displayName !== 'string'
      || !id(value.workspaceId) || typeof value.title !== 'string' || !Number.isSafeInteger(value.workspaceRevision) || Number(value.workspaceRevision) < 0
      || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || !Array.isArray(value.documents)) return invalid();
    const actor = ActorSchema.parse(value.actor), documents = value.documents.map(item => LessonDocumentSchema.parse(item));
    if (actor.role !== value.account.role || documents.some(d => d.ownerId !== actor.actorId)
      || new Set(documents.map(d => d.id)).size !== documents.length) return invalid();
    // Select fields explicitly; never restore extra projection fields as authority.
    return {format: 'ardesia-own-lessons-v1', account: {id: value.account.id, role: actor.role, displayName: value.account.displayName},
      workspaceId: value.workspaceId, title: value.title, workspaceRevision: value.workspaceRevision as number, actor, documents, savedAt: value.savedAt};
  } catch {return invalid();}
}
function parseGate(value: unknown): OfflineGate {
  if (!object(value) || !id(value.generation) || typeof value.signedOut !== 'boolean'
    || !(value.role === null || value.role === 'teacher' || value.role === 'student') || !(value.accountId === null || id(value.accountId)) || !(value.workspaceId === null || id(value.workspaceId))) return invalid();
  return {generation: value.generation, accountId: value.accountId, role: value.role as OfflineGate['role'], signedOut: value.signedOut, workspaceId: value.workspaceId};
}

/** IndexedDB serializes the read/compare/write transaction across browser tabs. */
export function browserOfflineStore(factory: IDBFactory, name = 'ardesia-next.offline.v1'): OfflineStore {
  let database: Promise<IDBDatabase> | undefined;
  const listeners = new Set<() => void>();
  // Notifications only speed up invalidation. Every protected operation reads the gate.
  const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(name) : null;
  if (channel) channel.onmessage = () => {for (const listener of listeners) listener();};
  function open() {
    return database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {request.result.createObjectStore('local');};
      request.onsuccess = () => {request.result.onversionchange = () => {request.result.close(); database = undefined;}; resolve(request.result);};
      request.onerror = () => {database = undefined; reject(new OfflineError('OFFLINE_STORAGE_FAILURE', 'Archivio offline non accessibile.'));};
      request.onblocked = () => {database = undefined; reject(new OfflineError('OFFLINE_STORAGE_FAILURE', 'Chiudi le altre schede per aggiornare l’archivio offline.'));};
    });
  }
  function notify() {channel?.postMessage('changed');}
  async function transaction<T>(operation: (store: IDBObjectStore, gate: OfflineGate, result: (value: T) => void) => void): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('local', 'readwrite'), store = tx.objectStore('local');
      let value: T, failure: unknown;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure ?? new OfflineError('OFFLINE_STORAGE_FAILURE', 'Copia offline non salvata. Conserva una copia esportata.'));
      tx.onerror = () => { /* onabort reports the final transaction outcome. */ };
      const gateRequest = store.get('gate');
      gateRequest.onsuccess = () => {
        try {
          const gate = gateRequest.result === undefined
            ? {generation: crypto.randomUUID(), accountId: null, role: null, signedOut: false, workspaceId: null} : parseGate(gateRequest.result);
          if (gateRequest.result === undefined) store.put(gate, 'gate');
          operation(store, gate, next => {value = next;});
        } catch (error) {failure = error; tx.abort();}
      };
    });
  }
  return {
    async saveMaterialDraft(generation,accountId,workspaceId,input){
      const manifest=MaterialManifestSchema.parse(input.manifest),objects=input.objects.map(o=>NewObjectSchema.parse(o)),blob=input.blob;
      if(!(blob instanceof Blob)||blob.size!==manifest.bytes||await sha256(await blob.arrayBuffer())!==manifest.sha256||objects.some(o=>o.type!=='material'||o.data.assetId!==manifest.assetId||o.data.sha256!==manifest.sha256))return invalid();
      return transaction<void>((store,gate,done)=>{
        if(gate.generation!==generation||gate.signedOut||gate.accountId!==accountId)return changed();
        const key=['material-draft',accountId,workspaceId,manifest.documentId],prior=store.get(key);
        prior.onsuccess=()=>{if(prior.result&&(canonicalJson(prior.result.manifest)!==canonicalJson(manifest)||canonicalJson(prior.result.objects)!==canonicalJson(objects))){store.transaction.abort();return;}store.put({manifest,objects,blob},key);done();};
      });
    },
    async loadMaterialDraft(generation,accountId,workspaceId,documentId){
      const draft=await transaction<MaterialDraft|null>((store,gate,done)=>{
        if(gate.generation!==generation||gate.signedOut||gate.accountId!==accountId)return changed();
        const request=store.get(['material-draft',accountId,workspaceId,documentId]);request.onsuccess=()=>{try{if(!request.result){done(null);return;}const value=request.result,manifest=MaterialManifestSchema.parse(value.manifest),objects=value.objects.map((o:unknown)=>NewObjectSchema.parse(o));if(manifest.documentId!==documentId||!(value.blob instanceof Blob))return invalid();done({manifest,objects,blob:value.blob});}catch{store.transaction.abort();}};
      });
      if(draft&&(draft.blob.size!==draft.manifest.bytes||await sha256(await draft.blob.arrayBuffer())!==draft.manifest.sha256))return invalid();return draft;
    },
    async clearMaterialDraft(generation,accountId,workspaceId,documentId,assetId){
      return transaction<void>((store,gate,done)=>{if(gate.generation!==generation||gate.signedOut||gate.accountId!==accountId)return changed();const key=['material-draft',accountId,workspaceId,documentId],request=store.get(key);request.onsuccess=()=>{if(request.result?.manifest.assetId===assetId)store.delete(key);done();};});
    },
    async putMaterial(generation,accountId,workspaceId,input,blob) {
      const state=MaterialStateSchema.parse(input);
      if(state.status!=='ready'||blob.size!==state.manifest.bytes||await sha256(await blob.arrayBuffer())!==state.manifest.sha256)return invalid();
      return transaction<void>((store,gate,done)=>{
        if(gate.generation!==generation||gate.signedOut||gate.accountId!==accountId)return changed();
        store.put({state,blob},['material',accountId,workspaceId,state.manifest.assetId]);done();
      });
    },
    async getMaterial(generation,accountId,workspaceId,assetId) {
      const found=await transaction<{state:MaterialState;blob:Blob}|null>((store,gate,done)=>{
        if(gate.generation!==generation||gate.signedOut||gate.accountId!==accountId||gate.workspaceId!==workspaceId)return changed();
        const request=store.get(['material',accountId,workspaceId,assetId]);
        request.onsuccess=()=>{try{if(!request.result){done(null);return;}const state=MaterialStateSchema.parse(request.result.state),blob=request.result.blob;
          if(state.manifest.assetId!==assetId||!(blob instanceof Blob))return invalid();done({state,blob});}catch{store.transaction.abort();}};
      });
      if(found&&(found.state.status!=='ready'||found.blob.size!==found.state.manifest.bytes||await sha256(await found.blob.arrayBuffer())!==found.state.manifest.sha256))return invalid();
      return found;
    },
    gate: () => transaction((_store, gate, done) => done(gate)),
    async close(expectedGeneration) {
      const result = await transaction<OfflineGate>((store, gate, done) => {
        if (expectedGeneration && gate.generation !== expectedGeneration) {done(gate); return;}
        const closed: OfflineGate = {generation: crypto.randomUUID(), accountId: null, role: null, signedOut: true, workspaceId: null};
        store.put(closed, 'gate'); done(closed);
      }); notify(); return result;
    },
    async confirm(generation, accountId, role, explicitLogin) {
      const result = await transaction<OfflineGate>((store, gate, done) => {
        if (gate.generation !== generation || (!explicitLogin && gate.signedOut) || gate.accountId && gate.accountId !== accountId || gate.role && gate.role !== role) return changed();
        if (!id(accountId)) return invalid();
        const next = {...gate, signedOut: false, accountId, role}; store.put(next, 'gate'); done(next);
      }); notify(); return result;
    },
    async save(generation, input, enable = false) {
      const snapshot = parseOfflineSnapshot(input);
      return transaction<boolean>((store, gate, done) => {
        if (gate.generation !== generation || gate.signedOut || gate.accountId !== snapshot.account.id || gate.role !== snapshot.account.role) return changed();
        if (!enable && gate.workspaceId !== snapshot.workspaceId) {done(false); return;}
        const key = ['snapshot', snapshot.account.id, snapshot.workspaceId];
        const previous = store.get(key);
        previous.onsuccess = () => {
          try {
            const old = previous.result === undefined ? null : parseOfflineSnapshot(previous.result);
            if (old && (old.account.id !== snapshot.account.id || old.workspaceId !== snapshot.workspaceId || old.actor.actorId !== snapshot.actor.actorId)) return invalid();
            if (!old || snapshot.workspaceRevision > old.workspaceRevision) store.put(snapshot, key);
            // A same-revision result may only refresh the timestamp, never the data.
            else if (snapshot.workspaceRevision === old.workspaceRevision) {
              if (JSON.stringify({...old, savedAt: ''}) !== JSON.stringify({...snapshot, savedAt: ''})) return invalid();
              if (snapshot.savedAt > old.savedAt) store.put(snapshot, key);
            }
            if (enable) store.put({...gate, workspaceId: snapshot.workspaceId}, 'gate');
            done(true);
          } catch (error) { /* Abort preserves the previous copy, including corrupt bytes. */
            store.transaction.abort();
          }
        };
      });
    },
    load: () => transaction<{gate: OfflineGate; snapshot: OfflineSnapshot} | null>((store, gate, done) => {
      if (gate.signedOut || !gate.role || !gate.accountId || !gate.workspaceId) {done(null); return;}
      const request = store.get(['snapshot', gate.accountId, gate.workspaceId]);
      request.onsuccess = () => {
        try {
          const snapshot = parseOfflineSnapshot(request.result);
          if (snapshot.account.id !== gate.accountId || snapshot.account.role !== gate.role || snapshot.workspaceId !== gate.workspaceId) return invalid();
          done({gate, snapshot});
        } catch {store.transaction.abort();}
      };
    }),
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
  };
}
