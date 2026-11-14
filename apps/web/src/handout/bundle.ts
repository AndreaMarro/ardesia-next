import {z} from 'zod';
import {canonicalJson,EducationalObjectSchema,LessonDocumentSchema,type InkObject,type MaterialObject} from '@ardesia/contracts';
import {planHandout,projectHandout,type Handout} from '@ardesia/lesson-os';
import {handoutLatex} from './latex';
import {inkPlates,materialPlate,plateSvg,HANDOUT_INK_LIMITS} from './plates';

export const HANDOUT_BUNDLE_LIMITS={maxEntries:512,maxZipBytes:128*1024*1024,maxTotalBytes:256*1024*1024,maxFileBytes:64*1024*1024,maxRatio:200} as const;
const bytes=(value:string)=>new TextEncoder().encode(value);
const json=(value:unknown)=>bytes(canonicalJson(value)+'\n');
export async function handoutHash(value:Uint8Array):Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(value).buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
const AssetSchema=z.object({objectId:z.string(),originalPath:z.string().regex(/^originals\/[a-f0-9]{64}\.(pdf|png|jpg|webp)$/),
  rasterPath:z.string().regex(/^assets\/[a-f0-9]{64}\.png$/),width:z.number().int().positive().max(10000),height:z.number().int().positive().max(10000),
  dpi:z.number().positive().max(201),limited:z.boolean()}).strict();
export type HandoutAsset=z.infer<typeof AssetSchema>;
const SourceSchema=z.object({format:z.literal('ardesia-handout-source-v1'),document:LessonDocumentSchema,
  sources:z.array(EducationalObjectSchema),assets:z.array(AssetSchema).max(2000),notice:z.string().max(2000)}).strict();
export type PreparedHandout={handout:Handout;assets:HandoutAsset[];files:Record<string,Uint8Array>;notice:string};
function assertBudget(files:Record<string,Uint8Array>){
  const entries=Object.entries(files);
  if(entries.length>HANDOUT_BUNDLE_LIMITS.maxEntries||entries.some(([,data])=>data.byteLength>HANDOUT_BUNDLE_LIMITS.maxFileBytes)
    ||entries.reduce((sum,[,data])=>sum+data.byteLength,0)>HANDOUT_BUNDLE_LIMITS.maxTotalBytes)throw Error('La dispensa supera il limite di esportazione. Nessun oggetto è stato omesso.');
}
function pngSize(data:Uint8Array){
  if(data.length<33||![137,80,78,71,13,10,26,10].every((n,i)=>data[i]===n)||new TextDecoder().decode(data.subarray(12,16))!=='IHDR')throw Error('Invalid PNG');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width*height>8_000_000)throw Error('PNG exceeds raster budget');return {width,height};
}
function restored(source:z.infer<typeof SourceSchema>):Handout {
  const current=source.document.objects.filter(o=>o.type==='source');
  const handout=projectHandout(source.document,source.sources.filter(s=>!current.some(o=>o.id===s.id&&o.revision===s.revision)));
  if(canonicalJson(handout.sources)!==canonicalJson(source.sources))throw Error('Sources differ from the exact projection');
  return handout;
}
/** Generates only from validated Core data and numbered/hash-addressed assets.
 * The local compiler calls this same emitter; matching arbitrary supplied hashes
 * alone never authorizes a TeX program. */
