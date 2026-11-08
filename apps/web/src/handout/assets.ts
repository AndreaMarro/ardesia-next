import type {Handout} from '@ardesia/lesson-os';
import type {MaterialData,MaterialObject,InkObject} from '@ardesia/contracts';
import {renderMaterial} from '../materials/render';
import {materialPlate} from './plates';
import {HANDOUT_BUNDLE_LIMITS,handoutHash,type HandoutAsset,type PreparedHandout} from './bundle';

export async function prepareHandoutAssets(handout:Handout,load:(data:MaterialData)=>Promise<Blob>,
  authorize:(data:MaterialData)=>Promise<unknown>,signal:AbortSignal,notice:string,onProgress:(value:string)=>void):Promise<PreparedHandout>{
  const materials=handout.document.objects.filter((o):o is MaterialObject=>o.type==='material');
  const files:Record<string,Uint8Array>=Object.create(null),assets:HandoutAsset[]=[];let total=0;
  const add=(path:string,data:Uint8Array)=>{
    if(files[path])return;if(data.byteLength>HANDOUT_BUNDLE_LIMITS.maxFileBytes||total+data.byteLength>HANDOUT_BUNDLE_LIMITS.maxTotalBytes)throw Error('Materiali troppo grandi per una dispensa. Nessun file è stato omesso.');
    files[path]=data;total+=data.byteLength;
  };
  for(const [index,object] of materials.entries()){
    signal.throwIfAborted();onProgress('Preparazione materiale '+(index+1)+' di '+materials.length+'…');
    const original=await load(object.data);signal.throwIfAborted();
    const originalBytes=new Uint8Array(await original.arrayBuffer());signal.throwIfAborted();
    if(await handoutHash(originalBytes)!==object.data.sha256)throw Error('L’originale non corrisponde alla revisione salvata.');
    const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[object.data.mimeType];
    const originalPath='originals/'+object.data.sha256+'.'+ext;add(originalPath,originalBytes);
    const plate=materialPlate(object,handout.document.objects.filter((o):o is InkObject=>o.type==='ink'&&o.data.anchor?.objectId===object.id));
    const mmPerUnit=Math.min(174/plate.bounds.width,180/plate.bounds.height);
    const raster=await renderMaterial(original,object.data,signal,{width:object.width*mmPerUnit/25.4*200,height:object.height*mmPerUnit/25.4*200,maxPixels:8_000_000});
    signal.throwIfAborted();
    const png=await new Promise<Blob>((resolve,reject)=>raster.canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Impossibile preparare la pagina.')),'image/png'));
    const pngBytes=new Uint8Array(await png.arrayBuffer());signal.throwIfAborted();
    const rasterPath='assets/'+await handoutHash(pngBytes)+'.png';signal.throwIfAborted();add(rasterPath,pngBytes);
    assets.push({objectId:object.id,originalPath,rasterPath,width:raster.width,height:raster.height,
      dpi:Math.min(200,raster.width/(object.width*mmPerUnit/25.4)),limited:raster.limited});
    raster.canvas.width=1;raster.canvas.height=1;
  }
  // An earlier download does not make a later export authoritative. The current
  // provider must still authorize every original when the complete plan is ready.
  for(const object of materials){await authorize(object.data);signal.throwIfAborted();}
  return {handout,assets,files,notice};
}
