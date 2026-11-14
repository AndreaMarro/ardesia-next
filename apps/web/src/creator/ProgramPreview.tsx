import {useEffect,useRef,useState,type ComponentType} from 'react';
import {canonicalJson,type ExtensionData} from '@ardesia/contracts';

type Props={data:ExtensionData;onChange?:(state:ExtensionData['state'])=>void};
/** This gate never imports the interpreter. Its permission lives only in this mounted, exact definition. */
export function ProgramPreview(props:Props){
  const identity=canonicalJson(props.data.definition);
  return <ProgramGate key={identity} {...props}/>;
}
function ProgramGate({data,onChange}:Props){
  const [Surface,setSurface]=useState<ComponentType<Props>>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const epoch=useRef(0);
  useEffect(()=>()=>{epoch.current++;},[]);
  useEffect(()=>{if(!onChange){epoch.current++;setSurface(undefined);setLoading(false);}},[!!onChange]);
  async function start(){const request=++epoch.current;setLoading(true);setError('');try{const module=await import('./ProgramSurface');if(epoch.current===request)setSurface(()=>module.ProgramSurface);}catch{if(epoch.current===request)setError('Anteprima non disponibile. La definizione è conservata.');}finally{if(epoch.current===request)setLoading(false);}}
  if(Surface&&onChange)return <Surface data={data} onChange={onChange}/>;
  return <section className="program-gate"><span className="program-kicker">Programma · versione {data.definition.version}</span><p>{data.definition.fallback}</p>
    {onChange?<><p className="hint">Usa soltanto i valori di questo oggetto, senza accesso a Internet o ai tuoi altri dati. Puoi interromperlo in ogni momento. I risultati restano una bozza finché li salvi.</p><button type="button" className="primary-button" disabled={loading} onClick={()=>void start()}>{loading?'Preparazione…':'Avvia questa versione'}</button></>:<p className="hint">Apri le proprietà per avviare questa esperienza.</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