export async function buildHandoutFiles(prepared:PreparedHandout):Promise<Record<string,Uint8Array>> {
  if(prepared.handout.document.objects.reduce((sum,o)=>sum+(o.type==='ink'?o.data.points.length:0),0)>HANDOUT_INK_LIMITS.sourceSamples)throw Error('La scrittura supera il budget di preparazione. Nessun tratto è stato omesso.');
  const source=SourceSchema.parse({format:'ardesia-handout-source-v1',document:prepared.handout.document,sources:prepared.handout.sources,assets:prepared.assets,notice:prepared.notice});
  const handout=restored(source),plan=planHandout(handout),materials=handout.document.objects.filter((o):o is MaterialObject=>o.type==='material');
  if(source.assets.length!==materials.length||new Set(source.assets.map(a=>a.objectId)).size!==materials.length)throw Error('Incomplete material coverage');
  const files:Record<string,Uint8Array>=Object.create(null),rasters:Record<string,string>=Object.create(null);
  for(const object of materials){
    const asset=source.assets.find(a=>a.objectId===object.id);if(!asset)throw Error('Material is missing');
    const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[object.data.mimeType];
    if(asset.originalPath!=='originals/'+object.data.sha256+'.'+ext)throw Error('Original identity mismatch');
    for(const path of [asset.originalPath,asset.rasterPath]){
      const data=prepared.files[path];if(!data||await handoutHash(data)!==path.split('/')[1]!.split('.')[0])throw Error('Asset checksum mismatch');
      files[path]=data;
    }
    const size=pngSize(files[asset.rasterPath]!);
    if(size.width!==asset.width||size.height!==asset.height)throw Error('Raster geometry mismatch');
    if(files[asset.originalPath]!.byteLength>32*1024*1024)throw Error('Original exceeds material budget');
    rasters[object.id]=asset.rasterPath;
  }
  if(Object.keys(prepared.files).some(path=>!Object.hasOwn(files,path)))throw Error('Unexpected payload');
  files['source.json']=json(source);assertBudget(files);
  let index=0;
  for(const block of plan.blocks){
    if(block.kind==='object')continue;
    const ink=handout.document.objects.filter((o):o is InkObject=>o.type==='ink'&&block.inkIds.includes(o.id));
    const plates=block.kind==='ink'?inkPlates(ink):[materialPlate(materials.find(o=>o.id===block.objectId)!,ink)];
    for(const plate of plates){files['ink/plate-'+String(++index).padStart(3,'0')+'.svg']=bytes(plateSvg(plate));assertBudget(files);}
  }
  const extra=source.assets.filter(a=>a.limited).map(a=>'Risoluzione ridotta per il limite raster: '+a.objectId+' ('+a.dpi.toFixed(1)+' dpi).');
  if(source.notice)extra.unshift(source.notice);
  if(materials.length)extra.push('Le pagine dei materiali sono immagini normalizzate: il testo non è selezionabile nel PDF derivato. Gli originali completi restano nel pacchetto.');
  const tex=handoutLatex(handout,rasters,extra);files['main.tex']=bytes(tex.source);files['warnings.json']=json(tex.warnings);
  const buildId=await handoutHash(files['source.json']!);
  files['LEGGIMI.txt']=bytes('Ardesia / dispensa della revisione '+handout.document.revision+'\n\n'+
    'Il documento confermato e le fonti esatte sono in source.json. main.tex è modificabile; una modifica esterna richiede una nuova identità e una compilazione esplicita. Il builder verificato accetta soltanto il sorgente generato intatto.\n'+
    'Dal checkout compatibile: node tools/compile-handout.mjs --help\n'+
    'Stampa web e compilazione LaTeX usano A4, margini 18 mm. Nessun OCR, trascrizione automatica o integrazione editoriale generata. Leggere warnings.json.\n');
  const entries=[];
  for(const [path,data] of Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en')))entries.push({path,bytes:data.byteLength,sha256:await handoutHash(data)});
  const manifest={format:'ardesia-handout-bundle-v1',buildId,createdAt:handout.document.updatedAt,document:{id:handout.document.id,revision:handout.document.revision,sha256:await handoutHash(json(handout.document))},
    page:{format:'A4',marginMm:18,rasterDpi:200},coverage:plan.coverage,files:entries};
  files['manifest.json']=json(manifest);assertBudget(files);return files;
}
export async function verifyHandoutFiles(input:Record<string,Uint8Array>) {
  assertBudget(input);
  if(!input['source.json'])throw Error('Missing source');
  const source=SourceSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input['source.json'])));
  const payload:Record<string,Uint8Array>=Object.create(null);
  for(const asset of source.assets)for(const path of [asset.originalPath,asset.rasterPath]){
    const data=input[path];if(!data)throw Error('Missing material');payload[path]=data;
  }
  const generated=await buildHandoutFiles({handout:restored(source),assets:source.assets,files:payload,notice:source.notice});
  if(Object.keys(generated).length!==Object.keys(input).length)throw Error('Unexpected or missing files');
  for(const [path,data] of Object.entries(generated)){
    const received=input[path];if(!received||received.length!==data.length||await handoutHash(received)!==await handoutHash(data))throw Error('Generated file mismatch: '+path);
  }
  return {manifest:JSON.parse(new TextDecoder().decode(generated['manifest.json']!)) as {format:'ardesia-handout-bundle-v1';buildId:string;createdAt:string},
    warnings:JSON.parse(new TextDecoder().decode(generated['warnings.json']!)) as string[],mainTex:generated['main.tex']!};
}
export async function handoutZip(prepared:PreparedHandout):Promise<Blob>{
  const files=await buildHandoutFiles(prepared),{Zip,ZipPassThrough}=await import('fflate');
  // Stored streaming entries need no compression engine or Worker. The Blob
  // collects bounded chunks rather than an additional full-archive byte array.
  return new Promise<Blob>((resolve,reject)=>{
    const chunks:BlobPart[]=[];let total=0,failed=false;
    const archive=new Zip((error,chunk,final)=>{
      if(failed)return;
      if(error){failed=true;reject(error);return;}
      total+=chunk.byteLength;
      if(total>HANDOUT_BUNDLE_LIMITS.maxZipBytes){failed=true;archive.terminate();reject(Error('Il pacchetto supera 128 MiB. Nessun file è stato omesso.'));return;}
      chunks.push(new Uint8Array(chunk).buffer);
      if(final)resolve(new Blob(chunks,{type:'application/zip'}));
    });
    for(const [path,data] of Object.entries(files)){
      if(failed)break;
      const entry=new ZipPassThrough(path);entry.mtime=new Date(2000,0,1,0,0,0);archive.add(entry);entry.push(data,true);
    }
    if(!failed)archive.end();
  });
}
