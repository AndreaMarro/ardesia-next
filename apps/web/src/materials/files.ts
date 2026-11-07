import {MATERIAL_MAX_BYTES, MATERIAL_PART_BYTES, MaterialManifestSchema, type MaterialManifest} from '@ardesia/contracts';
import {sha256} from '@ardesia/remote-client';
import {renderMaterialInTurn} from './render-queue';

export async function inspectMaterial(file: File, documentId: string, license: string): Promise<MaterialManifest> {
  if (!file.size || file.size > MATERIAL_MAX_BYTES) throw Error('Scegli un file non vuoto, fino a 32 MiB.');
  const bytes=await file.arrayBuffer(), start=new Uint8Array(bytes,0,Math.min(12,bytes.byteLength));
  const ascii=(a:number,b:number)=>String.fromCharCode(...start.slice(a,b));
  const mimeType=ascii(0,5)==='%PDF-'?'application/pdf':start[0]===137&&ascii(1,4)==='PNG'?'image/png'
    :start[0]===255&&start[1]===216&&start[2]===255?'image/jpeg':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':null;
  if(!mimeType)throw Error('Formato non riconosciuto. Sono disponibili PDF, PNG, JPEG e WebP.');
  const pages:{width:number;height:number}[]=[];
  await renderMaterialInTurn(async()=>{if(mimeType==='application/pdf'){
    const {openPdf}=await import('./pdf-engine'), task=openPdf(new Uint8Array(bytes.slice(0)));
    const timeout=setTimeout(()=>void task.destroy(),20_000);
    try{const pdf=await task.promise;if(pdf.numPages>1000)throw Error('Questo PDF supera le 1000 pagine gestite in questa versione.');
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),v=page.getViewport({scale:1});pages.push({width:v.width,height:v.height});page.cleanup();}
    }catch{throw Error('PDF non leggibile, protetto da password o troppo complesso. Il file originale resta sul tuo dispositivo.');}
    finally{clearTimeout(timeout);await task.destroy();}
  }else{
    let bitmap:ImageBitmap|undefined;
    try{bitmap=await createImageBitmap(new Blob([bytes],{type:mimeType}));if(bitmap.width*bitmap.height>40_000_000)throw Error();pages.push({width:bitmap.width,height:bitmap.height});}
    catch{throw Error('Immagine non decodificabile o superiore a 40 megapixel.');}finally{bitmap?.close();}
  }},new AbortController().signal);
  const parts=[];
  for(let offset=0;offset<bytes.byteLength;offset+=MATERIAL_PART_BYTES){const chunk=bytes.slice(offset,offset+MATERIAL_PART_BYTES);parts.push({index:parts.length,bytes:chunk.byteLength,sha256:await sha256(chunk)});}
  return MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId:crypto.randomUUID(),documentId,name:file.name.slice(0,240),mimeType,
    bytes:bytes.byteLength,sha256:await sha256(bytes),license,pages,parts});
}

export function selectedPages(value: string, count: number): number[] {
  const result=new Set<number>();
  for(const item of value.split(',')){
    const match=/^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(item);
    if(!match)throw Error('Indica le pagine, per esempio 1–3 come 1-3, oppure 1, 4.');
    const start=Number(match[1]),end=Number(match[2]??match[1]);
    if(start<1||end<start||end>count)throw Error('L’intervallo deve essere compreso nelle pagine del PDF.');
    for(let page=start;page<=end;page++)result.add(page);
  }
  return [...result].sort((a,b)=>a-b);
}
