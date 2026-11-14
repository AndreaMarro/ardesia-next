import {ProgramPreview} from './ProgramPreview';
import {useMemo, useState} from 'react';
import {compositionBody, compileExpression} from '@ardesia/plugin-host';
import {PROGRAM_RENDERER,ProgramBodySchema,canonicalJson, type CompositionNode, type ExtensionData, type ExtensionValue} from '@ardesia/contracts';

const format=(v:ExtensionValue|undefined)=>typeof v==='number'?new Intl.NumberFormat('it-IT',{maximumSignificantDigits:6}).format(v):String(v??'');
const axis=(v:number)=>new Intl.NumberFormat('it-IT',{maximumSignificantDigits:3,notation:Math.abs(v)>=1e6||v!==0&&Math.abs(v)<1e-3?'scientific':'standard'}).format(v);
export function ExtensionView({data,onChange}:{data:ExtensionData;onChange?:(state:ExtensionData['state'])=>void}){
  const body=useMemo(()=>compositionBody(data),[data.definitionDigest,canonicalJson(data.definition)]);
  const [actionError,setActionError]=useState('');
  if(data.definition.renderer===PROGRAM_RENDERER&&ProgramBodySchema.safeParse(data.definition.body).success)return <ProgramPreview data={data} onChange={onChange}/>;
  if(!body)return <div className="extension-fallback"><p>{data.definition.fallback}</p><small>Renderer {data.definition.renderer} non disponibile. La definizione è conservata.</small></div>;
  const read=(s:ExtensionValue|undefined,extra:ExtensionData['state']={})=>compileExpression(String(s))({...data.state,...extra});
  const change=(field:string,value:ExtensionValue)=>onChange?.({...data.state,[field]:value});
  function render(node:CompositionNode):React.ReactNode{
    const p=node.props;
    try{
      switch(node.kind){
        case 'group':return <div key={node.id} className={`composition-group ${p.layout==='columns'?'composition-columns':''}`}>{node.children?.map(render)}</div>;
        case 'text':return <p key={node.id} className="composition-text">{String(p.text)}</p>;
        case 'input':{
          const field=body!.fields.find(f=>f.key===p.field)!;const value=data.state[field.key];
          return <label key={node.id} className="composition-input"><span>{field.label}{field.unit&&<small>{field.unit}</small>}</span>
            {onChange?(field.kind==='boolean'?<input type="checkbox" aria-label={field.label} checked={Boolean(value)} onChange={e=>change(field.key,e.target.checked)}/>:<div>
              {p.appearance==='slider'&&<input type="range" aria-label={field.label} min={field.min} max={field.max} step={field.step??'any'} value={Number(value)} onChange={e=>change(field.key,Number(e.target.value))}/>}
              <input aria-label={p.appearance==='slider'?`${field.label} valore`:field.label} type={field.kind==='number'?'number':'text'} min={field.min} max={field.max} step={field.step??'any'} maxLength={10000} value={String(value)} onChange={e=>{const v=field.kind==='number'?e.target.valueAsNumber:e.target.value;if(typeof v==='number'&&(!Number.isFinite(v)||field.min!==undefined&&v<field.min||field.max!==undefined&&v>field.max))return;change(field.key,v);}}/>
            </div>):<output>{format(value)} {field.unit}</output>}
          </label>;
        }
        case 'value':return <div key={node.id} className="composition-value"><span>{String(p.label)}</span><output>{format(read(p.expression))} <small>{String(p.unit??'')}</small></output></div>;
        case 'action':return onChange?<button key={node.id} type="button" className="secondary-button" onClick={()=>{try{const value=read(p.expression),f=body!.fields.find(f=>f.key===p.field)!;if(typeof value!==typeof f.initial||typeof value==='number'&&(f.min!==undefined&&value<f.min||f.max!==undefined&&value>f.max))throw Error('Il risultato non rispetta il tipo o l’intervallo della variabile.');change(String(p.field),value);setActionError('');}catch(error){setActionError(error instanceof Error?error.message:'Azione non disponibile.');}}}>{String(p.label)}</button>:<p key={node.id} className="hint">Azione: {String(p.label)}</p>;
        case 'plot':{
          const evaluate=compileExpression(String(p.expression)),min=Number(p.min),max=Number(p.max);
          const values=Array.from({length:81},(_,i)=>{const x=min*(1-i/80)+max*(i/80),y=evaluate({...data.state,[String(p.variable)]:x});if(typeof y!=='number')throw Error('Il grafico richiede risultati numerici.');return y;});
          const lo=Math.min(0,...values),hi=Math.max(0,...values)||(!lo?1:0),scale=Math.max(Math.abs(lo),Math.abs(hi));
          const path=values.map((y,i)=>`${i?'L':'M'}${64+420*i/80},${190-160*(y/scale-lo/scale)/(hi/scale-lo/scale)}`).join(' ');
          return <figure key={node.id} className="composition-plot"><svg viewBox="0 0 510 238" role="img" aria-label={String(p.label)}>
            {[0,.25,.5,.75,1].map(t=><g key={t}><path d={`M64 ${190-160*t}H484`} fill="none" stroke="currentColor" opacity=".08"/><text x="55" y={194-160*t} textAnchor="end">{axis(lo*(1-t)+hi*t)}</text><text x={64+420*t} y="212" textAnchor={t===0?'start':t===1?'end':'middle'}>{axis(min*(1-t)+max*t)}</text></g>)}
            <path d="M64 20V190H484" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45"/><path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5"/><text x="274" y="234" textAnchor="middle">{String(p.variable)} {String(p.unit??'')}</text></svg><figcaption>{String(p.label)}</figcaption></figure>;
        }
        case 'scene':return <svg key={node.id} className="composition-scene" viewBox={`0 0 ${p.width} ${p.height}`} role="img" aria-label={String(p.label)}>{node.children?.map(child=>{const s=child.props,x=Number(read(s.x)),y=Number(read(s.y)),w=Number(read(s.width)),h=Number(read(s.height));if(![x,y,w,h].every(v=>Number.isFinite(v)&&Math.abs(v)<=1_000_000))throw Error('Coordinate non finite.');const color=String(s.color);return s.shape==='circle'?<circle key={child.id} cx={x} cy={y} r={Math.abs(w)} fill={color}/>:s.shape==='line'?<line key={child.id} x1={x} y1={y} x2={x+w} y2={y+h} stroke={color} strokeWidth="2"/>:<rect key={child.id} x={x} y={y} width={Math.abs(w)} height={Math.abs(h)} fill={color}/>;})}</svg>;
        default:return <p key={node.id} className="extension-fallback">{node.fallback??'Componente non disponibile'} · {node.kind}</p>;
      }
    }catch(error){return <p key={node.id} role="alert" className="composition-error">{error instanceof Error?error.message:'Componente non disponibile.'}</p>;}
  }
  return <div className="composition-view">{body.nodes.map(render)}{actionError&&<p role="alert" className="composition-error">{actionError}</p>}</div>;
}

/** Experiments never write learner answers into the teacher's shared document. */
export function ExtensionExperiment({data}:{data:ExtensionData}){
  const [state,setState]=useState(data.state);
  return <section className="extension-experiment"><ExtensionView data={{...data,state}} onChange={setState}/><p className="hint">Esperimento locale · i valori di prova non vengono salvati. Puoi annotare il risultato nel tuo tentativo.</p><button type="button" className="text-button" onClick={()=>setState(data.state)}>Ripristina valori iniziali</button></section>;
}
