import {CoreCommandSchema, type NewEducationalObject} from '@ardesia/contracts';

export type InkDraft = {object: Extract<NewEducationalObject, {type: 'ink'}>; sampleTimes: number[]};
export type InkDraftScope = {accountId: string; workspaceId: string; documentId: string};
export interface InkDraftAccess {
  read(): InkDraft[]; write(draft: InkDraft): void; remove(objectId: string): void; release(objectId: string): void; exportRaw(): string;
  recover(objectId: string, apply: (draft: InkDraft) => Promise<boolean>): Promise<boolean>;
}
export interface InkDraftStorage {
  read(scope: InkDraftScope, objectId?: string): InkDraft[];
  write(scope: InkDraftScope, draft: InkDraft): void;
  remove(scope: InkDraftScope, objectId: string): void;
  exportRaw(scope: InkDraftScope): string;
  release(scope: InkDraftScope, objectId: string): void;
  recover(scope: InkDraftScope, objectId: string, apply: (draft: InkDraft) => Promise<boolean>): Promise<boolean>;
}
const invalid = (): never => {throw Error('Bozza del tratto non valida. I byte originali sono conservati.');};
export function parseInkDraft(input: unknown): InkDraft {
  if (!input || typeof input !== 'object') return invalid();
  const value = input as Partial<InkDraft>;
  const command = CoreCommandSchema.safeParse({kind: 'add-object', commandId: 'draft', documentId: 'draft', expectedRevision: 0, object: value.object});
  if (!command.success || command.data.kind !== 'add-object' || command.data.object.type !== 'ink'
    || !Array.isArray(value.sampleTimes) || value.sampleTimes.length !== command.data.object.data.points.length) return invalid();
  let previous = -Infinity;
  for (const time of value.sampleTimes) {if (!Number.isFinite(time) || time < previous) return invalid(); previous = time;}
  return {object: command.data.object, sampleTimes: [...value.sampleTimes]};
}

/** In-progress pointer samples only. This is not an authorized document or a
 * mutable command: the immutable Core recovery queue takes over on completion.
 * One atomic value per gesture keeps concurrent tabs independent. */
export function browserInkDraftStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, locks: Pick<LockManager, 'request'> | null | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks): InkDraftStorage {
  const prefix = (scope: InkDraftScope) => 'ardesia-next.ink-draft.v1.' + [scope.accountId, scope.workspaceId, scope.documentId].map(encodeURIComponent).join('/') + '/';
  // A live gesture keeps an origin-wide Web Lock. No time-based lease: a
  // suspended tab must not lose ownership of samples it can still complete.
  const active = new Map<string, () => void>();
  const keyOf = (scope: InkDraftScope, id: string) => prefix(scope) + encodeURIComponent(id);
  const release = (key: string) => {active.get(key)?.(); active.delete(key);};
  const lockKey = (key: string) => 'ardesia:ink:' + key;
  return {
    release(scope, id) {release(keyOf(scope, id));},
    async recover(scope, id, apply) {
      if (!locks) throw Error('Recupero esclusivo non disponibile in questo browser. Esporta i tratti conservati.');
      const key = keyOf(scope, id);
      return locks.request(lockKey(key), {ifAvailable: true}, async lock => {
        if (!lock) return false;
        // Reread after acquiring: another tab may already have handed off or
        // removed this checkpoint since the recovery list was displayed.
        const raw = storage.getItem(key); if (raw === null) return true;
        let value: unknown; try {value = JSON.parse(raw);} catch {return invalid();}
        const draft = parseInkDraft(value); if (draft.object.id !== id) return invalid();
        const confirmed = await apply(draft);
        if (confirmed && storage.getItem(key) === raw) storage.removeItem(key);
        return confirmed;
      });
    },
    exportRaw(scope) {
      const start=prefix(scope), rows: [string,string][]=[];
      for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(start)){const raw=storage.getItem(key);if(raw!==null)rows.push([key,raw]);}}
      return JSON.stringify({format:'ardesia-ink-draft-recovery-v1',scope,rows});
    },
    read(scope, objectId) {
      const start = prefix(scope), result: InkDraft[] = [];
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {const key = storage.key(i); if (key?.startsWith(start) && (objectId===undefined || key===keyOf(scope,objectId))) keys.push(key);}
      for (const key of keys) {
        const raw = storage.getItem(key); if (raw === null) continue;
        let parsed: unknown; try {parsed = JSON.parse(raw);} catch {return invalid();}
        const draft = parseInkDraft(parsed);
        if (key !== start + encodeURIComponent(draft.object.id)) return invalid();
        result.push(draft);
      }
      return result;
    },
    write(scope, input) {
      const draft = parseInkDraft(input), key = keyOf(scope, draft.object.id);
      if (locks && !active.has(key)) {
        let unlock!: () => void; const held = new Promise<void>(resolve => {unlock = resolve;}); active.set(key, unlock);
        // Queue the lock before exposing the first checkpoint. Recovery uses
        // the same queue, so it cannot overtake this writer.
        void locks.request(lockKey(key), {ifAvailable: true}, async lock => {if (lock) await held;})
          .catch(() => undefined);
      }
      storage.setItem(key, JSON.stringify(draft));
    },
    remove(scope, objectId) {const key = keyOf(scope, objectId); storage.removeItem(key); release(key);},
  };
}
