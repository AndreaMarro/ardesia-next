import {z} from 'zod';
import {MaterialManifestSchema, TutorCommandSchema, CourseCommandSchema, CoreCommandSchema, PluginCommandSchema, LearningCommandSchema, RecordingCommandSchema, RECORDING_PART_BYTES, RECORDING_MAX_PARTS} from '@ardesia/contracts';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const title = z.string().trim().min(1).max(240);
export const RequestSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('prepare-material'), workspaceId: id, manifest: MaterialManifestSchema}).strict(),
  z.object({action: z.literal('finish-material'), workspaceId: id, assetId: id}).strict(),
  z.object({action: z.literal('put-material-part'), workspaceId: id, assetId: id, index: z.number().int().min(0).max(63), base64: z.string().min(4).max(699052)}).strict(),
  z.object({action: z.literal('read-material'), workspaceId: id, assetId: id, course: z.object({editionId: id, unitId: id}).strict().optional()}).strict(),
  z.object({action: z.literal('read-material-part'), workspaceId: id, assetId: id, index: z.number().int().min(0).max(63), course: z.object({editionId: id, unitId: id}).strict().optional()}).strict(),
  z.object({action: z.literal('login'), username: z.string().trim().toLowerCase().min(3).max(64), password: z.string().min(1).max(256)}).strict(),
  z.object({action: z.literal('logout')}).strict(),
  z.object({action: z.literal('session')}).strict(),
  z.object({action: z.literal('list-workspaces')}).strict(),
  z.object({action: z.literal('create-workspace'), title, commandId: id}).strict(),
  z.object({action: z.literal('open-workspace'), workspaceId: id}).strict(),
  z.object({action: z.literal('command'), workspaceId: id, command: CoreCommandSchema}).strict(),
  z.object({action: z.literal('plugin-command'), workspaceId: id, command: PluginCommandSchema}).strict(),
  z.object({action: z.literal('tutor-command'), workspaceId: id, command: TutorCommandSchema}).strict(),
  z.object({action: z.literal('course-command'), workspaceId: id, command: CourseCommandSchema}).strict(),
  z.object({action: z.literal('read-course-lesson'), workspaceId: id, editionId: id, unitId: id}).strict(),
  z.object({action: z.literal('learning-command'), workspaceId: id, command: LearningCommandSchema}).strict(),
  z.object({action: z.literal('read-attempt-source'), workspaceId: id, documentId: id, attemptId: id, studentId: id.optional()}).strict(),
  z.object({action: z.literal('import-local'), expectedAccountId: id, commandId: id, title, snapshotText: z.string().min(1).max(2_000_000)}).strict(),
  z.object({action: z.literal('export-personal'), workspaceId: id}).strict(),
  z.object({action: z.literal('search-recordings'), workspaceId: id, documentId: id, query: z.string().trim().min(1).max(200)}).strict(),
  z.object({action: z.literal('list-recordings'), workspaceId: id, documentId: id}).strict(),
  z.object({action: z.literal('read-recording'), workspaceId: id, recordingId: id}).strict(),
  z.object({action: z.literal('recording-command'), workspaceId: id, command: RecordingCommandSchema}).strict(),
  z.object({action: z.literal('put-recording-part'), workspaceId: id, recordingId: id,
    index: z.number().int().min(0).max(RECORDING_MAX_PARTS - 1), base64: z.string().min(4).max(Math.ceil(RECORDING_PART_BYTES / 3) * 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)}).strict(),
  z.object({action: z.literal('read-recording-part'), workspaceId: id, recordingId: id, index: z.number().int().min(0).max(RECORDING_MAX_PARTS - 1)}).strict(),
]);
export type ApiRequest = z.infer<typeof RequestSchema>;
export type AuthenticatedRequest = Exclude<ApiRequest, {action: 'login'}>;
