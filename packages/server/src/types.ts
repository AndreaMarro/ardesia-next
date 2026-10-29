import type {
  Actor, CoreEvent, LessonDocument, PluginInstallation, LessonAssignment,
  LearnerWork, LearningEvent, AssignedLabAccess,
} from '@ardesia/contracts';

export interface Account { id: string; role: 'teacher' | 'student'; displayName: string; }
export interface Session { account: Account; expiresAt: string; }
export interface WorkspaceSummary { workspaceId: string; title: string; workspaceRevision: number; }
/** This is a permission-filtered view. It is deliberately not a CoreSnapshot. */
export interface WorkspaceProjection extends WorkspaceSummary {
  actor: Actor;
  documents: LessonDocument[];
  assignedDocuments: LessonDocument[];
  installations: PluginInstallation[];
  events: CoreEvent[];
  assignments: LessonAssignment[];
  learnerWork: LearnerWork[];
  learningEvents: LearningEvent[];
  labAccess: AssignedLabAccess[];
}
