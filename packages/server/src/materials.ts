import type {PoolClient} from 'pg';
import {CoreError, MaterialStateSchema, canonicalJson, type Actor, type MaterialState} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';
import type {AuthenticatedRequest} from './requests';
import type {Account} from './types';
import {mediaHash} from './recordings';
import {unavailable} from './errors';

type Request = Extract<AuthenticatedRequest, {action: 'prepare-material' | 'put-material-part' | 'finish-material' | 'read-material' | 'read-material-part'}>;
export function verifyMaterialBytes(state: MaterialState, parts: {part_index: number; sha256: string; bytes: Buffer}[]): void {
  const manifest = state.manifest;
  if (parts.length !== manifest.parts.length || parts.some((part, i) => part.part_index !== i || part.sha256 !== manifest.parts[i]?.sha256
    || part.bytes.length !== manifest.parts[i]?.bytes || mediaHash(part.bytes) !== part.sha256)) throw new CoreError('INVALID_REFERENCE', 'Material upload is incomplete or corrupt.');
  const bytes = Buffer.concat(parts.map(part => part.bytes));
  if (bytes.length !== manifest.bytes || mediaHash(bytes) !== manifest.sha256) throw new CoreError('INVALID_REFERENCE', 'Original material checksum mismatch.');
  const valid = manifest.mimeType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : manifest.mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : manifest.mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw new CoreError('INVALID_REFERENCE', 'Material signature does not match its declared format.');
}

/** Existing authenticated workspace transaction; binary data never enter Core events. */
export async function materialRequest(client: PoolClient, account: Account, core: CoreService, actor: Actor, input: Request): Promise<unknown> {
  const id = input.action === 'prepare-material' ? input.manifest.assetId : input.assetId;
  const row = (await client.query('SELECT workspace_id,owner_account_id,state FROM ardesia_next.materials WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (row && row.workspace_id !== input.workspaceId) throw unavailable();
  let state: MaterialState | null = row ? MaterialStateSchema.parse(row.state) : null;
  const documentId = state?.manifest.documentId ?? (input.action === 'prepare-material' ? input.manifest.documentId : null);
  if (!documentId) throw unavailable();
  const reading = input.action === 'read-material' || input.action === 'read-material-part';
  let document;
  try {document = reading && input.course ? await core.readCourseLesson(actor, input.course.editionId, input.course.unitId) : core.getDocument(actor, documentId);}
  catch(error){if(reading&&!input.course&&actor.role==='student')document=core.getAssignedDocument(actor,documentId);else throw error;}
  if (document.id !== documentId) throw unavailable();
  if (!reading && document.ownerId !== actor.actorId) throw unavailable();
  if (reading && document.ownerId !== actor.actorId && !document.objects.some(o => o.type === 'material' && o.data.assetId === id && o.data.sha256 === state?.manifest.sha256)) throw unavailable();
  if (input.action === 'prepare-material') {
    if (state) {
      if (row.owner_account_id !== account.id || canonicalJson(state.manifest) !== canonicalJson(input.manifest)) throw new CoreError('IDEMPOTENCY_CONFLICT', 'This material identity already has another original.');
      return state;
    }
    const total = (await client.query("SELECT COALESCE(sum((state->'manifest'->>'bytes')::bigint),0) AS total FROM ardesia_next.materials WHERE workspace_id=$1", [input.workspaceId])).rows[0];
    if (Number(total.total) + input.manifest.bytes > 256 * 1024 * 1024) throw new CoreError('INVALID_COMMAND', 'This workspace has reached its local material storage quota (256 MiB).');
    state = MaterialStateSchema.parse({manifest: input.manifest, status: 'uploading', ownerId: actor.actorId, createdAt: new Date().toISOString()});
    await client.query('INSERT INTO ardesia_next.materials(id,workspace_id,owner_account_id,document_id,state) VALUES($1,$2,$3,$4,$5::jsonb)', [id,input.workspaceId,account.id,documentId,JSON.stringify(state)]);
    return state;
  }
  if (!state) throw unavailable();
  if (input.action === 'finish-material') {
    const parts = (await client.query('SELECT part_index,sha256,bytes FROM ardesia_next.material_parts WHERE asset_id=$1 ORDER BY part_index', [id])).rows;
    verifyMaterialBytes(state, parts); state = {...state, status: 'ready'};
    await client.query('UPDATE ardesia_next.materials SET state=$2::jsonb WHERE id=$1', [id,JSON.stringify(state)]); return state;
  }
  if (input.action === 'read-material') {if (state.status !== 'ready') throw unavailable(); return state;}
  const part = state.manifest.parts[input.index]; if (!part) throw unavailable();
  if (input.action === 'put-material-part') {
    const bytes = Buffer.from(input.base64, 'base64');
    if (bytes.toString('base64') !== input.base64 || bytes.length !== part.bytes || mediaHash(bytes) !== part.sha256) throw new CoreError('INVALID_REFERENCE', 'Material chunk checksum mismatch.');
    const prior = (await client.query('SELECT bytes FROM ardesia_next.material_parts WHERE asset_id=$1 AND part_index=$2', [id, input.index])).rows[0];
    if (prior) {if (!bytes.equals(prior.bytes)) throw new CoreError('IDEMPOTENCY_CONFLICT', 'Immutable material bytes differ.'); return part;}
    if (state.status !== 'uploading') throw new CoreError('READ_ONLY', 'The original material is immutable.');
    await client.query('INSERT INTO ardesia_next.material_parts(asset_id,part_index,sha256,bytes) VALUES($1,$2,$3,$4)',[id,input.index,part.sha256,bytes]);return part;
  }
  if (state.status !== 'ready') throw unavailable();
  const stored = (await client.query('SELECT bytes FROM ardesia_next.material_parts WHERE asset_id=$1 AND part_index=$2',[id,input.index])).rows[0];
  if (!stored || stored.bytes.length !== part.bytes || mediaHash(stored.bytes) !== part.sha256) throw new CoreError('INVALID_SNAPSHOT','Material bytes failed integrity verification.');
  return {part, base64: stored.bytes.toString('base64')};
}
