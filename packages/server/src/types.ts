import type {
  TutorSpace, CourseSpace, Actor, CoreEvent, LessonDocument, PluginInstallation, LessonAssignment,
  LearnerWork, LearningEvent, AssignedLabAccess, WorkspaceAccess,
} from '@ardesia/contracts';

export interface Account { id: string; role: 'teacher' | 'student'; displayName: string; }
export interface Session { account: Account; expiresAt: string; }
export interface WorkspaceSummary { workspaceId: string; title: string; workspaceRevision: number; access: WorkspaceAccess; }
/** This is a permission-filtered view. It is deliberately not a CoreSnapshot. */
export interface WorkspaceProjection extends WorkspaceSummary {
  actor: Actor;
  tutorSpace: TutorSpace;
  courseSpace: CourseSpace;
  documents: LessonDocument[];
  assignedDocuments: LessonDocument[];
  installations: PluginInstallation[];
  events: CoreEvent[];
  assignments: LessonAssignment[];
  learnerWork: LearnerWork[];
  learningEvents: LearningEvent[];
  labAccess: AssignedLabAccess[];
}
