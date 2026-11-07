import {useEffect,useState} from 'react';
import type {ExtensionData} from '@ardesia/contracts';
import {ExtensionExperiment} from '../creator/ExtensionView';
import {physicsLabs,physicsLabData} from './labs';
import './science.css';

export default function PhysicsWorkbench({ids,onUse,onClose}:{ids?:string[];onUse?:(data:ExtensionData)=>void;onClose?:()=>void}){
 const labs=physicsLabs.filter(l=>!ids||ids.includes(l.id));
 const [selected,setSelected]=useState(labs[0]?.id??''),[data,setData]=useState<ExtensionData|null>(null),[error,setError]=useState('');
 const lab=labs.find(l=>l.id===selected)??labs[0];
 useEffect(()=>{let active=true;setData(null);setError('');if(lab)void physicsLabData(lab.id).then(data=>{if(active)setData(data);}).catch(()=>{if(active)setError('Laboratorio non disponibile.');});return()=>{active=false;};},[lab?.id]);
 if(!lab)return null;
 function exportLab(){if(!data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=lab!.id+'.ardesia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="physics-workbench" aria-label="Laboratori di fisica">
  <header><div><span className="eyebrow">Misura · confronta · spiega</span><h2>La fisica prende forma.</h2></div>{onClose&&<button className="text-button" onClick={onClose}>Chiudi laboratori</button>}</header>
  <div className="physics-layout"><nav aria-label="Scegli laboratorio">{labs.map((value,index)=><button key={value.id} aria-pressed={lab.id===value.id} onClick={()=>setSelected(value.id)}><span>{String(index+1).padStart(2,'0')}</span>{value.title}</button>)}</nav>
   <article><h3>{lab.title}</h3><details open><summary>Prima di toccare i controlli</summary><p>{lab.prediction}</p></details>
    {error&&<p role="alert">{error}</p>}{data&&<ExtensionExperiment key={lab.id} data={data}/>}
    <div className="physics-inquiry"><h4>Un esperimento, una spiegazione</h4><p>{lab.procedure}</p><details><summary>Ipotesi e limiti del modello</summary><p>{lab.limits}</p><p>Controlli numerici automatici sul modello; revisione didattica umana ancora da completare.</p></details></div>
    <footer>{onUse&&<button className="primary-button" disabled={!data} onClick={()=>data&&onUse(data)}>Usa questo laboratorio nel Creator</button>}<button className="secondary-button" disabled={!data} onClick={exportLab}>Esporta oggetto riutilizzabile</button></footer>
   </article>
  </div>
 </section>;
}
