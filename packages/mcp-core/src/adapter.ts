import {createHash, randomUUID} from 'node:crypto';
import {z} from 'zod';
import {projectDocumentRevision,objectSearchText,searchTextExcerpt, RecordingStateSchema, RecordingSummarySchema, RecordingSearchSchema, RecordingCommandSchema, RecordingReceiptSchema, type RecordingState, type RecordingCommand} from '@ardesia/contracts';
import {materialPage, MaterialStateSchema, WorkspaceAccessSchema, ownsWorkspace, TutorSpaceSchema, TutorCommandSchema, TutorReceiptSchema, tutorTarget, type TutorCommand, CourseSchema, CourseEditionSchema, CourseAuthorCommandSchema, CourseReceiptSchema, courseTarget, type CourseAuthorCommand, ActorSchema, canonicalJson, CommandReceiptSchema, CoreCommandSchema, CoreEventSchema,
  EducationalObjectSchema, LessonDocumentSchema, type Actor, type CoreCommand, type LessonDocument} from '@ardesia/contracts';
import {ConfigSchema, fail, id, revision, type McpConfig} from './config';
import {post, record} from './http';

export const SessionSchema = z.object({account: z.object({id, role: z.enum(['teacher', 'student']), displayName: z.string().max(300)}).strict(),
  expiresAt: z.iso.datetime()}).strict();
export const WorkspaceSummarySchema = z.object({workspaceId: id, title: z.string().max(240), workspaceRevision: revision, access: WorkspaceAccessSchema.optional()}).strict();
// Deliberately strip everything outside this adapter's read scope: no learnerWork, consents or learningEvents.
const ProjectionSchema = WorkspaceSummarySchema.extend({actor: ActorSchema, documents: z.array(LessonDocumentSchema),
  tutorSpace: TutorSpaceSchema.optional(), assignedDocuments: z.array(LessonDocumentSchema), events: z.array(CoreEventSchema),
  courseSpace: z.object({courses: z.array(CourseSchema), editions: z.array(z.object({edition: CourseEditionSchema, course: CourseSchema}).strict())}).strip().optional()}).strip();
type Projection = z.infer<typeof ProjectionSchema>;
type Proposal = {workspaceId: string; actor: Actor; commandDigest: string; expires: number} &
  ({action: 'tutor-command'; command: TutorCommand} | {action: 'command'; command: CoreCommand} | {action: 'course-command'; command: CourseAuthorCommand}
    | {action: 'recording-command'; command: Extract<RecordingCommand, {kind: 'edit-recording-transcript'}>});
export const PREVIEW_TTL_MS = 10 * 60_000;
const MAX_PROPOSALS = 32;
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase('it');
function parse<T>(schema: z.ZodType<T>, input: unknown): T {const result = schema.safeParse(input); return result.success ? result.data : fail('INVALID_RESPONSE');}
function document(projection: Projection, documentId: string) {
  return [...projection.documents, ...projection.assignedDocuments].find(doc => doc.id === documentId) ?? fail('NOT_FOUND');
}
function metadata(doc: LessonDocument) {const {objects: _, connections: __, ...value} = doc; return value;}

