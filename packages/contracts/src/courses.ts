import {z} from 'zod';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const revision = z.number().int().positive();
const title = z.string().trim().min(1).max(240);
const text = z.string().trim().max(10_000);
const timestamp = z.iso.datetime();
export const CourseSourceSchema = z.object({
  title, url: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)),
  revision: z.string().trim().min(1).max(300), license: z.string().trim().min(1).max(300),
}).strict();
/** A lesson link grants only this exact revision through an active course delivery. */
export const CourseUnitInputSchema = z.object({
  id, title, objective: text, prerequisites: text, explanation: text,
  prediction: text, activity: text, referenceFeedback: text, recovery: text, transfer: text,
  sources: z.array(CourseSourceSchema).max(32),
  lesson: z.object({documentId: id, revision}).strict().nullable(),
}).strict();
export const CourseUnitSchema = CourseUnitInputSchema.extend({revision}).strict();
export const CourseInputSchema = z.object({
  title, description: text, license: z.string().trim().min(1).max(300),
  units: z.array(CourseUnitInputSchema).min(1).max(100),
}).strict().refine(value => new Set(value.units.map(unit => unit.id)).size === value.units.length, 'Unit IDs must be unique');
export const CourseSchema = z.object({
  id, ownerId: id, revision, status: z.literal('draft'), title, description: text,
  license: z.string().trim().min(1).max(300), units: z.array(CourseUnitSchema).min(1).max(100),
  createdAt: timestamp, updatedAt: timestamp,
}).strict().refine(value => new Set(value.units.map(unit => unit.id)).size === value.units.length, 'Unit IDs must be unique');
export type Course = z.infer<typeof CourseSchema>;
export type CourseInput = z.infer<typeof CourseInputSchema>;
export type CourseUnit = z.infer<typeof CourseUnitSchema>;
export const CourseEditionSchema = z.object({
  id, courseId: id, courseRevision: revision, courseDigest: z.string().regex(/^[a-f0-9]{64}$/),
  ownerId: id, revision: z.literal(1), label: title, status: z.literal('draft'), createdAt: timestamp,
}).strict();
export type CourseEdition = z.infer<typeof CourseEditionSchema>;
export const CourseDeliverySchema = z.object({
  id, editionId: id, ownerId: id, learnerId: id, revision,
  status: z.enum(['active', 'revoked']), createdAt: timestamp, updatedAt: timestamp,
}).strict();
export type CourseDelivery = z.infer<typeof CourseDeliverySchema>;
export const CourseStageSchema = z.enum(['prediction', 'activity', 'transfer']);
export const CourseHelpSchema = z.enum(['explanation', 'referenceFeedback', 'recovery']);
export const CourseWorkSchema = z.object({
  id, revision, currentUnitId: id, currentStage: CourseStageSchema, shared: z.boolean(), createdAt: timestamp, updatedAt: timestamp,
  attempts: z.array(z.object({
    id, unitId: id, unitRevision: revision, stage: CourseStageSchema,
    answer: text.refine(value => value.length > 0), createdAt: timestamp,
    helpUsed: z.array(CourseHelpSchema).max(3),
  }).strict()).max(2_000),
  help: z.array(z.object({unitId: id, kind: CourseHelpSchema, firstViewedAt: timestamp}).strict()).max(300),
}).strict().superRefine((work, ctx) => {
  if (new Set(work.attempts.map(item => item.id)).size !== work.attempts.length
    || new Set(work.help.map(item => item.unitId + ':' + item.kind)).size !== work.help.length) {
    ctx.addIssue({code: 'custom', message: 'Course evidence identities must be unique'});
  }
});
export type CourseWork = z.infer<typeof CourseWorkSchema>;
const fields = {commandId: id, expectedRevision: z.number().int().nonnegative()};
export const CourseCommandKinds = ['save-course', 'create-course-edition', 'assign-course', 'revoke-course-delivery',
  'set-course-position', 'record-course-attempt', 'view-course-help', 'share-course-work'] as const;
export const CourseCommandSchema = z.discriminatedUnion('kind', [
  z.object({...fields, kind: z.literal('save-course'), courseId: id, input: CourseInputSchema}).strict(),
  z.object({...fields, kind: z.literal('create-course-edition'), expectedRevision: z.literal(0), editionId: id,
    courseId: id, courseRevision: revision, label: title}).strict(),
  z.object({...fields, kind: z.literal('assign-course'), expectedRevision: z.literal(0), deliveryId: id, editionId: id, learnerId: id}).strict(),
  z.object({...fields, kind: z.literal('revoke-course-delivery'), deliveryId: id}).strict(),
  z.object({...fields, kind: z.literal('set-course-position'), deliveryId: id, unitId: id, stage: CourseStageSchema.optional()}).strict(),
  z.object({...fields, kind: z.literal('record-course-attempt'), deliveryId: id, unitId: id,
    stage: CourseStageSchema, attemptId: id, answer: text.refine(value => value.length > 0)}).strict(),
  z.object({...fields, kind: z.literal('view-course-help'), deliveryId: id, unitId: id, help: CourseHelpSchema}).strict(),
  z.object({...fields, kind: z.literal('share-course-work'), deliveryId: id, shared: z.boolean()}).strict(),
]);
export const CourseAuthorCommandSchema = z.discriminatedUnion('kind', [CourseCommandSchema.options[0], CourseCommandSchema.options[1]]);
export type CourseAuthorCommand = z.infer<typeof CourseAuthorCommandSchema>;
export type CourseCommand = z.infer<typeof CourseCommandSchema>;
const entity = z.enum(['course', 'edition', 'delivery', 'course-work']);
export const CourseEventSchema = z.object({
  id, sequence: revision, courseEntity: entity, entityId: id, entityRevision: revision,
  type: z.enum(CourseCommandKinds), actorId: id, actorRole: z.enum(['teacher', 'student']), occurredAt: timestamp,
  payload: z.object({command: CourseCommandSchema, value: z.union([CourseSchema, CourseEditionSchema, CourseDeliverySchema, CourseWorkSchema])}).strict(),
}).strict();
export type CourseEvent = z.infer<typeof CourseEventSchema>;
export const CourseReceiptSchema = z.object({
  commandId: id, actorId: id, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  courseEntity: entity, entityId: id, entityRevision: revision, eventId: id,
}).strict();
export type CourseReceipt = z.infer<typeof CourseReceiptSchema>;
export const CourseSpaceSchema = z.object({
  courses: z.array(CourseSchema), editions: z.array(z.object({edition: CourseEditionSchema, course: CourseSchema}).strict()),
  deliveries: z.array(CourseDeliverySchema), work: z.array(CourseWorkSchema),
}).strict();
export type CourseSpace = z.infer<typeof CourseSpaceSchema>;
export function courseTarget(command: CourseCommand): {courseEntity: CourseReceipt['courseEntity']; entityId: string} {
  if (command.kind === 'save-course') return {courseEntity: 'course', entityId: command.courseId};
  if (command.kind === 'create-course-edition') return {courseEntity: 'edition', entityId: command.editionId};
  return {courseEntity: command.kind === 'assign-course' || command.kind === 'revoke-course-delivery' ? 'delivery' : 'course-work', entityId: command.deliveryId};
}
