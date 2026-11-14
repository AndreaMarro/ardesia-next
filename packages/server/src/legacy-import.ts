import {CoreError, CoreSnapshotSchema, migrateSnapshotForOpen} from '@ardesia/contracts';
import {hash} from './database';
import {canonical} from './errors';

/** Device import identity is frozen at v4. New Core versions do not create new imports
 * of the same source or invalidate historical archives; original bytes remain separate. */
export function parseLegacyImport(text: string) {
  let raw: unknown;
  try {raw = JSON.parse(text);} catch {throw new CoreError('INVALID_SNAPSHOT', 'The import is not a JSON snapshot.');}
  if (!raw || typeof raw !== 'object' || !('schemaVersion' in raw) || ![1, 2, 3].includes(Number(raw.schemaVersion))) {
    throw new CoreError('INVALID_SNAPSHOT', 'Only explicit device snapshots v1, v2 and v3 are supported by this importer.');
  }
  const parsed = CoreSnapshotSchema.safeParse(migrateSnapshotForOpen(raw));
  if (!parsed.success) throw new CoreError('INVALID_SNAPSHOT', 'The source violates version, revision, identity or ledger integrity.');
  const snapshot = parsed.data;
  // Valid v1–v3 have no learning streams. Migration only adds empty collections and a version tag.
  const {notebookLibraries: _notebooks, tutorRecords: _tutor, courses: _courses, courseEditions: _editions, courseDeliveries: _deliveries, courseWork: _work, ...legacy} = snapshot;
  const semanticDigest = hash(canonical({...legacy, schemaVersion: 4}));
  return {snapshot, semanticDigest, sourceVersion: Number(raw.schemaVersion), sourceWorkspaceId: snapshot.workspaceId};
}
