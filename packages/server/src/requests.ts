import {z} from 'zod';
import {CoreCommandSchema, PluginCommandSchema, LearningCommandSchema} from '@ardesia/contracts';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const title = z.string().trim().min(1).max(240);
export const RequestSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('login'), username: z.string().trim().toLowerCase().min(3).max(64), password: z.string().min(1).max(256)}).strict(),
  z.object({action: z.literal('logout')}).strict(),
  z.object({action: z.literal('session')}).strict(),
  z.object({action: z.literal('list-workspaces')}).strict(),
  z.object({action: z.literal('create-workspace'), title, commandId: id}).strict(),
  z.object({action: z.literal('open-workspace'), workspaceId: id}).strict(),
  z.object({action: z.literal('command'), workspaceId: id, command: CoreCommandSchema}).strict(),
  z.object({action: z.literal('plugin-command'), workspaceId: id, command: PluginCommandSchema}).strict(),
  z.object({action: z.literal('learning-command'), workspaceId: id, command: LearningCommandSchema}).strict(),
  z.object({action: z.literal('import-local'), expectedAccountId: id, commandId: id, title, snapshotText: z.string().min(1).max(2_000_000)}).strict(),
  z.object({action: z.literal('export-personal'), workspaceId: id}).strict(),
]);
export type ApiRequest = z.infer<typeof RequestSchema>;
export type AuthenticatedRequest = Exclude<ApiRequest, {action: 'login'}>;
