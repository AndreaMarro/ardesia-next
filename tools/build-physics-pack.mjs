// Generated course assets come only from the editorial inputs below; human approval remains separate.
// Declarative lab integration: Risultato del lavoro di una chat Pro.
// Run with Node24: node tools/build-physics-pack.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {extensionDefinitionDigest,ExtensionDataSchema,ExtensionDefinitionSchema,CompositionBodySchema,COMPOSITION_RENDERER} from '../packages/contracts/src/index.ts';
import {physicsLabData,physicsLabs} from '../apps/web/src/science/labs.ts';
import {PhysicsImportSchema} from '../apps/web/src/courses/physics/import.ts';
const root=new URL('../',import.meta.url),input=new URL('../docs/sources/physics-2026-27/editorial/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name+'.json',input),'utf8'));
const courses=read('courses'),units=read('units'),coverage=read('coverage'),bank=read('bank-selection'),assessments=read('assessments'),experiments=read('experiments'),media=JSON.parse(readFileSync(new URL('docs/sources/physics-2026-27/media-resources.json',root),'utf8'));
const originals=JSON.parse(readFileSync(new URL('original-problems.json',input),'utf8'));
// The existing portable extension contract is also the authoring contract. No new runtime registry.
const authoredLabs=new Map();
for(const row of read('lab-definitions')){
 if(typeof row.id!=='string'||!/^[a-z][a-z0-9-]+$/.test(row.id)||authoredLabs.has(row.id)||physicsLabs.some(l=>l.id===row.id))throw Error('Duplicate or invalid authored lab: '+row.id);
 const definition=ExtensionDefinitionSchema.parse(row.definition);
 if([...physicsLabs.map(l=>l.definition),...Array.from(authoredLabs.values(),l=>l.data.definition)].some(d=>d.typeId===definition.typeId))throw Error('Duplicate authored lab type: '+definition.typeId);
 if(definition.renderer!==COMPOSITION_RENDERER)throw Error('Authored lab needs the existing composition renderer: '+row.id);
 const body=CompositionBodySchema.parse(definition.body),data=ExtensionDataSchema.parse({definition,definitionDigest:await extensionDefinitionDigest(definition),state:Object.fromEntries(body.fields.map(f=>[f.key,f.initial]))});
 authoredLabs.set(row.id,{title:definition.name,data});
}
const fields=['questionId','prompt','solution','level','kind','objectives','source'];
const definition={format:'ardesia-extension/1',typeId:'ardesia.curriculum.question',version:1,name:'Domanda ragionata',description:'Un quesito con provenienza e soluzione commentata, riutilizzabile come oggetto del Creator. Bozza; revisione umana pendente.',license:'Patrimonio originale Ardesia; tutti i diritti riservati',renderer:COMPOSITION_RENDERER,
 body:{fields:fields.map(key=>({key,label:key,kind:'text',initial:''})),nodes:[{id:'prompt',kind:'value',props:{label:'Domanda',expression:'prompt'}},{id:'solution',kind:'value',props:{label:'Soluzione di riferimento',expression:'solution'}},{id:'source',kind:'value',props:{label:'Provenienza',expression:'source'}}]},fallback:'Domanda ragionata; consulta i campi prompt, solution e source nella definizione portabile.'};
const definitionDigest=await extensionDefinitionDigest(definition),catalog=[],sizes=[],distributedCoverage=[];
const choiceDefinition=ExtensionDefinitionSchema.parse(read('choice-question-definition'));
const choiceDefinitionDigest=await extensionDefinitionDigest(choiceDefinition);
for(const course of courses){
 const courseId=course.id+'-v1',docs=[];let practice=0,final=0,originalCount=0;const labSet=new Set();
 for(const unit of course.input.units){
  const map=units.find(row=>row.unitId===unit.id),rows=coverage.filter(row=>row.unitId===unit.id);
  unit.activity=unit.activity.replace('riproduzione e revisione audiovisiva integrale non verificate.', 'avvio della riproduzione osservato, revisione audiovisiva integrale da completare.');
  for(const source of unit.sources){const video=media.find(v=>v.url===source.url);if(video)source.revision='Titolo e autore verificati nel browser · 2026-11-07; avvio riproduzione osservato; revisione audiovisiva integrale NOT_RUN';}
  const doc={id:courseId+':'+unit.id,title:unit.title+' · '+course.input.title,objects:[]};
  const add=(type,title,data,id,provenance)=>{const i=doc.objects.length;doc.objects.push({id:doc.id+':'+id,type,title:title.slice(0,240),x:80+(i%3)*700,y:80+Math.floor(i/3)*500,width:type==='extension'&&id.startsWith('lab')?620:560,height:400,data,...(provenance?{provenance}:{})});};
  for(const [i,source] of unit.sources.entries())add('source',source.title,{url:source.url,publisher:source.title,locator:'Unità '+unit.id,sourceRevision:source.revision,license:source.license},'source'+i);
  const provenance={origin:'imported',sources:unit.sources.map((source,i)=>({sourceId:doc.id+':source'+i,revision:1,locator:i?'Testo e obiettivi del patrimonio Ardesia; revisione editoriale 7 novembre 2026':'Perimetro syllabus '+map.syllabusUnitId+'; pagine '+map.sourcePages.join(', ')}))};
  add('note','Comprendere · '+unit.title,{text:unit.explanation},'explanation',provenance);
  add('note','Prevedi, prova, interpreta',{text:unit.prediction+'\n\n'+unit.activity+'\n\nRecupero\n'+unit.recovery+'\n\nApplicazione nuova\n'+unit.transfer},'inquiry',provenance);
  add('note','Copertura degli obiettivi',{text:'Syllabus MUR 2026/2027 · '+map.syllabusUnitId+' · pagine '+map.sourcePages.join(', ')+'\nI codici sotto sono sotto-obiettivi editoriali Ardesia. Mappatura di risorse, non certificazione di competenza o revisione scientifica umana.\n\n'+rows.map(row=>row.objectiveId+' · '+row.label+'\nSpiegazione: questa unità; indagine guidata '+row.experimentId+' (attività di famiglia).\nPratica di famiglia: '+row.exerciseIds.join(', ')+'.\nProblemi originali specifici: '+(originals.filter(q=>q.objectiveIds.includes(row.objectiveId)).map(q=>q.id).join(', ')||'nessuno in questa espansione')+'.\nLaboratori specifici: '+(row.labIds.length?row.labIds.join(', '):'nessun laboratorio digitale specifico')+'.\nVerifica puntuale: '+row.finalAssessmentId+'.').join('\n\n')},'coverage',provenance);
  for(const [i,id] of map.labIds.entries()){
   const authored=authoredLabs.get(id),builtin=physicsLabs.find(l=>l.id===id);
   if(!authored&&!builtin)throw Error('Unknown lab: '+id+' in '+unit.id);
   labSet.add(id);add('extension',authored?.title??builtin.title,authored?.data??await physicsLabData(id),'lab'+i,{origin:'authored',sources:provenance.sources});
  }
  function question(q,kind){
   const selected=kind==='assessment',original=kind==='original',choice=q.choices!==undefined||q.correctChoice!==undefined;
   if(choice&&(!original||!Array.isArray(q.choices)||q.choices.length!==5||q.choices.some((o,i)=>o.id!=='ABCDE'[i]||typeof o.text!=='string'||!o.text.trim()||typeof o.feedback!=='string'||!o.feedback.trim())||!q.choices.some(o=>o.id===q.correctChoice)||new Set(q.choices.map(o=>o.text.trim().toLowerCase())).size!==5))throw Error('Invalid guided alternatives: '+q.id);
   const options=choice?q.choices.map(o=>o.id+') '+o.text).join('\n'):selected||original?'':q.options.map(o=>o.id+') '+o.text).join('\n');
   const state={questionId:q.id,prompt:q.prompt+(options?'\n\n'+options:''),solution:selected?(q.answer===q.feedback?q.answer:q.answer+'\n\n'+q.feedback):q.solution,level:selected?'Verifica per obiettivo':original?q.level:q.difficulty.level,kind,
    objectives:selected?q.objectiveId:original?q.objectiveIds.join(', '):map.familyId+' · pratica della famiglia',source:JSON.stringify(selected?q.source:original?(q.source??{origin:'authored',revision:'original-2026-11-07',noveltyNote:q.noveltyNote,comparison:'Confronto contro259selezionati e4klegacy: non certificazione di unicità semantica'}):q.provenance,null,2)+'\nDRAFT · revisione umana NOT_RUN. Controlli numerici non equivalgono a validazione didattica.'};
   const data=choice?ExtensionDataSchema.parse({definition:choiceDefinition,definitionDigest:choiceDefinitionDigest,state:{...state,...Object.fromEntries(q.choices.map(o=>['feedback'+o.id,o.feedback])),correct:'ABCDE'.indexOf(q.correctChoice)+1,choice:0}}):{definition,definitionDigest,state};
   add('extension',selected?q.objectiveId+' · '+rows.find(r=>r.objectiveId===q.objectiveId).label:q.title,data,q.id,original?{origin:'authored',sources:provenance.sources.slice(0,1)}:provenance);
  }
  for(const id of map.exerciseIds){const q=bank.find(q=>q.id===id);if(!q)throw Error(id);question(q,'practice');practice++;}
  for(const q of originals.filter(q=>q.unitId===unit.id)){question(q,'original');originalCount++;}
  for(const q of assessments.filter(q=>q.unitId===unit.id)){question(q,'assessment');final++;}
  for(const video of media.filter(v=>v.unitId===unit.id)){
   add('source',video.title,{url:video.url,publisher:video.publisher,locator:video.objectiveIds.join(', '),sourceRevision:'Disponibilità '+video.verification.currentAvailability+'; riproduzione '+video.verification.playback+' · 7 novembre 2026',license:video.reuse},video.id);
   add('note','Prima e dopo il video',{text:video.title+'\nPrima: '+video.before+'\nDopo: '+video.after+'\nAttenzione: '+video.caution+'\nLingua originale: inglese. La lingua/doppiaggio effettivi dipendono dal lettore. Revisione audiovisiva integrale non eseguita. Video facoltativo; il percorso resta utilizzabile senza il video.'},video.id+':activity',provenance);
  }
  unit.lesson={documentId:doc.id,revision:doc.objects.length+1};docs.push(doc);
  for(const row of rows)distributedCoverage.push({...row,courseId,lesson:unit.lesson,practiceObjectIds:row.exerciseIds.map(id=>doc.id+':'+id),originalProblemObjectIds:originals.filter(q=>q.unitId===unit.id&&q.objectiveIds.includes(row.objectiveId)).map(q=>doc.id+':'+q.id),assessmentObjectId:doc.id+':'+row.finalAssessmentId,labObjectIds:row.labIds.map(id=>doc.id+':lab'+map.labIds.indexOf(id))});
 }
 const pack=PhysicsImportSchema.parse({format:'ardesia-physics-course/1',courseId,input:course.input,documents:docs,counts:{objectives:coverage.filter(r=>r.courseId===course.id).length,practice,originals:originalCount,assessments:final,labs:labSet.size},status:'DRAFT',humanApproval:false,sourceRevision:course.sourceRevision??'5cfbdcb055ba3ba136f97fb56e997f06e6cf3605; editorial-2026-11-07; source-manifest.json'});
 const name=course.id+'.json',bytes=Buffer.from(JSON.stringify(pack));writeFileSync(new URL('apps/web/src/courses/physics/data/'+name,root),bytes);
 catalog.push({id:courseId,title:course.input.title,description:course.input.description.split(' Percorso in revisione:')[0],syllabus:course.syllabusUnitIds.join(' + '),units:docs.length,objectives:pack.counts.objectives,labs:labSet.size,filename:name});
 sizes.push({file:name,bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:createHash('sha256').update(bytes).digest('hex'),counts:pack.counts,objects:docs.reduce((n,d)=>n+d.objects.length,0)});
}
writeFileSync(new URL('apps/web/src/courses/physics/catalog.ts',root),catalog.map((c,i)=>`import course${i} from './data/${c.filename}?url';`).join('\n')+'\nexport const physicsCatalog=[\n'+catalog.map(({filename,...c},i)=>` {...${JSON.stringify(c)},url:course${i}},`).join('\n')+'\n];\n');
writeFileSync(new URL('docs/sources/physics-2026-27/distributed-assets.json',root),JSON.stringify({format:'ardesia-physics-assets/1',counts:{courses:5,units:38,objectives:200,bankSelected:bank.length,originalProblems:originals.length},files:sizes,totalRawBytes:sizes.reduce((n,v)=>n+v.bytes,0),totalGzipBytes:sizes.reduce((n,v)=>n+v.gzipBytes,0),note:'Static JSON course materials, fetched only on explicit import; not JavaScript. Full data costs shown separately from measured runtime budgets.'},null,2));
writeFileSync(new URL('docs/sources/physics-2026-27/distributed-coverage.json',root),JSON.stringify(distributedCoverage,null,2));
console.log(JSON.stringify(sizes));
