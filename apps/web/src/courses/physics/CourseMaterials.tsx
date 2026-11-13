import type {InkObject,LessonDocument,EducationalObject} from '@ardesia/contracts';
import {useEffect,useState} from 'react';
import {ObjectContent} from '../../components/ObjectContent';
export const QUESTION_TYPE='ardesia.curriculum.question';
export function courseQuestion(object:EducationalObject){
 if(object.type!=='extension'||object.data.definition.typeId!==QUESTION_TYPE||object.data.definition.version!==1)return null;
 const state=object.data.state;
 if(!['questionId','prompt','solution','level','kind','objectives','source'].every(k=>typeof state[k]==='string'))return null;
 return state as Record<'questionId'|'prompt'|'solution'|'level'|'kind'|'objectives'|'source',string>;
}
export function CourseMaterials({document,blocked,openSolutions,onReveal,onQuestion}:{document:LessonDocument;blocked:boolean;openSolutions:string[];onReveal:(id:string)=>void;onQuestion:(object:EducationalObject)=>void}){
 const [search,setSearch]=useState(''),[kind,setKind]=useState(''),[level,setLevel]=useState('');
 useEffect(()=>{setSearch('');setKind('');setLevel('');},[document.id,document.revision]);
 const questions=document.objects.filter(o=>!!courseQuestion(o)),others=document.objects.filter(o=>!courseQuestion(o)&&(o.type!=='ink'||!o.data.anchor));
 const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const terms=normalize(search).trim().split(/\s+/).filter(Boolean);
 const visible=questions.filter(object=>{const q=courseQuestion(object)!;return (!kind||q.kind===kind)&&(!level||q.level===level)&&terms.every(term=>normalize([object.title,q.prompt,q.objectives].join(' ')).includes(term));});
 const reset=()=>{setSearch('');setKind('');setLevel('');};
 return <><div className="course-linked-materials">{others.map(object=><details key={object.id} className="course-material" open={object.type==='extension'}><summary>{object.title}</summary>{object.type==='lab'?<p>Laboratorio {object.data.pluginId} · versione {object.data.pluginVersion}. Esecuzione non abilitata dal collegamento al corso.</p>:<ObjectContent object={object} links annotations={document.objects.filter((o):o is InkObject=>o.type==='ink'&&o.data.anchor?.objectId===object.id)}/>}</details>)}</div>
 {!!questions.length&&<section className="course-question-bank" aria-label="Esercizi e verifiche dell’unità"><h3>Metti alla prova il ragionamento.</h3><p>Seleziona una domanda e scrivi i passaggi nello spazio di risposta. Il tentativo conserverà il riferimento a questa versione.</p>
 <div className="course-practice-filters"><label>Cerca argomento o obiettivo<input type="search" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Tipo di domanda<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Tutti i tipi</option><option value="original">Problemi originali</option><option value="practice">Esercizi</option><option value="assessment">Verifiche per obiettivo</option></select></label><label>Livello dichiarato<select value={level} onChange={e=>setLevel(e.target.value)}><option value="">Tutti i livelli</option>{[...new Set(questions.map(object=>courseQuestion(object)!.level))].map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>
 <p role="status">{visible.length} di {questions.length} domande{!visible.length&&' · Nessun risultato: modifica o azzera i filtri.'}</p>{(search||kind||level)&&<button className="text-button" onClick={reset}>Azzera i filtri</button>}
 {visible.map(object=>{const q=courseQuestion(object)!;return <details key={object.id} className="course-material"><summary>{q.kind==='assessment'?'Verifica':q.kind==='original'?'Problema originale':'Esercizio'} · {object.title}</summary><p className="hint">{q.objectives} · {q.level} · Bozza</p><p className="course-rich-text">{q.prompt}</p><button className="primary-button" disabled={blocked} onClick={()=>onQuestion(object)}>Rispondi a questa domanda</button><button className="text-button" disabled={blocked} onClick={()=>onReveal(object.id)}>Confronta con la soluzione</button>{openSolutions.includes(object.id)&&<div className="course-reference-solution"><h4>Ragionamento di riferimento</h4><p className="course-rich-text">{q.solution}</p></div>}<details><summary>Provenienza della domanda</summary><p className="course-rich-text hint">{q.source}</p></details></details>;})}</section>}
 </>;
}
