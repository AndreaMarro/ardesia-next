import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {createServer as createViteServer} from 'vite';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {identity} from './evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = (condition, code) => {if (!condition) throw Object.assign(new Error(code), {checkCode: code});};
const digest = value => createHash('sha256').update(value).digest('hex');
const waitUntil = async predicate => {
  const deadline = Date.now() + 3000;
  while (!predicate()) {if (Date.now() > deadline) throw Object.assign(new Error('CONDITION_TIMEOUT'), {checkCode: 'CONDITION_TIMEOUT'}); await new Promise(resolve => setTimeout(resolve, 10));}
};

/** Official client → isolated shipped stdio artifact → real HTTP → restricted PostgreSQL/Core. */
export async function verifyMcpRuntime() {
  const source = identity(), started = Date.now(), suffix = randomUUID().replaceAll('-', '');
  const database = `mcp_${suffix}_test`, role = `mcp_${suffix}`;
  const report = {...source, schemaVersion: 1, kind: 'ardesia-mcp-stdio-local', remoteAcceptance: false,
    hostCompatibility: 'NOT_TESTED', sdk: '2.4.0', runtime: process.version, checks: [], passed: false};
  const pass = name => report.checks.push({name, passed: true});
  let phase = 'configuration', failure, setup, admin, operator, runtime, api, http, temporary, origin, handler;
  let databaseCreated = false, roleCreated = false, dropCommand = false, holdReads = false, heldReads = 0, closedReads = 0;
  let requestCount = 0, commandRequests = 0, writeReceipts = 0;
  const clients = new Set(), rawChildren = new Set(), held = [];
  const accounts = {teacher: 'mcp-teacher', student: 'mcp-student', outsider: 'mcp-outsider'};
  const passwords = Object.fromEntries(Object.keys(accounts).map(key => [key, randomBytes(32).toString('hex')]));
  const secrets = new Set(Object.values(passwords));
  async function post(body, account, expected = 200) {
    const response = await fetch(origin + '/api/m3', {method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: {'Content-Type': 'application/json', Origin: origin, ...(account ? {Cookie: `ardesia_dev_session=${account.sessionToken}`, 'X-Ardesia-Account': account.accountId} : {})}, body: JSON.stringify(body)});
    const value = await response.json(); check(response.status === expected && value.ok === (expected === 200), 'HTTP_FIXTURE_FAILURE_' + response.status + '_' + (value.error?.code ?? body.action));
    return {result: value.result, cookie: response.headers.get('set-cookie')};
  }
  async function signIn(key) {
    const login = await post({action: 'login', username: accounts[key], password: passwords[key]});
    const sessionToken = login.cookie?.split(';')[0].split('=')[1]; check(/^[a-f0-9]{64}$/.test(sessionToken), 'INVALID_FIXTURE_SESSION'); secrets.add(sessionToken);
    return {accountId: login.result.account.id, role: login.result.account.role, sessionToken};
  }
  async function start(account, workspaceIds, access = 'read-only') {
    const path = join(temporary, `${randomUUID()}.json`);
    await writeFile(path, JSON.stringify({version: 1, origin, ...account, workspaceIds, access}), {mode: 0o600});
    const client = new Client({name: 'ardesia-external-regression', version: '1.0.0'});
    const transport = new StdioClientTransport({command: process.execPath, args: [join(temporary, 'ardesia-mcp.mjs'), 'serve', '--config', path],
      cwd: temporary, env: {HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NODE_USE_ENV_PROXY: '1'}, stderr: 'pipe'});
    let diagnostics = ''; transport.stderr.on('data', bytes => {diagnostics += bytes.toString();});
    clients.add(client); await client.connect(transport);
    return {client, transport, path, diagnostics: () => diagnostics};
  }
  async function call(connection, name, args = {}, code) {
    const result = await connection.client.callTool({name, arguments: args}, {timeout: 20_000});
    const data = result.structuredContent, text = result.content?.find(entry => entry.type === 'text')?.text;
    check(data && isDeepStrictEqual(data, JSON.parse(text)), 'STRUCTURED_TEXT_DIVERGENCE');
    for (const secret of secrets) check(!JSON.stringify(result).includes(secret) && !connection.diagnostics().includes(secret), 'SECRET_EXPOSED');
    check(!JSON.stringify(result).includes('PRIVATE_STUDENT_SENTINEL'), 'STUDENT_PRIVATE_DATA_EXPOSED');
    if (code) check(result.isError === true && data.error?.code === code, `EXPECTED_${code}`);
    else check(result.isError !== true && data.ok === true, 'TOOL_FAILED_' + (data.error?.code ?? name));
    return code ? data : data.result;
  }
  const prepare = (connection, workspaceId, command) => call(connection, 'ardesia_preview_command', {workspaceId, command});
  const apply = (connection, proposal) => call(connection, 'ardesia_apply_command', {proposalId: proposal.proposalId, commandDigest: proposal.commandDigest});
  async function close(connection) {await connection.client.close(); clients.delete(connection.client);}

  try {
    check(process.versions.node.split('.')[0] === '24', 'NODE24_REQUIRED');
    const configured = process.env.M3_TEST_DATABASE_URL; check(configured, 'TEST_DATABASE_REQUIRED');
    const address = new URL(configured);
    check(['postgres:', 'postgresql:'].includes(address.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname)
      && address.pathname.endsWith('_test'), 'DEDICATED_LOOPBACK_DATABASE_REQUIRED');
    phase = 'artifact';
    const directory = resolve(root, 'packages/mcp-core/dist'), build = JSON.parse(await readFile(join(directory, 'build-info.json'), 'utf8'));
    report.artifactSha256 = digest(await readFile(join(directory, 'ardesia-mcp.mjs')));
    check(build.sourceDigest === source.sourceDigest && report.artifactSha256 === build.artifactSha256, 'STALE_ARTIFACT');
    temporary = await mkdtemp(join(tmpdir(), 'ardesia-mcp-runtime-')); await cp(join(directory, 'ardesia-mcp.mjs'), join(temporary, 'ardesia-mcp.mjs'));

    phase = 'postgres-http';
    setup = await createViteServer({root, configFile: false, appType: 'custom', server: {middlewareMode: true, hmr: false, ws: false}});
    api = await setup.ssrLoadModule('@ardesia/server'); admin = api.createDatabasePool(configured, {max: 1});
    await admin.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0`); databaseCreated = true;
    address.pathname = '/' + database; operator = api.createDatabasePool(address.href, {max: 1}); await api.migrate(operator);
    await api.provisionTestAccounts(operator, Object.entries(accounts).map(([key, id]) => ({id, username: id, displayName: 'Synthetic ' + key,
      role: key === 'student' ? 'student' : 'teacher', password: passwords[key]})));
    const runtimePassword = randomBytes(32).toString('hex'); secrets.add(runtimePassword);
    await admin.query(`CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${runtimePassword}'`); roleCreated = true;
    await admin.query(`GRANT ardesia_next_runtime TO ${role}`); address.username = role; address.password = runtimePassword;
    runtime = api.createDatabasePool(address.href, {max: 4});
    const permissions = (await runtime.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,
      has_table_privilege(current_user,'ardesia_next.accounts','INSERT') AS provision FROM pg_roles WHERE rolname=current_user`)).rows[0];
    check(Object.values(permissions).every(value => value === false), 'RUNTIME_PRIVILEGE_EXPANSION');
    http = createServer(async (request, response) => {
      try {
        let bytes = ''; for await (const chunk of request) bytes += chunk;
        const action = JSON.parse(bytes).action; requestCount++;
        if (action === 'command') commandRequests++;
        const respond = async () => {
          const result = await handler(new Request(origin + '/api/m3', {method: 'POST', headers: request.headers, body: bytes}));
          const text = await result.text();
          if (action === 'command' && result.status === 200) writeReceipts++;
          if (dropCommand && action === 'command' && result.status === 200) {dropCommand = false; response.destroy(); return;}
          response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(text);
        };
        if (holdReads && action === 'open-workspace') {heldReads++; held.push(respond); response.once('close', () => {closedReads++;}); return;}
        await respond();
      } catch {response.writeHead(500, {'content-type': 'application/json'}); response.end('{"ok":false}');}
    });
    http.listen(0, '127.0.0.1'); await once(http, 'listening'); origin = `http://127.0.0.1:${http.address().port}`;
    handler = api.createApiHandler({store: api.createPostgresStore({pool: runtime, pluginPolicy: api.createFirstPartyPolicy({artifactRoot: resolve(root, 'apps/web/public')})}),
      allowedOrigins: [origin], secureCookies: false});
    const teacher = await signIn('teacher'), student = await signIn('student'), outsider = await signIn('outsider');
    const workspace = (await post({action: 'create-workspace', title: 'MCP scientific lesson', commandId: randomUUID()}, teacher)).result.workspaceId;
    const otherWorkspace = (await post({action: 'create-workspace', title: 'Outside configured scope', commandId: randomUUID()}, teacher)).result.workspaceId;
    pass('restricted-postgres-and-live-http');

    phase = 'read-only-discovery';
    const reader = await start(teacher, [workspace]);
    const tools = await reader.client.listTools(); report.toolNamesReadOnly = tools.tools.map(tool => tool.name);
    check(tools.tools.length === 9 && tools.tools.every(tool => tool.annotations.readOnlyHint === true), 'READ_ONLY_TOOLS');
    check((await reader.client.listResources()).resources.some(resource => resource.uri === 'ardesia://guide'), 'GUIDE_MISSING');
    const guide = JSON.parse((await reader.client.readResource({uri: 'ardesia://guide'})).contents[0].text);
    check(guide.previewIsHumanApproval === false && guide.access === 'read-only', 'MISLEADING_GUIDE');
    check((await call(reader, 'ardesia_list_workspaces')).workspaces.length === 1, 'SCOPE_LIST_LEAK');
    await call(reader, 'ardesia_read_document', {workspaceId: otherWorkspace, documentId: 'unknown'}, 'SCOPE_REJECTED');
    const beforeInvalid = requestCount;
    const invalid = await reader.client.callTool({name: 'ardesia_search', arguments: {workspaceId: workspace, query: '', actor: {role: 'teacher'}}});
    check(invalid.isError && beforeInvalid === requestCount, 'UNTRUSTED_ARGUMENT_ACCEPTED');
    pass('official-client-stdio-discovery-readonly-strict-input');

    phase = 'create-compose';
    let writer = await start(teacher, [workspace], 'read-write');
    const documentId = randomUUID(), sourceId = randomUUID(), formulaId = randomUUID();
    let revision = 0;
    const command = spec => ({commandId: randomUUID(), documentId, expectedRevision: revision, ...spec});
    async function mutate(spec) {const value = command(spec), preview = await prepare(writer, workspace, value), result = await apply(writer, preview); revision = result.receipt.documentRevision; return {value, preview, result};}
    const create = command({kind: 'create-document', title: 'Energia della molla'}), preview = await prepare(writer, workspace, create);
    check(preview.committed === false && preview.approval === 'not-attested' && commandRequests === 0, 'PREVIEW_MUTATED');
    const created = await apply(writer, preview); revision = created.receipt.documentRevision; check(revision === 1, 'CREATE_REVISION');
    const sourceObject = {id: sourceId, type: 'source', title: 'Fonte scientifica', x: 0, y: 0, width: 300, height: 200,
      data: {url: 'https://example.invalid/reference', publisher: 'Synthetic reference', locator: 'eq. 1', sourceRevision: '2026', license: 'Synthetic test fixture'}};
    await mutate({kind: 'add-object', object: sourceObject});
    const formula = {id: formulaId, type: 'formula', title: 'Energia potenziale', x: 400, y: 0, width: 300, height: 200,
      provenance: {origin: 'imported', sources: [{sourceId, revision: 1, locator: 'eq. 1'}]},
      data: {latex: 'E_p=\\frac{1}{2}kx^2', description: 'Molla ideale, regime lineare.'}};
    await mutate({kind: 'add-object', object: formula});
    await mutate({kind: 'replace-object', object: {...formula, data: {...formula.data, description: 'Energia elastica in joule, k in N/m, x in m.'}}});
    await mutate({kind: 'connect-objects', connection: {id: randomUUID(), from: sourceId, to: formulaId, label: 'Deriva da'}});
    const read = await call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId, revision});
    const object = read.document.objects.find(item => item.id === formulaId);
    check(read.document.connections.length === 1 && object.revision === 2 && object.status === 'draft' && object.provenance.createdBy === teacher.accountId
      && isDeepStrictEqual(object.provenance.sources, formula.provenance.sources), 'IDENTITY_PROVENANCE_DRAFT_LOST');
    check((await call(reader, 'ardesia_read_object_revision', {workspaceId: workspace, documentId, objectId: formulaId, revision: 1})).object.data.description === formula.data.description, 'HISTORY_FALLBACK');
    await call(reader, 'ardesia_read_object_revision', {workspaceId: workspace, documentId, objectId: formulaId, revision: 99}, 'NOT_FOUND');
    check((await call(reader, 'ardesia_search', {workspaceId: workspace, query: 'joule'})).matches[0].objectId === formulaId, 'SEARCH_REAL_CONTENT');
    pass('real-core-create-compose-edit-search-exact-history');

    phase = 'create-new-type';
    const contracts = await setup.ssrLoadModule('@ardesia/contracts');
    const format = JSON.parse((await writer.client.readResource({uri:'ardesia://extension-format'})).contents[0].text);
    check(format.renderer === 'ardesia.composition/1' && format.definitionSchema.properties?.typeId && format.compositionSchema.properties?.nodes, 'EXTENSION_SCHEMA_NOT_DISCOVERABLE');
    const definition = {format:'ardesia-extension/1',typeId:'test.external-ratio-'+suffix,version:1,name:'Rapporto creato via MCP',description:'Synthetic custom type',license:'CC0-1.0',renderer:'ardesia.composition/1',fallback:'Due valori e un rapporto.',body:{fields:[{key:'a',label:'Numeratore',kind:'number',initial:6},{key:'b',label:'Denominatore',kind:'number',initial:3,min:1,max:10}],nodes:[{id:'layout',kind:'group',props:{layout:'columns'},children:[{id:'result',kind:'value',props:{label:'Rapporto',expression:'a/b'}},{id:'control',kind:'input',props:{field:'b',appearance:'slider'}}]}]}};
    const extension = {id:randomUUID(),type:'extension',title:definition.name,x:50,y:300,width:400,height:300,provenance:{origin:'imported',sources:[{sourceId,revision:1,locator:'synthetic composition'}]},data:{definition,definitionDigest:await contracts.extensionDefinitionDigest(definition),state:{a:6,b:3}}};
    await mutate({kind:'add-object',object:extension});
    await mutate({kind:'replace-object',object:{...extension,data:{...extension.data,state:{a:6,b:2}}}});
    const custom = (await call(reader,'ardesia_read_document',{workspaceId:workspace,documentId,revision})).document.objects.find(o=>o.id===extension.id);
    check(custom.data.state.b===2 && custom.data.definition.typeId===definition.typeId && custom.provenance.origin==='imported' && custom.status==='draft', 'NEW_TYPE_NOT_REOPENED');
    check((await call(reader,'ardesia_read_object_revision',{workspaceId:workspace,documentId,objectId:extension.id,revision:1})).object.data.state.b===3,'EXTENSION_HISTORY_LOST');
    pass('official-client-new-type-create-edit-exact-history');
    phase='material-original';
    const materialBytes=Buffer.from('%PDF-1.7\nMCP synthetic integrity fixture'),assetId=randomUUID();
    const materialManifest={format:'ardesia-material-v1',assetId,documentId,name:'Fonte MCP.pdf',mimeType:'application/pdf',sha256:digest(materialBytes),bytes:materialBytes.length,license:'CC0',pages:[{width:600,height:800}],parts:[{index:0,sha256:digest(materialBytes),bytes:materialBytes.length}]};
    await post({action:'prepare-material',workspaceId:workspace,manifest:materialManifest},teacher);
    await post({action:'put-material-part',workspaceId:workspace,assetId,index:0,base64:materialBytes.toString('base64')},teacher);
    await post({action:'finish-material',workspaceId:workspace,assetId},teacher);
    const materialObjectId=randomUUID();
    await mutate({kind:'add-object',object:{id:materialObjectId,type:'material',title:'Fonte materiale',x:0,y:500,width:300,height:400,data:contracts.materialPage(materialManifest,1)}});
    const materialArgs={workspaceId:workspace,documentId,objectId:materialObjectId,revision:1};
    check((await call(reader,'ardesia_read_material',materialArgs)).state.manifest.sha256===digest(materialBytes),'MATERIAL_MANIFEST');
    check((await call(reader,'ardesia_read_material',{...materialArgs,index:0})).base64===materialBytes.toString('base64'),'MATERIAL_ORIGINAL_BYTES');
    await call(reader,'ardesia_read_material',{...materialArgs,index:1},'NOT_FOUND');
    await call(reader,'ardesia_read_material',{...materialArgs,workspaceId:otherWorkspace},'SCOPE_REJECTED');
    pass('official-client-original-material-manifest-chunk-and-scope');


    phase = 'create-programmable-type';
    check(format.program.renderer==='ardesia.program/1' && format.program.bodySchema.properties.code && format.program.eventSchema.properties.action && format.programView.tags.includes('svg') && format.programView.example.initialState.count===0,'PROGRAM_ABI_NOT_DISCOVERABLE');
    const programDefinition={...definition,typeId:'test.program-'+suffix,name:'Programma creato via MCP',renderer:'ardesia.program/1',fallback:'Contatore programmabile.',body:{code:'function update({state,event}) { return {state:{count:state.count+1},view:{tag:"p",children:[String(state.count)]}}; }',initialState:{count:0}}};
    const programmable={...extension,id:randomUUID(),title:programDefinition.name,data:{definition:programDefinition,definitionDigest:await contracts.extensionDefinitionDigest(programDefinition),state:{count:0}}};
    await mutate({kind:'add-object',object:programmable});
    const programRead=(await call(reader,'ardesia_read_document',{workspaceId:workspace,documentId,revision})).document.objects.find(o=>o.id===programmable.id);
    check(isDeepStrictEqual(programRead.data,programmable.data)&&programRead.status==='draft','PROGRAM_CHANGED_OR_EXECUTED_ON_IMPORT');
    await mutate({kind:'replace-object',object:{...programmable,data:{...programmable.data,state:{count:9}}}});
    check((await call(reader,'ardesia_read_object_revision',{workspaceId:workspace,documentId,objectId:programmable.id,revision:1})).object.data.state.count===0,'PROGRAM_HISTORY_LOST');
    pass('official-client-program-source-state-roundtrip-no-implicit-execution');

    phase = 'tutor-through-mcp';
    const tutorId = randomUUID(), tutorInput = {kind:'contact',title:'Tutor MCP person',email:'',phone:'',archived:false,notes:'Private professional note',custom:[{label:'Goal',value:'Algebra'}]};
    const tutorCommand = {kind:'save-tutor-record',commandId:randomUUID(),recordId:tutorId,expectedRevision:0,input:tutorInput,reason:''};
    const tutorPreview = await call(writer,'ardesia_preview_tutor',{workspaceId:workspace,command:tutorCommand});
    const tutorSaved = await apply(writer,tutorPreview);
    check(tutorSaved.record.revision===1 && tutorSaved.record.title===tutorInput.title,'TUTOR_NOT_SAVED');
    const tutorUpdated = await call(writer,'ardesia_preview_tutor',{workspaceId:workspace,command:{...tutorCommand,commandId:randomUUID(),expectedRevision:1,input:{...tutorInput,title:'Updated tutor person'}}});
    await apply(writer,tutorUpdated);
    const tutorRetry = await apply(writer,tutorPreview);
    check(tutorRetry.record.revision===1 && isDeepStrictEqual(tutorRetry.receipt,tutorSaved.receipt),'TUTOR_RETRY_MIXED_REVISIONS');
    check((await call(reader,'ardesia_read_tutor',{workspaceId:workspace,recordId:tutorId,revision:1})).record.title===tutorInput.title,'TUTOR_HISTORY_MISSING');
    check((await call(reader,'ardesia_search_tutor',{workspaceId:workspace,query:'Updated tutor'})).matches[0].id===tutorId,'TUTOR_SEARCH_MISSING');
    await call(reader,'ardesia_read_tutor',{workspaceId:workspace,recordId:tutorId,revision:3},'NOT_FOUND');
    pass('official-client-tutor-search-history-write-and-exact-retry');

    phase = 'create-course-edition';
    const courseFormat = JSON.parse((await writer.client.readResource({uri:'ardesia://course-format'})).contents[0].text);
    check(courseFormat.schema.properties?.units, 'COURSE_SCHEMA_MISSING');
    const courseId = randomUUID(), editionId = randomUUID(), unitId = randomUUID(), deliveryId = randomUUID();
    const courseInput = {title:'Percorso MCP',description:'Synthetic course',license:'Synthetic fixture',units:[{id:unitId,title:'One unit',objective:'Explain',prerequisites:'Units',explanation:'Model',prediction:'Predict',activity:'Try',referenceFeedback:'Reference',recovery:'Recover',transfer:'Transfer',sources:[],lesson:{documentId,revision}}]};
    const courseCommand = {kind:'save-course',commandId:randomUUID(),courseId,expectedRevision:0,input:courseInput};
    const coursePreview = await call(writer,'ardesia_preview_course',{workspaceId:workspace,command:courseCommand});
    const savedCourse = await apply(writer,coursePreview);
    check(savedCourse.course.revision === 1 && savedCourse.course.status === 'draft', 'COURSE_NOT_SAVED');
    check(isDeepStrictEqual((await apply(writer,coursePreview)).receipt,savedCourse.receipt), 'COURSE_RETRY_DUPLICATED');
    const editionPreview = await call(writer,'ardesia_preview_course',{workspaceId:workspace,command:{kind:'create-course-edition',commandId:randomUUID(),courseId,courseRevision:1,editionId,label:'Exact edition',expectedRevision:0}});
    const frozen = await apply(writer,editionPreview);
    check(frozen.edition.courseRevision === 1 && frozen.edition.courseDigest.length === 64, 'EDITION_NOT_FROZEN');
    const changedPreview = await call(writer,'ardesia_preview_course',{workspaceId:workspace,command:{...courseCommand,commandId:randomUUID(),expectedRevision:1,input:{...courseInput,title:'New draft'}}});
    await apply(writer,changedPreview);
    const editionRetry = await apply(writer,editionPreview);
    check(editionRetry.course.revision===1 && editionRetry.course.title==='Percorso MCP' && isDeepStrictEqual(editionRetry.receipt,frozen.receipt),'EDITION_RETRY_MIXED_REVISIONS');
    check((await call(reader,'ardesia_read_course',{workspaceId:workspace,courseId,revision:1,editionId})).course.title==='Percorso MCP','EDITION_LATEST_FALLBACK');
    await call(reader,'ardesia_read_course',{workspaceId:workspace,courseId,revision:1},'NOT_FOUND');
    await post({action:'course-command',workspaceId:workspace,command:{kind:'assign-course',commandId:randomUUID(),editionId,deliveryId,learnerId:student.accountId,expectedRevision:0}},teacher);
    await post({action:'course-command',workspaceId:workspace,command:{kind:'record-course-attempt',commandId:randomUUID(),deliveryId,unitId,stage:'prediction',attemptId:randomUUID(),answer:'PRIVATE_STUDENT_SENTINEL',expectedRevision:0}},student);
    await post({action:'course-command',workspaceId:workspace,command:{kind:'share-course-work',commandId:randomUUID(),deliveryId,shared:true,expectedRevision:1}},student);
    const searchedCourses = await call(reader,'ardesia_search_courses',{workspaceId:workspace,query:'Percorso'});
    check(searchedCourses.editions.length===1 && !('work' in searchedCourses), 'COURSE_SEARCH_LEAK');
    const courseReader = await start(student,[workspace]);
    check((await call(courseReader,'ardesia_read_course',{workspaceId:workspace,courseId,revision:1,editionId})).course.title==='Percorso MCP','ASSIGNED_COURSE_UNAVAILABLE');
    await post({action:'course-command',workspaceId:workspace,command:{kind:'revoke-course-delivery',commandId:randomUUID(),deliveryId,expectedRevision:1}},teacher);
    await call(courseReader,'ardesia_read_course',{workspaceId:workspace,courseId,revision:1,editionId},'NOT_FOUND');
    await close(courseReader);
    pass('official-client-course-authoring-edition-privacy-and-revocation');

    phase = 'lost-response-restart-recovery';
    const uncertainCommand = command({kind: 'rename-document', title: 'Energia elastica — lezione ricostruita'});
    const uncertainPreview = await prepare(writer, workspace, uncertainCommand); dropCommand = true;
    await call(writer, 'ardesia_apply_command', {proposalId: uncertainPreview.proposalId, commandDigest: uncertainPreview.commandDigest}, 'NETWORK_UNCERTAIN');
    const confirmedBeforeRetry = (await post({action: 'open-workspace', workspaceId: workspace}, teacher)).result;
    check(confirmedBeforeRetry.documents[0].revision === revision + 1, 'FAULT_DID_NOT_COMMIT');
    const eventCount = confirmedBeforeRetry.events.length;
    await close(writer); writer = await start(teacher, [workspace], 'read-write');
    const retryPreview = await prepare(writer, workspace, uncertainCommand); check(retryPreview.expectedRevisionMatches === false, 'RETRY_PRECONDITION_REWRITTEN');
    const recovered = await apply(writer, retryPreview), duplicate = await apply(writer, retryPreview);
    check(isDeepStrictEqual(recovered.receipt, duplicate.receipt), 'RECEIPT_CHANGED_ON_RETRY'); revision = recovered.receipt.documentRevision;
    const afterRetry = (await post({action: 'open-workspace', workspaceId: workspace}, teacher)).result;
    check(afterRetry.events.length === eventCount && afterRetry.documents[0].revision === revision, 'RETRY_DUPLICATED_EVENT');
    const collision = await prepare(writer, workspace, {...uncertainCommand, title: 'Different payload'});
    await call(writer, 'ardesia_apply_command', {proposalId: collision.proposalId, commandDigest: collision.commandDigest}, 'IDEMPOTENCY_CONFLICT');
    pass('lost-response-process-restart-identical-receipt-no-duplicate');

    phase = 'concurrent-conflict';
    const pending = await prepare(writer, workspace, command({kind: 'rename-document', title: 'Stale proposal'}));
    await post({action: 'command', workspaceId: workspace, command: command({kind: 'rename-document', title: 'User edit in web'})}, teacher); revision++;
    await call(writer, 'ardesia_apply_command', {proposalId: pending.proposalId, commandDigest: pending.commandDigest}, 'REVISION_CONFLICT');
    check((await call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId})).document.title === 'User edit in web', 'CONCURRENT_OVERWRITE');
    pass('concurrent-web-edit-cas-conflict');

    phase = 'student-isolation-revocation';
    await post({action: 'learning-command', workspaceId: workspace, command: {kind: 'assign-lesson', commandId: randomUUID(), documentId, studentId: student.accountId, expectedRevision: 0}}, teacher);
    const learner = await start(student, [workspace]);
    await post({action: 'learning-command', workspaceId: workspace, command: {kind: 'save-learner-note', commandId: randomUUID(), documentId, expectedRevision: 0, text: 'PRIVATE_STUDENT_SENTINEL'}}, student);
    await call(learner, 'ardesia_read_document', {workspaceId: workspace, documentId});
    await call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId});
    await call(learner, 'ardesia_read_object_revision', {workspaceId: workspace, documentId, objectId: formulaId, revision: 1}, 'NOT_FOUND');
    const outside = await start(outsider, [workspace]);
    await call(outside, 'ardesia_read_document', {workspaceId: workspace, documentId}, 'NOT_FOUND');
    const personal = (await post({action:'create-workspace',commandId:randomUUID(),title:'A learner’s own studio'},student)).result;
    check(personal.access==='owner' && personal.actor.role==='student', 'PERSONAL_ROLE_CHANGED');
    const author = await start(student,[workspace,personal.workspaceId],'read-write'), personalDoc = randomUUID();
    const own = async command => apply(author,await prepare(author,personal.workspaceId,command));
    await own({kind:'create-document',commandId:randomUUID(),documentId:personalDoc,expectedRevision:0,title:'Personal invention'});
    const personalType = {...extension,id:randomUUID(),provenance:{origin:'authored',sources:[]}};
    await own({kind:'add-object',commandId:randomUUID(),documentId:personalDoc,expectedRevision:1,object:personalType});
    await own({kind:'replace-object',commandId:randomUUID(),documentId:personalDoc,expectedRevision:2,object:{...personalType,data:{...personalType.data,state:{a:10,b:2}}}});
    const personalRead = await call(author,'ardesia_read_object_revision',{workspaceId:personal.workspaceId,documentId:personalDoc,objectId:personalType.id,revision:1});
    check(personalRead.object.data.state.a===6 && personalRead.object.provenance.createdBy===student.accountId,'PERSONAL_HISTORY_LOST');
    const ownCourse = randomUUID(), ownEdition = randomUUID();
    const personalCourse = await call(author,'ardesia_preview_course',{workspaceId:personal.workspaceId,command:{...courseCommand,commandId:randomUUID(),courseId:ownCourse,input:{...courseInput,units:[{...courseInput.units[0],lesson:{documentId:personalDoc,revision:3}}]}}});
    check((await apply(author,personalCourse)).course.ownerId===student.accountId,'PERSONAL_COURSE_NOT_OWNED');
    await apply(author,await call(author,'ardesia_preview_course',{workspaceId:personal.workspaceId,command:{kind:'create-course-edition',commandId:randomUUID(),courseId:ownCourse,courseRevision:1,editionId:ownEdition,label:'Personal edition',expectedRevision:0}}));
    check((await call(author,'ardesia_read_course',{workspaceId:personal.workspaceId,courseId:ownCourse,revision:1,editionId:ownEdition})).course.ownerId===student.accountId,'PERSONAL_COURSE_NOT_READABLE');
    await call(author,'ardesia_preview_command',{workspaceId:workspace,command:{kind:'create-document',commandId:randomUUID(),documentId:randomUUID(),expectedRevision:0,title:'Forbidden authoring in assigned space'}},'OWNER_REQUIRED');
    await call(author,'ardesia_preview_course',{workspaceId:workspace,command:{...courseCommand,commandId:randomUUID(),courseId:randomUUID()}},'OWNER_REQUIRED');
    await call(author,'ardesia_preview_tutor',{workspaceId:personal.workspaceId,command:tutorCommand},'FORBIDDEN');
    await post({action:'open-workspace',workspaceId:personal.workspaceId},teacher,404);
    check((await post({action:'session'},student)).result.account.role==='student','PERSONAL_ACCOUNT_PROMOTED');
    await close(author);
    pass('official-client-student-owned-type-course-history-and-assigned-write-refusal');
    await post({action: 'learning-command', workspaceId: workspace, command: {kind: 'revoke-assignment', commandId: randomUUID(), documentId, studentId: student.accountId, expectedRevision: 1}}, teacher);
    await call(learner, 'ardesia_read_document', {workspaceId: workspace, documentId}, 'NOT_FOUND');
    await close(learner); await close(outside);
    pass('student-private-records-excluded-and-assignment-revoked-live');

    phase = 'cancellation-eof';
    holdReads = true; const abort = new AbortController(), beforeHeld = heldReads;
    const cancelled = reader.client.callTool({name: 'ardesia_read_document', arguments: {workspaceId: workspace, documentId}}, {signal: abort.signal}).catch(() => null);
    await waitUntil(() => heldReads > beforeHeld); abort.abort(); await cancelled;
    await waitUntil(() => closedReads > 0); holdReads = false;
    await call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId});
    // A raw legacy opening additionally proves stdin EOF closes an in-flight upstream socket naturally.
    const child = spawn(process.execPath, [join(temporary, 'ardesia-mcp.mjs'), 'serve', '--config', reader.path], {cwd: temporary, env: {}, stdio: ['pipe', 'pipe', 'pipe']});
    rawChildren.add(child); let lines = ''; child.stdout.on('data', bytes => {lines += bytes.toString();}); child.stderr.resume();
    const exited = once(child, 'exit');
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'eof-probe', version: '1.0.0'}}}) + '\n');
    await waitUntil(() => lines.includes('"id":1'));
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
    holdReads = true; const previousHeld = heldReads, previousClosed = closedReads;
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'ardesia_read_document', arguments: {workspaceId: workspace, documentId}}}) + '\n');
    await waitUntil(() => heldReads > previousHeld); child.stdin.end();
    const exit = await Promise.race([exited, new Promise(resolve => {const timer = setTimeout(() => resolve('timeout'), 3000); timer.unref();})]);
    check(Array.isArray(exit) && exit[0] === 0 && exit[1] === null, 'EOF_DID_NOT_EXIT_NATURALLY'); rawChildren.delete(child);
    await waitUntil(() => closedReads > previousClosed); holdReads = false;
    pass('official-client-cancellation-and-eof-abort-upstream');

    phase = 'local-config-and-session-revocation';
    const oldConfig = JSON.parse(await readFile(writer.path, 'utf8'));
    const revocationPreview = await prepare(writer, workspace, command({kind: 'rename-document', title: 'Must not be sent'}));
    holdReads = true; const gateHeld = heldReads, commandsBeforeGate = commandRequests;
    const gatedWrite = call(writer, 'ardesia_apply_command', {proposalId: revocationPreview.proposalId, commandDigest: revocationPreview.commandDigest}, 'CONFIGURATION_CHANGED');
    await waitUntil(() => heldReads > gateHeld); await writeFile(writer.path, JSON.stringify({...oldConfig, access: 'read-only'}));
    await held.pop()(); holdReads = false; await gatedWrite; check(commandRequests === commandsBeforeGate, 'REVOKED_CONFIG_SENT_WRITE');
    await call(writer, 'ardesia_read_document', {workspaceId: workspace, documentId}, 'CONFIGURATION_CHANGED');
    holdReads = true; const readHeld = heldReads, readConfig = await readFile(reader.path, 'utf8');
    const gatedRead = call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId}, 'CONFIGURATION_CHANGED');
    await waitUntil(() => heldReads > readHeld); await writeFile(reader.path, JSON.stringify({...JSON.parse(readConfig), workspaceIds: [otherWorkspace]}));
    await held.pop()(); holdReads = false; await gatedRead; await writeFile(reader.path, readConfig);
    await post({action: 'logout'}, teacher);
    await call(reader, 'ardesia_read_document', {workspaceId: workspace, documentId}, 'UNAUTHENTICATED');
    pass('configuration-change-and-session-logout-fail-closed');
    report.observed = {commandRequests, successfulHttpWriteResponses: writeReceipts, exactDocumentRevision: revision,
      privateLearnerDataReturned: false, credentialsReturned: false, aiInferenceUsed: false};
  } catch (error) {failure = {phase, code: error.checkCode ?? 'UNEXPECTED_FAILURE'};}
  finally {
    async function clean(code, work) {try {await work();} catch {failure ??= {phase: 'cleanup', code};}}
    await clean('MCP_CLIENT_CLOSE', () => Promise.all([...clients].map(client => client.close())));
    for (const child of rawChildren) {child.kill('SIGKILL'); await once(child, 'exit').catch(() => undefined);}
    if (http) await clean('HTTP_CLOSE', () => new Promise(resolve => {http.closeAllConnections(); http.close(() => resolve());}));
    await clean('POOLS_CLOSE', async () => {await runtime?.end(); await operator?.end();});
    if (databaseCreated) await clean('DATABASE_DROP', () => admin.query(`DROP DATABASE ${database} WITH (FORCE)`));
    if (roleCreated) await clean('ROLE_DROP', () => admin.query(`DROP ROLE ${role}`));
    await clean('ADMIN_CLOSE', async () => {await admin?.end(); await setup?.close();});
    if (temporary) await clean('TEMP_CLEANUP', () => rm(temporary, {recursive: true, force: true}));
  }
  if (!failure && identity().sourceDigest !== source.sourceDigest) failure = {phase: 'identity', code: 'SOURCE_CHANGED_DURING_TEST'};
  if (!failure) pass('isolated-resource-cleanup');
  report.durationMs = Date.now() - started; report.passed = !failure; if (failure) report.failure = failure;
  await mkdir(resolve(root, 'artifacts'), {recursive: true}); await writeFile(resolve(root, 'artifacts/mcp-runtime.json'), JSON.stringify(report, null, 2) + '\n');
  if (failure) throw new Error(`MCP runtime failed: ${failure.phase}/${failure.code}`);
  console.log(`MCP runtime: PASS (${report.checks.length} checks; official external client, stdio, real HTTP/PostgreSQL).`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {await verifyMcpRuntime();} catch (error) {console.error(error.message); process.exitCode = 1;}
}
