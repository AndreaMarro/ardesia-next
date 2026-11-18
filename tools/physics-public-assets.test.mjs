import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
const base=resolve('apps/web/public/fisica');
const read=file=>readFileSync(file,'utf8');
const json=file=>JSON.parse(read(file));
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('the reading edition preserves source content and links each page to the exact editorial and course packs',()=>{
 const manifest=json(base+'/lessons-manifest.json');
 const editorial='docs/sources/physics-2026-27/editorial/courses.json';
 assert.equal(manifest.sourceSha256,hash(editorial));assert.equal(manifest.humanApproval,false);
 assert.equal(manifest.pages.length,38);assert.equal(new Set(manifest.pages.map(p=>p.unitId)).size,38);
 assert.equal(manifest.sourcePacks.length,5);
 const packs=new Map(manifest.sourcePacks.map(p=>{assert.equal(p.sha256,hash(p.file));const pack=json(p.file);return [p.file,pack];}));
 for(const course of json(editorial)){
  const pack=packs.get(`apps/web/src/courses/physics/data/${course.id}.json`);
  assert.ok(pack,'source course pack exists');
  for(const unit of course.input.units){
   const page=manifest.pages.find(p=>p.unitId===unit.id);assert.ok(page);
   const path=base+'/'+page.file,html=read(path);assert.equal(page.sha256,hash(path));
   for(const field of ['title','objective','prerequisites','explanation','prediction','activity','referenceFeedback','transfer','recovery'])
    for(const paragraph of String(unit[field]).split(/\n\s*\n/).filter(Boolean))assert.ok(html.includes(escape(paragraph)),unit.id+': '+field);
   const ref=pack.input.units.find(u=>u.id===unit.id).lesson;
   const document=pack.documents.find(d=>d.id===ref.documentId);
   const questions=document.objects.filter(o=>o.type==='extension'&&['ardesia.curriculum.question','ardesia.curriculum.choice-question'].includes(o.data.definition.typeId)&&['original','assessment'].includes(o.data.state.kind));
   assert.equal(page.questions,questions.length);
   for(const {data:{state:q}} of questions)for(const key of ['prompt','solution',...Object.keys(q).filter(k=>/^feedback[A-E]$/.test(k))])
    for(const paragraph of q[key].split(/\n\s*\n/).filter(Boolean))assert.ok(html.includes(escape(paragraph)),unit.id+': '+key);
  }
 }
});

test('every relative public page resource and local anchor resolves, and offline manifest includes all lessons and lab runtimes',()=>{
 const files=readdirSync(base),htmlFiles=files.filter(f=>f.endsWith('.html'));
 for(const file of htmlFiles){
  const html=read(base+'/'+file);
  for(const [,url] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
   if(/^(?:[a-z]+:|\/)/i.test(url))continue;
   const [pathname,anchor]=url.split('#'),target=resolve(dirname(base+'/'+file),pathname||file);
   assert.ok(!relative(base,target).startsWith('..'),'local path stays inside edition');
   assert.ok(existsSync(target),file+' → '+url);
   if(anchor&&target.endsWith('.html'))assert.match(read(target),new RegExp(`id=["']${anchor}["']`),file+' → '+url);
  }
 }
 const exam=json(base+'/exam-manifest.json');
 for(const file of [...htmlFiles,'exam.js','campo.js','demo.js','urti.js','termodinamica.js','quaderno-esperimenti.pdf','practice.js','practice.css'])assert.ok(exam.offlineFiles.includes(file),file+' missing in offline edition');
 for(const entry of exam.files)assert.equal(entry.sha256,hash(base+'/'+entry.file));
 assert.equal(exam.sourceSha256,hash(exam.sourceFile));
});

test('each reviewed bank record has exactly one interactive lesson entry and an indexed origin', () => {
 const manifest=json(base+'/practice-manifest.json');
 const catalog=read(base+'/'+manifest.catalog);
 const editorial='docs/sources/physics-2026-27/question-review';
 const origins=new Map(json(editorial+'/origins.json').map(origin=>[origin.id,origin]));
 assert.equal(manifest.catalogSHA256,hash(base+'/'+manifest.catalog));
 assert.equal(manifest.humanApproval,false);
 assert.equal(manifest.rows.length,origins.size);
 assert.equal(new Set(manifest.rows.map(row=>row.id)).size,origins.size);
 for(const row of manifest.rows){
  const origin=origins.get(row.id);
  assert.equal(row.originalSHA256,origin.sha256);
  assert.equal(row.lesson,origin.lessonId+'.html');
  assert.ok(catalog.includes('./'+row.lesson+'#'+row.id));
  const page=read(base+'/'+row.lesson);
  assert.equal(page.split("id='"+row.id+"'").length,2);
  assert.ok(page.includes("src='./practice.js'"));
 }
});
