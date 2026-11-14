import type {MaterialData} from '@ardesia/contracts';
import {materialRasterSize,renderMaterialInTurn} from './render-queue';

export type MaterialRaster = {canvas:HTMLCanvasElement;text:string;width:number;height:number;limited:boolean};
export type RasterProfile = {width:number;height:number;maxPixels:number};
export function rasterSize(width:number,height:number,profile?:RasterProfile) {
  if(!profile)return {...materialRasterSize(width,height),limited:false};
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid page geometry');
  const desired=Math.min(profile.width/width,profile.height/height);
  const scale=Math.min(desired,Math.sqrt(profile.maxPixels/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale,limited:scale<desired};
}
/** Same decoder for visible pages and prepared exports. The result owns a canvas
 * independent of viewport visibility; only one material decoder runs at a time. */
export async function renderMaterial(source:Blob|(()=>Promise<Blob>),data:MaterialData,signal:AbortSignal,profile?:RasterProfile):Promise<MaterialRaster> {
  let result:MaterialRaster|undefined;
  await renderMaterialInTurn(async()=>{
    signal.throwIfAborted();
    const original=typeof source==='function'?await source():source;signal.throwIfAborted();
    let task:ReturnType<typeof import('./pdf-engine')['openPdf']>|undefined,render:import('pdfjs-dist').RenderTask|undefined;
    const canvas=document.createElement('canvas');
    let expired=false;
    const stop=()=>{render?.cancel();void task?.destroy().catch(()=>undefined);};
    const check=()=>{signal.throwIfAborted();if(expired)throw Error('Material rendering timed out');};
    const timer=setTimeout(()=>{expired=true;stop();},20_000);signal.addEventListener('abort',stop,{once:true});
    try{
      let text='',size;
      if(data.mimeType==='application/pdf'){
        const {openPdf}=await import('./pdf-engine');check();
        const bytes=await original.arrayBuffer();check();
        task=openPdf(new Uint8Array(bytes));const pdf=await task.promise;check();
        const page=await pdf.getPage(data.page);check();
        const base=page.getViewport({scale:1});size=rasterSize(base.width,base.height,profile);
        canvas.width=size.width;canvas.height=size.height;
        render=page.render({canvas,viewport:page.getViewport({scale:size.scale})});await render.promise;check();
        const content=await page.getTextContent();text=content.items.flatMap(item=>'str'in item?[item.str]:[]).join(' ').slice(0,100000);
      }else{
        const bitmap=await createImageBitmap(original);
        try{check();if(bitmap.width*bitmap.height>40_000_000)throw Error('Image too large');
          size=rasterSize(bitmap.width,bitmap.height,profile);canvas.width=size.width;canvas.height=size.height;
          canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
        }finally{bitmap.close();}
      }
      check();result={canvas,text,width:canvas.width,height:canvas.height,limited:size.limited};
    }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);await task?.destroy().catch(()=>undefined);}
  },signal);
  signal.throwIfAborted();if(!result)throw Error('Material rendering did not complete');return result;
}
