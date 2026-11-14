import {useEffect,useState} from 'react';
import {MaterialManifestSchema,materialPage,type MaterialManifest,type NewEducationalObject} from '@ardesia/contracts';
import {Dialog} from '../components/Dialog';
import {MaterialView,useMaterials} from './MaterialView';
import {inspectMaterial,selectedPages} from './files';

export function MaterialImport({documentId,origin,onClose,onAdd}:{origin:{x:number;y:number};documentId:string;onClose:()=>void;onAdd:(objects:NewEducationalObject[])=>Promise<boolean>}){
  const scope=useMaterials(),[file,setFile]=useState<File|null>(null),[manifest,setManifest]=useState<MaterialManifest|null>(null);
  const [page,setPage]=useState(1),[range,setRange]=useState('1'),[license,setLicense]=useState('Uso personale · diritti da verificare');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[objects,setObjects]=useState<NewEducationalObject[]|null>(null);
  const [recovering,setRecovering]=useState(true);
  const [abandon,setAbandon]=useState(false);
  useEffect(()=>{let live=true;void scope?.access().loadDraft?.(documentId).then(draft=>{if(!live||!draft)return;setManifest(draft.manifest);setFile(new File([draft.blob],draft.manifest.name,{type:draft.manifest.mimeType}));setObjects(draft.objects);setLicense(draft.manifest.license);setRange(draft.objects.flatMap(o=>o.type==='material'?[o.data.page]:[]).join(', '));setError('Importazione conservata sul dispositivo. Riprendi con lo stesso originale e le stesse pagine.');}).catch(()=>{if(live)setError('Recupero non leggibile. Gli originali sono conservati.');}).finally(()=>{if(live)setRecovering(false);});return()=>{live=false;};},[scope,documentId]);
  useEffect(()=>{if(!file)return;const guard=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[file]);
  async function choose(next:File){
    setBusy(true);setError('');setManifest(null);setObjects(null);setFile(next);setProgress('Lettura del file…');
    try{const value=await inspectMaterial(next,documentId,license);setManifest(value);setPage(1);setRange('1');}
    catch(e){setError(e instanceof Error?e.message:'File non leggibile.');}finally{setBusy(false);setProgress('');}
  }
  async function save(){
    if(!manifest||!file||!scope)return;setBusy(true);setError('');
    try{
      const pages=selectedPages(range,manifest.pages.length);
      const candidate=MaterialManifestSchema.parse({...manifest,license});
      const selection=objects??pages.map((page,i):NewEducationalObject=>{const data=materialPage(candidate,page),width=Math.min(560,data.pageWidth),height=width*data.pageHeight/data.pageWidth;
        if(height>10000)throw Error('Pagina troppo alta: scegli un formato più compatto.');
        return {id:crypto.randomUUID(),type:'material',title:candidate.name+(candidate.pages.length>1?` · p. ${page}`:''),x:origin.x+i*600,y:origin.y,width,height,data,provenance:{origin:'imported',sources:[]}};});
      if(!objects){setObjects(selection);setManifest(candidate);}
      if(!scope.access().saveDraft)throw Error('Archivio di recupero non disponibile.');
      await scope.access().saveDraft!({manifest:candidate,blob:file,objects:selection});
      setProgress('Conservazione dell’originale…');await scope.access().upload(candidate,file,(done,total)=>setProgress(`Caricamento ${Math.round(done/total*100)}%`));
      setProgress('Aggiunta alla lezione…');if(await onAdd(selection)){await scope.access().clearDraft?.(documentId,candidate.assetId);onClose();}else setError('Alcune pagine attendono conferma. Verifica il recupero, poi riprova con questa stessa importazione.');
    }catch(e){setError(e instanceof Error?e.message:'Importazione non completata. Puoi riprovare senza duplicare le pagine.');}
    finally{setBusy(false);setProgress('');}
  }
  return <Dialog title="Porta un materiale nella lezione" onClose={()=>{if(!busy)onClose();}} className="material-import">
    <p className="material-intro">Un documento, una pagina, un’idea su cui lavorare.</p>
    <label className="material-drop"><strong>Scegli PDF o immagine</strong><span>PDF, PNG, JPEG, WebP · fino a 32 MiB</span><input type="file" aria-label="File da importare" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy||recovering||!!objects} onChange={e=>{const next=e.target.files?.[0];if(next)void choose(next);}}/></label>
    {manifest&&<div className="material-preview"><div className="material-preview-paper"><MaterialView data={materialPage(manifest,page)} blob={file!}/></div><div className="material-options">
      <p className="material-filename">{manifest.name}</p><p className="hint">{manifest.pages.length} {manifest.pages.length===1?'pagina':'pagine'} · {(manifest.bytes/1024/1024).toFixed(2)} MiB</p>
      {manifest.pages.length>1&&<><div className="material-pagination" role="group" aria-label="Anteprima delle pagine"><button className="secondary-button" disabled={page===1} onClick={()=>setPage(p=>p-1)} aria-label="Pagina precedente">←</button><span>{page} / {manifest.pages.length}</span><button className="secondary-button" disabled={page===manifest.pages.length} onClick={()=>setPage(p=>p+1)} aria-label="Pagina successiva">→</button></div><label>Pagine sulla lavagna<input aria-label="Pagine da importare" value={range} disabled={busy||recovering||!!objects} onChange={e=>setRange(e.target.value)}/></label><p className="hint">Per esempio 1-3, 5. L’originale completo viene conservato.</p></>}
      <label>Licenza o diritti<input aria-label="Diritti del materiale" value={license} maxLength={300} disabled={busy||recovering||!!objects} onChange={e=>setLicense(e.target.value)}/></label>
      <p className="hint">Ogni pagina mantiene la sua identità. La penna segue la pagina quando la sposti.</p>
    </div></div>}
    {error&&<p role="alert" className="error-banner">{error}</p>}{progress&&<p role="status">{progress}</p>}
    {objects&&!busy&&<section className="material-recovery" aria-label="Gestisci importazione conservata">
      {abandon?<><p>Puoi scaricare il file conservato prima di eliminare questa bozza. Le pagine già salvate e le modifiche in attesa restano nella lezione; gli originali sul server restano conservati.</p>
        <button className="secondary-button" onClick={()=>{if(!file)return;const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=manifest!.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Scarica il file conservato</button>
        <button className="secondary-button" onClick={()=>setAbandon(false)}>Torna all’importazione</button>
        <button className="secondary-button" onClick={()=>{setBusy(true);void scope!.access().clearDraft!(documentId,manifest!.assetId).then(()=>{setFile(null);setManifest(null);setObjects(null);setError('');setAbandon(false);}).catch(()=>setError('Bozza non rimossa. Puoi riprovare.')).finally(()=>setBusy(false));}}>Abbandona bozza</button>
      </>:<button className="secondary-button" onClick={()=>setAbandon(true)}>Abbandona questa importazione</button>}
    </section>}
    <div className="material-import-actions"><button className="secondary-button" disabled={busy} onClick={onClose}>Chiudi</button><button className="primary-button" disabled={!manifest||busy||recovering||!license.trim()} onClick={()=>void save()}>{busy?'Importazione…':objects?'Riprova importazione':'Aggiungi alla lavagna'}</button></div>
  </Dialog>;
}
