import {canonicalJson, EducationalObjectSchema, ownsWorkspace, materialPosition, type LessonDocument, type NewEducationalObject} from '@ardesia/contracts';
import {sha256} from './recordings';
import type {PendingCommand, RemoteAccount, WorkspaceProjection} from './index';

type Ink = Extract<NewEducationalObject, {type: 'ink'}>;
export interface InkRecoveryPreview {
  token: string; accountId: string; workspaceId: string; document: LessonDocument;
  entries: {recoveryId: string; object: Ink; x: number; y: number; movedAnchor: boolean; expectedRevision: number}[];
  remaining: number; stoppedReason: string | null;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Read-only, finite proposal. No command application, clock, ID generation or
 * domain authority: Core still validates every explicitly approved addition. */
export async function inkRecoveryPreview(account: RemoteAccount, source: WorkspaceProjection, pending: readonly PendingCommand[]): Promise<InkRecoveryPreview> {
  const sequence = pending.filter(entry => entry.workspaceId === source.workspaceId);
  const first = sequence[0], request = first?.request;
  const document = request?.action === 'command' ? source.documents.find(value => value.id === request.command.documentId) : undefined;
  if (!ownsWorkspace(source) || !document || !first) throw Error('Nessun tratto personale recuperabile.');
  if (document.status !== 'draft') throw Error('Questa lezione non è più modificabile. I tratti restano conservati ed esportabili.');
  const events = source.events.filter(event => event.documentId === document.id);
  const history = events.flatMap(event => record(event.payload) ? [event.payload.object, event.payload.previous] : [])
    .flatMap(candidate => {const result = EducationalObjectSchema.safeParse(candidate); return result.success ? [result.data] : [];});
  const usedIds = new Set([...document.objects, ...history].map(object => object.id));
  const sources = [...document.objects, ...history].filter(object => object.type === 'source');
  const entries: InkRecoveryPreview['entries'] = [];
  let stoppedReason: string | null = null;
  for (const entry of sequence) {
    const body = entry.request, command = body.action === 'command' ? body.command : undefined;
    const stop = (message: string) => {stoppedReason = message;};
    if (!command || command.documentId !== document.id || command.kind !== 'add-object' || command.object.type !== 'ink') {stop('La sequenza contiene un’altra modifica o lezione: recuperala separatamente.'); break;}
    if (entry.accountId !== account.id || entry.actorId !== source.actor.actorId || !entry.edit
      || canonicalJson(entry.edit.actor) !== canonicalJson(source.actor)) {stop('Lo spazio non corrisponde all’identità originale.'); break;}
    if (entry.edit.predecessorId !== (entries.at(-1)?.recoveryId ?? null)) {stop('Manca la conferma della modifica precedente.'); break;}
    if (!(entry.status === 'conflict' && entry.error?.code === 'REVISION_CONFLICT') && entry.status !== 'blocked') {stop('Verifica prima lo stesso tentativo già inviato.'); break;}
    if (entry.status === 'blocked' && ['FORBIDDEN', 'NOT_FOUND', 'INVALID_ACTOR', 'IDEMPOTENCY_CONFLICT', 'INVALID_REFERENCE'].includes(entry.error?.code ?? '')) {stop('Risolvi prima il rifiuto originale.'); break;}
    const expectedRevision = document.revision + entries.length;
    const previousRevision = entry.reconciliation?.attempts.at(-1)?.expectedRevision ?? command.expectedRevision;
    if (expectedRevision <= previousRevision) {stop('Revisione ancora valida: riprendi il tentativo esistente.'); break;}
    if ((entry.reconciliation?.attempts.length ?? 0) >= 16) {stop('Tentativi esauriti. Esporta il recupero.'); break;}
    const object = command.object;
    if (usedIds.has(object.id)) {stop('ID già presente nella lezione o nello storico. Verifica il comando originale.'); break;}
    if (document.objects.length + entries.length >= 2000) {stop('Limite di 2000 oggetti raggiunto. I tratti restano conservati.'); break;}
    if (object.provenance?.sources.some(ref => !sources.some(source => source.id === ref.sourceId && source.revision === ref.revision))) {stop('La fonte esatta non è disponibile.'); break;}
    const anchor = object.data.anchor;
    if (anchor && !document.objects.some(value => value.id === anchor.objectId && value.type === 'material')) {stop('La pagina del tratto non è disponibile.'); break;}
    const placed = materialPosition(object, document.objects);
    usedIds.add(object.id);
    entries.push({recoveryId: entry.commandId, object: structuredClone(object), x: placed.x, y: placed.y,
      movedAnchor: placed.x !== object.x || placed.y !== object.y, expectedRevision});
  }
  if (!entries.length) throw Error(stoppedReason ?? 'Nessun tratto recuperabile.');
  // Any edit, dependency, attempt, authority or workspace revision change makes
  // the decision stale. No silently updated CAS is substituted on confirmation.
  const intents = sequence.map(({error: _error, ...entry}) => entry);
  const token = await sha256(new TextEncoder().encode(canonicalJson({account, source, intents})).buffer);
  return {token, accountId: account.id, workspaceId: source.workspaceId, document: structuredClone(document), entries,
    remaining: sequence.length - entries.length, stoppedReason};
}