/** Transient proposals are editing envelopes. Durable events and receipts exist only in the API's Core. */
export function createAdapter(input: McpConfig, options: {beforeWrite?: () => Promise<void>} = {}) {
  const config = ConfigSchema.parse(structuredClone(input)), proposals = new Map<string, Proposal>();
  const authorized = (workspaceId: string) => {if (!config.workspaceIds.includes(workspaceId)) fail('SCOPE_REJECTED');};
  async function session(signal?: AbortSignal) {
    const value = parse(SessionSchema, (await post(config.origin, {action: 'session'}, config, signal)).result);
    if (value.account.id !== config.accountId || value.account.role !== config.role) return fail('SESSION_CHANGED');
    return value;
  }
  function projection(value: unknown, workspaceId: string): Projection {
    const data = parse(ProjectionSchema, value);
    const owner = ownsWorkspace(data);
    if (data.workspaceId !== workspaceId || data.actor.role !== config.role
      || data.documents.some(doc => doc.ownerId !== data.actor.actorId)
      || data.events.some(event => !data.documents.some(doc => doc.id === event.documentId))
      || !owner && (config.role !== 'student' || data.documents.length || data.events.length || data.actor.actorId !== config.accountId)
      || owner && data.assignedDocuments.length) return fail('INVALID_RESPONSE');
    if (data.courseSpace && (data.courseSpace.courses.some(course => !owner || course.ownerId !== data.actor.actorId)
      || data.courseSpace.editions.some(({edition, course}) => edition.courseId !== course.id || edition.courseRevision !== course.revision
        || edition.ownerId !== course.ownerId || edition.courseDigest !== hash(course)))) return fail('INVALID_RESPONSE');
    if (data.tutorSpace && (data.tutorSpace.records.some(record => config.role !== 'teacher' || record.ownerId !== data.actor.actorId) || data.tutorSpace.history.some(event => config.role !== 'teacher' || event.actorId !== data.actor.actorId || event.payload.value.ownerId !== data.actor.actorId))) return fail('INVALID_RESPONSE');
    return data;
  }
  async function open(workspaceId: string, signal?: AbortSignal) {
    authorized(workspaceId); await session(signal);
    return projection((await post(config.origin, {action: 'open-workspace', workspaceId}, config, signal)).result, workspaceId);
  }
  function writable() {if (config.access !== 'read-write') fail('WRITE_DISABLED');}
  function requireOwned(data: Projection) {if (!ownsWorkspace(data)) fail('OWNER_REQUIRED');}
  function expire() {for (const [key, proposal] of proposals) if (proposal.expires <= Date.now()) proposals.delete(key);}
  async function recording(workspaceId: string, recordingId: string, signal?: AbortSignal) {
    const data = await open(workspaceId, signal); requireOwned(data);
    const state = parse(RecordingStateSchema, (await post(config.origin, {action: 'read-recording', workspaceId, recordingId}, config, signal)).result);
    if (state.summary.recordingId !== recordingId || state.summary.ownerId !== data.actor.actorId
      || !data.documents.some(doc => doc.id === state.summary.documentId) || !state.capture || state.summary.status !== 'ready') return fail('INVALID_RESPONSE');
    if (hash({mimeType: state.capture.mimeType, parts: state.capture.parts}) !== state.summary.mediaDigest) return fail('INVALID_RESPONSE');
    return {data, state};
  }
  function exactRecording(state: RecordingState, wanted: number) {
    if (state.summary.revision !== wanted) fail('REVISION_CONFLICT');
  }

  return {
    async recordings(args: {workspaceId: string; documentId?: string; query?: string}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal); requireOwned(data);
      if (args.documentId) document(data, args.documentId);
      const value = (await post(config.origin, {action: args.query ? 'search-recordings' : 'list-recordings',
        workspaceId: args.workspaceId, ...(args.documentId ? {documentId: args.documentId} : {}), ...(args.query ? {query: args.query} : {})}, config, signal)).result;
      if (args.query) {
        const result = parse(RecordingSearchSchema, value);
        if (result.matches.some(item => !data.documents.some(doc => doc.id === item.documentId) || args.documentId && item.documentId !== args.documentId)) return fail('INVALID_RESPONSE');
        return {workspaceId: args.workspaceId, scope: 'owned-recordings-current-transcripts', ...result, truncated: result.total > result.matches.length};
      }
      const summaries = parse(z.array(RecordingSummarySchema), value);
      if (summaries.some(item => item.ownerId !== data.actor.actorId || !data.documents.some(doc => doc.id === item.documentId)
        || args.documentId && item.documentId !== args.documentId || item.status === 'erased')) return fail('INVALID_RESPONSE');
      return {workspaceId: args.workspaceId, recordings: summaries};
    },
    async readRecording(args: {workspaceId: string; recordingId: string; revision: number; offset: number; limit: number}, signal?: AbortSignal) {
      const {state} = await recording(args.workspaceId, args.recordingId, signal); exactRecording(state, args.revision);
      const {timeline, ...capture} = state.capture!;
      return {workspaceId: args.workspaceId, summary: state.summary, capture,
        timeline: timeline.slice(args.offset, args.offset + args.limit), timelineTotal: timeline.length,
        nextOffset: args.offset + args.limit < timeline.length ? args.offset + args.limit : null,
        transcripts: state.transcripts.map(({cues, ...meta}) => ({...meta, cueCount: cues.length})),
        timing: 'Media milliseconds; captured and observed marks remain distinct. Read exact lesson revisions with ardesia_read_document_revision.'};
    },
    async transcript(args: {workspaceId: string; recordingId: string; recordingRevision: number; transcriptRevision: number; offset: number; limit: number}, signal?: AbortSignal) {
      const {state} = await recording(args.workspaceId, args.recordingId, signal); exactRecording(state, args.recordingRevision);
      const transcript = state.transcripts.find(item => item.revision === args.transcriptRevision); if (!transcript) return fail('NOT_FOUND');
      const {cues, ...meta} = transcript;
      return {workspaceId: args.workspaceId, recordingId: args.recordingId, recordingRevision: state.summary.revision,
        documentId: state.summary.documentId, transcript: {...meta, cues: cues.slice(args.offset, args.offset + args.limit)},
        total: cues.length, nextOffset: args.offset + args.limit < cues.length ? args.offset + args.limit : null};
    },
    async recordingPart(args: {workspaceId: string; recordingId: string; revision: number; index: number}, signal?: AbortSignal) {
      const {state} = await recording(args.workspaceId, args.recordingId, signal); exactRecording(state, args.revision);
      const part = state.capture!.parts[args.index]; if (!part) return fail('NOT_FOUND');
      const value = (await post(config.origin, {action: 'read-recording-part', workspaceId: args.workspaceId, recordingId: args.recordingId, index: args.index}, config, signal)).result;
      if (!record(value) || typeof value.base64 !== 'string' || canonicalJson(value.part) !== canonicalJson(part)) return fail('INVALID_RESPONSE');
      const bytes = Buffer.from(value.base64, 'base64');
      if (bytes.toString('base64') !== value.base64 || bytes.length !== part.bytes || createHash('sha256').update(bytes).digest('hex') !== part.sha256) return fail('INVALID_RESPONSE');
      const current = await recording(args.workspaceId, args.recordingId, signal); exactRecording(current.state, args.revision);
      if (current.state.summary.mediaDigest !== state.summary.mediaDigest) return fail('INVALID_RESPONSE');
      return {workspaceId: args.workspaceId, recordingId: args.recordingId, revision: args.revision, mimeType: state.capture!.mimeType,
        mediaDigest: state.summary.mediaDigest, part, base64: value.base64};
    },
    async documentRevision(args: {workspaceId: string; documentId: string; revision: number}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal); requireOwned(data);
      const current = document(data, args.documentId);
      if (args.revision > current.revision) return fail('NOT_FOUND');
      let historical: LessonDocument;
      try {historical = projectDocumentRevision(data.events, args.documentId, args.revision);} catch {return fail('INVALID_RESPONSE');}
      return {workspaceId: data.workspaceId, currentRevision: current.revision, document: historical};
    },
    async previewTranscript(args: {workspaceId: string; command: Extract<RecordingCommand, {kind: 'edit-recording-transcript'}>}, signal?: AbortSignal) {
      writable(); expire();
      const parsed = RecordingCommandSchema.safeParse(args.command);
      if (!parsed.success || parsed.data.kind !== 'edit-recording-transcript' || parsed.data.origin !== 'imported') return fail('INVALID_COMMAND');
      const command = structuredClone(parsed.data), {data, state} = await recording(args.workspaceId, command.recordingId, signal);
      const proposalId = randomUUID(), expires = Date.now() + PREVIEW_TTL_MS;
      const commandDigest = hash({accountId: config.accountId, workspaceId: args.workspaceId, actor: data.actor, command});
      if (proposals.size >= MAX_PROPOSALS) return fail('PREVIEW_LIMIT');
      proposals.set(proposalId, {action: 'recording-command', workspaceId: args.workspaceId, actor: data.actor, command, commandDigest, expires});
      return {proposalId, commandDigest, expiresAt: new Date(expires).toISOString(), accountId: config.accountId, actor: data.actor,
        workspaceId: args.workspaceId, previousSummary: state.summary, previousTranscriptRevision: state.transcripts.at(-1)?.revision ?? 0,
        expectedRevisionMatches: command.expectedRevision === state.summary.revision, command, committed: false, approval: 'not-attested',
        instruction: 'Imported transcript, not verified ASR or scientific approval. Preserve original command ID for an uncertain retry; prior transcript versions and original media are retained.'};
    },
    async material(args:{workspaceId:string;documentId:string;objectId:string;revision:number;index?:number},signal?:AbortSignal){
      const data=await open(args.workspaceId,signal),doc=document(data,args.documentId),object=doc.objects.find(o=>o.id===args.objectId);
      if(!object||object.type!=='material'||object.revision!==args.revision)return fail('NOT_FOUND');
      const state=parse(MaterialStateSchema,(await post(config.origin,{action:'read-material',workspaceId:args.workspaceId,assetId:object.data.assetId},config,signal)).result);
      if(state.status!=='ready'||state.manifest.sha256!==object.data.sha256||state.manifest.documentId!==doc.id||state.ownerId!==doc.ownerId||canonicalJson(materialPage(state.manifest,object.data.page))!==canonicalJson(object.data))return fail('INVALID_RESPONSE');
      if(args.index===undefined)return {objectId:object.id,objectRevision:object.revision,state};
      const part=state.manifest.parts[args.index];if(!part)return fail('NOT_FOUND');
      const value=(await post(config.origin,{action:'read-material-part',workspaceId:args.workspaceId,assetId:object.data.assetId,index:args.index},config,signal)).result;
      if(!record(value)||typeof value.base64!=='string')return fail('INVALID_RESPONSE');
      const bytes=Buffer.from(value.base64,'base64');
      if(bytes.toString('base64')!==value.base64||bytes.length!==part.bytes||createHash('sha256').update(bytes).digest('hex')!==part.sha256)return fail('INVALID_RESPONSE');
      return {objectId:object.id,objectRevision:object.revision,manifest:state.manifest,part,base64:value.base64};
    },
    async list(signal?: AbortSignal) {
      await session(signal);
      const list = parse(z.array(WorkspaceSummarySchema), (await post(config.origin, {action: 'list-workspaces'}, config, signal)).result);
      return {access: config.access, workspaces: list.filter(entry => config.workspaceIds.includes(entry.workspaceId))};
    },
    async search(args: {workspaceId: string; query: string; offset: number; limit: number; workspaceRevision?: number}, signal?: AbortSignal) {
      if (args.offset > 0 && args.workspaceRevision === undefined) return fail('REVISION_REQUIRED');
      const data = await open(args.workspaceId, signal);
      if (args.workspaceRevision !== undefined && data.workspaceRevision !== args.workspaceRevision) return fail('REVISION_CONFLICT');
      const query = normalized(args.query), matches: Record<string, unknown>[] = [];
      for (const doc of [...data.documents, ...data.assignedDocuments]) {
        const base = {documentId: doc.id, documentRevision: doc.revision, status: doc.status};
        if (normalized(doc.title).includes(query)) matches.push({...base, kind: 'document', title: doc.title});
        for (const object of doc.objects) {
          const excerpt=searchTextExcerpt(objectSearchText(object),args.query);
          if (excerpt!==null) matches.push({...base, kind: 'object', objectId: object.id, objectRevision: object.revision,
            type: object.type, title: object.title, excerpt,
            provenance: object.provenance});
        }
      }
      return {workspaceId: data.workspaceId, workspaceRevision: data.workspaceRevision, scope: 'current-authorized-lessons',
        total: matches.length, matches: matches.slice(args.offset, args.offset + args.limit),
        nextOffset: args.offset + args.limit < matches.length ? args.offset + args.limit : null};
    },
    async read(args: {workspaceId: string; documentId: string; revision?: number}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal), doc = document(data, args.documentId);
      if (args.revision !== undefined && doc.revision !== args.revision) return fail('REVISION_CONFLICT');
      return {workspaceId: data.workspaceId, workspaceRevision: data.workspaceRevision, document: doc};
    },
    async object(args: {workspaceId: string; documentId: string; objectId: string; revision: number}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal), doc = document(data, args.documentId);
      let object = doc.objects.find(object => object.id === args.objectId && object.revision === args.revision);
      if (!object && ownsWorkspace(data)) for (const event of data.events.filter(event => event.documentId === doc.id)) {
        if (!record(event.payload)) continue;
        const candidates = [event.payload.object, event.payload.previous];
        if (event.type === 'plugin-release-changed' && Array.isArray(event.payload.objects)) {
          for (const change of event.payload.objects) if (record(change)) candidates.push(change.object, change.previous);
        }
        for (const candidate of candidates) {
          const parsed = EducationalObjectSchema.safeParse(candidate);
          if (parsed.success && parsed.data.id === args.objectId && parsed.data.revision === args.revision) object = parsed.data;
        }
      }
      if (!object) return fail('NOT_FOUND');
      return {workspaceId: data.workspaceId, workspaceRevision: data.workspaceRevision, documentId: doc.id, documentRevision: doc.revision,
        historical: !doc.objects.some(current => current.id === object.id && current.revision === object.revision), object};
    },
    async tutor(args: {workspaceId: string; query: string; offset: number; limit: number; workspaceRevision?: number}, signal?: AbortSignal) {
      if (args.offset > 0 && args.workspaceRevision === undefined) return fail('REVISION_REQUIRED');
      const data = await open(args.workspaceId, signal);
      if (args.workspaceRevision !== undefined && data.workspaceRevision !== args.workspaceRevision) return fail('REVISION_CONFLICT');
      const query = normalized(args.query), matches = (data.tutorSpace?.records ?? []).filter(value => normalized(canonicalJson(value)).includes(query));
      return {workspaceId:data.workspaceId,workspaceRevision:data.workspaceRevision,total:matches.length,
        matches:matches.slice(args.offset,args.offset+args.limit).map(value=>({id:value.id,kind:value.kind,revision:value.revision,title:'title'in value?value.title:value.reference})),
        nextOffset:args.offset+args.limit<matches.length?args.offset+args.limit:null};
    },
    async readTutor(args: {workspaceId: string; recordId: string; revision: number}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal), event = data.tutorSpace?.history.find(value=>value.entityId===args.recordId && value.entityRevision===args.revision);
      if(!event) return fail('NOT_FOUND');
      return {workspaceId:data.workspaceId,workspaceRevision:data.workspaceRevision,record:event.payload.value,event};
    },
    async previewTutor(args: {workspaceId: string; command: TutorCommand}, signal?: AbortSignal) {
      writable(); expire();
      const parsed = TutorCommandSchema.safeParse(args.command); if(!parsed.success) return fail('INVALID_COMMAND');
      const command = structuredClone(parsed.data), data = await open(args.workspaceId, signal);
      requireOwned(data); if (config.role !== 'teacher') return fail('FORBIDDEN');
      const previousRecord = data.tutorSpace?.records.find(value=>value.id===command.recordId) ?? null;
      const proposalId = randomUUID(), expires = Date.now() + PREVIEW_TTL_MS;
      const commandDigest = hash({accountId:config.accountId,workspaceId:args.workspaceId,actor:data.actor,command});
      if(proposals.size>=MAX_PROPOSALS) return fail('PREVIEW_LIMIT');
      proposals.set(proposalId,{action:'tutor-command',workspaceId:args.workspaceId,actor:data.actor,command,commandDigest,expires});
      return {proposalId,commandDigest,expiresAt:new Date(expires).toISOString(),accountId:config.accountId,actor:data.actor,workspaceId:data.workspaceId,
        previousRecord,command,committed:false,approval:'not-attested',instruction:'Private tutor records. Core checks availability, capacity, money and revisions at commit. Payment commands are manual declarations only; no money, messages or calendar provider operations are executed.'};
    },
    async courses(args: {workspaceId: string; query: string}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal), query = normalized(args.query);
      const space = data.courseSpace ?? {courses: [], editions: []};
      const matches = (course: z.infer<typeof CourseSchema>) => normalized(course.title + ' ' + course.description + ' ' + course.units.map(unit => unit.title + ' ' + unit.objective).join(' ')).includes(query);
      return {workspaceId: data.workspaceId, workspaceRevision: data.workspaceRevision,
        courses: space.courses.filter(matches).map(({id, revision, title, status}) => ({id, revision, title, status})),
        editions: space.editions.filter(value => matches(value.course)).map(({edition, course}) => ({...edition, title: course.title}))};
    },
    async readCourse(args: {workspaceId: string; courseId: string; revision: number; editionId?: string}, signal?: AbortSignal) {
      const data = await open(args.workspaceId, signal), space = data.courseSpace;
      const pack = args.editionId ? space?.editions.find(value => value.edition.id === args.editionId) : undefined;
      const course = args.editionId ? pack?.course : space?.courses.find(value => value.id === args.courseId);
      if (!course || course.id !== args.courseId || course.revision !== args.revision) return fail('NOT_FOUND');
      return {workspaceId: data.workspaceId, workspaceRevision: data.workspaceRevision, course, edition: pack?.edition ?? null};
    },
    async previewCourse(args: {workspaceId: string; command: CourseAuthorCommand}, signal?: AbortSignal) {
      writable(); expire();
      const parsed = CourseAuthorCommandSchema.safeParse(args.command); if (!parsed.success) return fail('INVALID_COMMAND');
      const command = structuredClone(parsed.data), data = await open(args.workspaceId, signal);
      requireOwned(data);
      const before = data.courseSpace?.courses.find(value => value.id === command.courseId) ?? null;
      if (command.kind === 'create-course-edition' && !before) return fail('NOT_FOUND');
      const proposalId = randomUUID(), expires = Date.now() + PREVIEW_TTL_MS;
      const commandDigest = hash({accountId: config.accountId, workspaceId: args.workspaceId, actor: data.actor, command});
      if (proposals.size >= MAX_PROPOSALS) return fail('PREVIEW_LIMIT');
      proposals.set(proposalId, {action: 'course-command', workspaceId: args.workspaceId, actor: data.actor, command, commandDigest, expires});
      return {proposalId, commandDigest, expiresAt: new Date(expires).toISOString(), accountId: config.accountId, actor: data.actor,
        workspaceId: data.workspaceId, previousCourse: before, command, committed: false, approval: 'not-attested',
        instruction: 'Course and editions remain DRAFT. An edition freezes the exact course and linked lesson revisions. No assignment, publication, learner work or scientific approval is performed.'};
    },
    async preview(args: {workspaceId: string; command: CoreCommand}, signal?: AbortSignal) {
      writable(); expire();
      const parsed = CoreCommandSchema.safeParse(args.command); if (!parsed.success) return fail('INVALID_COMMAND');
      const command = structuredClone(parsed.data), data = await open(args.workspaceId, signal);
      requireOwned(data);
      const doc = command.kind === 'create-document' ? data.documents.find(doc => doc.id === command.documentId) : document(data, command.documentId);
      // An old expectedRevision must remain recoverable after a committed response was lost.
      // Core alone distinguishes an identical retry from a new stale command.
      const currentRevision = doc?.revision ?? 0, proposalId = randomUUID(), expires = Date.now() + PREVIEW_TTL_MS;
      const commandDigest = hash({accountId: config.accountId, workspaceId: args.workspaceId, actor: data.actor, command});
      if (proposals.size >= MAX_PROPOSALS) return fail('PREVIEW_LIMIT');
      proposals.set(proposalId, {action: 'command', workspaceId: args.workspaceId, actor: data.actor, command, commandDigest, expires});
      const objectId = 'objectId' in command ? command.objectId : 'object' in command ? command.object.id : undefined;
      return {proposalId, commandDigest, expiresAt: new Date(expires).toISOString(), accountId: config.accountId, actor: data.actor,
        workspaceId: data.workspaceId, workspaceTitle: data.title, document: doc ? metadata(doc) : null,
        previousObject: objectId ? doc?.objects.find(object => object.id === objectId) ?? null : null,
        affectedConnections: doc?.connections.filter(connection => command.kind === 'disconnect-objects' ? connection.id === command.connectionId
          : command.kind === 'remove-object' ? connection.from === command.objectId || connection.to === command.objectId : false) ?? [],
        currentRevision, expectedRevisionMatches: currentRevision === command.expectedRevision, command,
        committed: false, approval: 'not-attested',
        instruction: 'Review the exact command. Applying uses the configured write permission and the Core revision check. Preserve commandId and payload for an uncertain retry.'};
    },
    async apply(args: {proposalId: string; commandDigest: string}, signal?: AbortSignal) {
      writable(); expire();
      const proposal = proposals.get(args.proposalId); if (!proposal) return fail('PREVIEW_UNAVAILABLE');
      if (proposal.commandDigest !== args.commandDigest) return fail('PREVIEW_MISMATCH');
      const data = await open(proposal.workspaceId, signal);
      requireOwned(data);
      if (canonicalJson(data.actor) !== canonicalJson(proposal.actor)) return fail('SESSION_CHANGED');
      await options.beforeWrite?.();
      if (proposals.get(args.proposalId) !== proposal || proposal.expires <= Date.now()) return fail('PREVIEW_UNAVAILABLE');
      const response = (await post(config.origin, {action: proposal.action, workspaceId: proposal.workspaceId, command: proposal.command}, config, signal)).result;
      if (!record(response)) return fail('INVALID_RESPONSE');
      if (proposal.action === 'recording-command') {
        const receipt = parse(RecordingReceiptSchema, response.receipt), state = parse(RecordingStateSchema, response.state);
        if (receipt.commandId !== proposal.command.commandId || receipt.actorId !== proposal.actor.actorId
          || receipt.recordingId !== proposal.command.recordingId || receipt.revision !== proposal.command.expectedRevision + 1
          || receipt.fingerprint !== hash({actor: proposal.actor, command: proposal.command})
          || state.summary.recordingId !== receipt.recordingId || state.summary.ownerId !== proposal.actor.actorId
          || !state.receipts.some(item => canonicalJson(item) === canonicalJson(receipt))) return fail('INVALID_RESPONSE');
        return {committed: true, workspaceId: proposal.workspaceId, receipt, summary: state.summary,
          transcriptVersions: state.transcripts.map(({revision, origin, updatedAt}) => ({revision, origin, updatedAt}))};
      }
      if (proposal.action === 'tutor-command') {
        const receipt = parse(TutorReceiptSchema,response.receipt), after = projection(response.projection,proposal.workspaceId), target = tutorTarget(proposal.command);
        if(receipt.commandId!==proposal.command.commandId || receipt.actorId!==proposal.actor.actorId || receipt.tutorEntity!==target.tutorEntity || receipt.entityId!==target.entityId || receipt.entityRevision!==proposal.command.expectedRevision+1
          || receipt.fingerprint!==hash({actor:proposal.actor,command:proposal.command}) || canonicalJson(after.actor)!==canonicalJson(proposal.actor)) return fail('INVALID_RESPONSE');
        const event = after.tutorSpace?.history.find(value=>value.id===receipt.eventId && value.entityId===receipt.entityId && value.entityRevision===receipt.entityRevision);
        if(!event) return fail('INVALID_RESPONSE');
        return {committed:true,workspaceId:proposal.workspaceId,workspaceRevision:after.workspaceRevision,receipt,record:event.payload.value};
      }
      if (proposal.action === 'course-command') {
        const receipt = parse(CourseReceiptSchema, response.receipt), after = projection(response.projection, proposal.workspaceId), target = courseTarget(proposal.command);
        if (receipt.commandId !== proposal.command.commandId || receipt.actorId !== proposal.actor.actorId
          || receipt.courseEntity !== target.courseEntity || receipt.entityId !== target.entityId || receipt.entityRevision !== proposal.command.expectedRevision + 1
          || receipt.fingerprint !== hash({actor: proposal.actor, command: proposal.command}) || canonicalJson(after.actor) !== canonicalJson(proposal.actor)) return fail('INVALID_RESPONSE');
        return {committed: true, workspaceId: proposal.workspaceId, workspaceRevision: after.workspaceRevision, receipt,
          course: proposal.command.kind === 'create-course-edition' ? after.courseSpace?.editions.find(value => value.edition.id === target.entityId)?.course
            : after.courseSpace?.courses.find(course => course.id === proposal.command.courseId),
          edition: proposal.command.kind === 'create-course-edition' ? after.courseSpace?.editions.find(value => value.edition.id === target.entityId)?.edition : null};
      }
      const receipt = parse(CommandReceiptSchema, response.receipt), after = projection(response.projection, proposal.workspaceId);
      if (receipt.commandId !== proposal.command.commandId || receipt.documentId !== proposal.command.documentId
        || receipt.actorId !== proposal.actor.actorId || receipt.documentRevision !== proposal.command.expectedRevision + 1
        || receipt.fingerprint !== hash({actor: proposal.actor, command: proposal.command})
        || canonicalJson(after.actor) !== canonicalJson(proposal.actor)) return fail('INVALID_RESPONSE');
      // Keep the envelope until expiry: a second apply returns the original Core receipt, including after a lost response.
      return {committed: true, workspaceId: proposal.workspaceId, workspaceRevision: after.workspaceRevision, receipt,
        document: metadata(document(after, proposal.command.documentId))};
    },
    discard(proposalId: string) {return {discarded: proposals.delete(proposalId)};},
    clear() {proposals.clear();},
  };
}
