import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {CoreError, RecordingStateSchema, type Actor, type RecordingState, type RecordingSearch} from '@ardesia/contracts';
import {applyRecordingCommand, type CoreService} from '@ardesia/core';
import type {Account} from './types';
import type {AuthenticatedRequest} from './requests';
import {unavailable} from './errors';

type Request = Extract<AuthenticatedRequest, {action: 'search-recordings' | 'list-recordings' | 'read-recording' | 'recording-command' | 'put-recording-part' | 'read-recording-part'}>;
export const mediaHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Called only inside the existing authenticated, workspace-locked transaction. */
export async function recordingRequest(client: PoolClient, account: Account, core: CoreService, actor: Actor, input: Request): Promise<unknown> {
  if (input.action === 'list-recordings' || input.action === 'search-recordings') {
    if (input.documentId) core.getDocument(actor, input.documentId);
    const rows = await client.query('SELECT state FROM ardesia_next.recordings WHERE workspace_id=$1 AND owner_account_id=$2 AND ($3::text IS NULL OR document_id=$3) ORDER BY created_at DESC,id', [input.workspaceId, account.id, input.documentId ?? null]);
    const states = rows.rows.map(row => RecordingStateSchema.parse(row.state));
    for (const state of states) core.getDocument(actor, state.summary.documentId);
    if (input.action === 'list-recordings') return states.map(state => state.summary).filter(summary => summary.status !== 'erased');
    const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('it'), query = normalize(input.query);
    const matches: RecordingSearch['matches'] = [];
    for (const state of states.filter(state => state.summary.status === 'ready')) {
      const transcript = state.transcripts.at(-1), summary = state.summary;
      const base = {recordingId: summary.recordingId, documentId: summary.documentId, recordingRevision: summary.revision, title: summary.title, transcriptRevision: transcript?.revision ?? 0};
      if (normalize(summary.title).includes(query)) matches.push({...base, atMs: 0, excerpt: summary.title});
      for (const cue of transcript?.cues ?? []) {
        const position = normalize(cue.text).indexOf(query);
        if (position >= 0) matches.push({...base, atMs: cue.fromMs, excerpt: cue.text.slice(Math.max(0, position - 40), position + 200)});
      }
    }
    return {total: matches.length, matches: matches.slice(0, 100)};
  }
  const id = input.action === 'recording-command' ? input.command.recordingId : input.recordingId;
  // Global IDs cannot be rebound to another workspace. Absence and foreign ownership are indistinguishable.
  const row = (await client.query('SELECT workspace_id,owner_account_id,state FROM ardesia_next.recordings WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (row && (row.workspace_id !== input.workspaceId || row.owner_account_id !== account.id)) throw unavailable();
  const state = row ? RecordingStateSchema.parse(row.state) : null;
  if (state) core.getDocument(actor, state.summary.documentId);
  if (input.action === 'recording-command') {
    const parts = input.command.kind === 'finish-recording'
      ? (await client.query('SELECT part_index AS index,sha256,octet_length(bytes) AS bytes FROM ardesia_next.recording_parts WHERE recording_id=$1 ORDER BY part_index', [id])).rows : [];
    const result = await applyRecordingCommand(core, actor, state, input.command, parts, new Date().toISOString());
    if (row) await client.query('UPDATE ardesia_next.recordings SET state=$2::jsonb,updated_at=now() WHERE id=$1', [id, JSON.stringify(result.state)]);
    else await client.query('INSERT INTO ardesia_next.recordings(id,workspace_id,owner_account_id,document_id,state) VALUES($1,$2,$3,$4,$5::jsonb)', [id, input.workspaceId, account.id, result.state.summary.documentId, JSON.stringify(result.state)]);
    if (result.state.summary.status === 'erased') await client.query('DELETE FROM ardesia_next.recording_parts WHERE recording_id=$1', [id]);
    return result;
  }
  if (!state?.capture || state.summary.status === 'erased') throw unavailable();
  if (input.action === 'read-recording') return state;
  const part = state.capture.parts[input.index];
  if (!part) throw unavailable();
  if (input.action === 'put-recording-part') {
    const bytes = Buffer.from(input.base64, 'base64');
    if (bytes.toString('base64') !== input.base64 || bytes.byteLength !== part.bytes || mediaHash(bytes) !== part.sha256) {
      throw new CoreError('INVALID_REFERENCE', 'Media bytes do not match the immutable recording manifest.');
    }
    const prior = (await client.query('SELECT sha256,bytes FROM ardesia_next.recording_parts WHERE recording_id=$1 AND part_index=$2', [id, input.index])).rows[0];
    if (prior) {
      if (prior.sha256 !== part.sha256 || !bytes.equals(prior.bytes)) throw new CoreError('IDEMPOTENCY_CONFLICT', 'This media part already has different bytes.');
      return part;
    }
    if (state.summary.status !== 'uploading') throw new CoreError('INVALID_COMMAND', 'Finalized media cannot be modified.');
    await client.query('INSERT INTO ardesia_next.recording_parts(recording_id,part_index,sha256,bytes) VALUES($1,$2,$3,$4)', [id, input.index, part.sha256, bytes]);
    return part;
  }
  if (state.summary.status !== 'ready') throw unavailable();
  const saved = (await client.query('SELECT bytes,sha256 FROM ardesia_next.recording_parts WHERE recording_id=$1 AND part_index=$2', [id, input.index])).rows[0];
  if (!saved || saved.sha256 !== part.sha256 || mediaHash(saved.bytes) !== part.sha256 || saved.bytes.length !== part.bytes) {
    throw new CoreError('INVALID_SNAPSHOT', 'The media part failed integrity verification.');
  }
  return {part, base64: saved.bytes.toString('base64')};
}
