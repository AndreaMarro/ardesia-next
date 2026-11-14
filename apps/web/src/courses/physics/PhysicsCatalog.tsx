import {useState} from 'react';
import type {Course} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {importPhysicsCourse} from './import';
import {physicsCatalog} from './catalog';
import {startPhysicsStudy,personalPhysicsDelivery} from './start';
export default function PhysicsCatalog({client,onImported,onBusy,onStudy}:{client:RemoteClient;onStudy:(deliveryId:string)=>void;onImported:(course:Course)=>void;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(''),[progress,setProgress]=useState(''),[error,setError]=useState('');
 async function add(id:string,study=false){
  if(busy)return;const row=physicsCatalog.find(c=>c.id===id)!;setBusy(id);onBusy(true);setError('');
  try{let course=client.core.getCourseSpace(client.projection!.actor).courses.find(c=>c.id===id);if(!course){const response=await fetch(row.url);if(!response.ok)throw Error('Materiali del corso non disponibili.');course=await importPhysicsCourse(client,await response.json(),setProgress);}if(study)onStudy(await startPhysicsStudy(client,course));else onImported(course);}
  catch(reason){setError(reason instanceof Error?reason.message:'Importazione interrotta. Puoi riprenderla senza duplicare i materiali.');}
  finally{setBusy('');onBusy(false);setProgress('');}
 }
 return <section className="physics-catalog" aria-label="Cinque microcorsi di Fisica"><div className="course-section-title"><h2>Fisica, dalle idee alle prove.</h2><span>Medicina · semestre filtro 2026/2027</span></div><p>Sette unità del syllabus, cinque percorsi e 200 sotto-obiettivi editoriali. Spiegazioni, indagini, verifiche e oggetti da portare in lavagna.</p><p className="hint">Contenuti in bozza, revisione scientifica umana da completare. I 200 sotto-obiettivi dettagliano il syllabus: non sono 200 obiettivi ufficiali del MUR.</p>
  <div className="course-grid">{physicsCatalog.map((course,index)=><article className="course-card" key={course.id}><span className="course-tag">0{index+1} · {course.syllabus}</span><h3>{course.title}</h3><p>{course.description}</p><p className="hint">{course.units} unità · {course.objectives} obiettivi · {course.labs} laboratori distinti</p><footer><button className="primary-button" disabled={!!busy||client.state.pending.length>0} onClick={()=>void add(course.id,true)}>{personalPhysicsDelivery(client.core.getCourseSpace(client.projection!.actor),course.id,client.projection!.actor.actorId)?'Riprendi lo studio':'Inizia a studiare'}</button><button className="secondary-button" disabled={!!busy||client.state.pending.length>0} onClick={()=>void add(course.id)}>{client.core.getCourseSpace(client.projection!.actor).courses.some(c=>c.id===course.id)?'Apri il corso':'Aggiungi al mio spazio'}</button></footer></article>)}</div>
  {progress&&<p role="status">Preparazione delle lezioni · {progress}. Puoi riprendere un’importazione interrotta da questa raccolta.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
