import type {InkObject,LessonDocument,EducationalObject} from '@ardesia/contracts';
import {ObjectContent} from '../../components/ObjectContent';
export const QUESTION_TYPE='ardesia.curriculum.question';
export function courseQuestion(object:EducationalObject){
 if(object.type!=='extension'||object.data.definition.typeId!==QUESTION_TYPE||object.data.definition.version!==1)return null;
 const state=object.data.state;
 if(!['questionId','prompt','solution','level','kind','objectives','source'].every(k=>typeof state[k]==='string'))return null;
 return state as Record<'questionId'|'prompt'|'solution'|'level'|'kind'|'objectives'|'source',string>;
}
export function CourseMaterials({document,blocked,openSolutions,onReveal,onQuestion}:{document:LessonDocument;blocked:boolean;openSolutions:string[];onReveal:(id:string)=>void;onQuestion:(object:EducationalObject)=>void}){
 const questions=document.objects.filter(o=>!!courseQuestion(o)),others=document.objects.filter(o=>!courseQuestion(o)&&(o.type!=='ink'||!o.data.anchor));
 return <><div className="course-linked-materials">{others.map(object=><details key={object.id} className="course-material" open={object.type==='extension'}><summary>{object.title}</summary>{object.type==='lab'?<p>Laboratorio {object.data.pluginId} · versione {object.data.pluginVersion}. Esecuzione non abilitata dal collegamento al corso.</p>:<ObjectContent object={object} links annotations={document.objects.filter((o):o is InkObject=>o.type==='ink'&&o.data.anchor?.objectId===object.id)}/>}</details>)}</div>
 {!!questions.length&&<section className="course-question-bank" aria-label="Esercizi e verifiche dell’unità"><h3>Metti alla prova il ragionamento.</h3><p>Seleziona una domanda e scrivi i passaggi nello spazio di risposta. Il tentativo conserverà il riferimento a questa versione.</p>{questions.map(object=>{const q=courseQuestion(object)!;return <details key={object.id} className="course-material"><summary>{q.kind==='assessment'?'Verifica':q.kind==='original'?'Problema originale':'Esercizio'} · {object.title}</summary><p className="hint">{q.objectives} · {q.level} · Bozza</p><p className="course-rich-text">{q.prompt}</p><button className="primary-button" disabled={blocked} onClick={()=>onQuestion(object)}>Rispondi a questa domanda</button><button className="text-button" disabled={blocked} onClick={()=>onReveal(object.id)}>Confronta con la soluzione</button>{openSolutions.includes(object.id)&&<div className="course-reference-solution"><h4>Ragionamento di riferimento</h4><p className="course-rich-text">{q.solution}</p></div>}<details><summary>Provenienza della domanda</summary><p className="course-rich-text hint">{q.source}</p></details></details>;})}</section>}
 </>;
}
