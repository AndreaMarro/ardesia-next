import {MaterialStateSchema, MaterialManifestSchema, type MaterialManifest, type MaterialState,type NewEducationalObject} from '@ardesia/contracts';
import {sha256} from './recordings';

export interface MaterialDraft {manifest:MaterialManifest;blob:Blob;objects:NewEducationalObject[]}
export interface MaterialAccess {
  loadDraft?(documentId:string):Promise<MaterialDraft|null>;
  saveDraft?(draft:MaterialDraft):Promise<void>;
  clearDraft?(documentId:string,assetId:string):Promise<void>;
  upload(manifest: MaterialManifest, bytes: Blob, progress?: (completed: number, total: number) => void): Promise<MaterialState>;
  read(assetId: string, course?: {editionId: string; unitId: string}): Promise<MaterialState>;
  download(assetId: string, digest: string, course?: {editionId: string; unitId: string}): Promise<Blob>;
}
const invalid = (): never => {throw Error('Materiale non integro o risposta incoerente. L’originale non è stato modificato.');};
const encode = (bytes: Uint8Array) => {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
export function materialAccess(workspaceId: string, send: (input: Record<string, unknown>) => Promise<unknown>, authorize: () => Promise<void>): MaterialAccess {
  async function read(assetId: string, course?: {editionId: string; unitId: string}) {
    const state=MaterialStateSchema.parse(await send({action:'read-material',workspaceId,assetId,...(course?{course}:{})}));
    if(state.manifest.assetId!==assetId||state.status!=='ready')return invalid();return state;
  }
  return {
    read,
    async upload(input, blob, progress) {
      const manifest=MaterialManifestSchema.parse(input);
      if(blob.size!==manifest.bytes||await sha256(await blob.arrayBuffer())!==manifest.sha256)return invalid();
      const state=MaterialStateSchema.parse(await send({action:'prepare-material',workspaceId,manifest}));
      if(JSON.stringify(state.manifest)!==JSON.stringify(manifest))return invalid();
      let offset=0;
      for(const part of manifest.parts){
        const bytes=await blob.slice(offset,offset+part.bytes).arrayBuffer();
        if(await sha256(bytes)!==part.sha256)return invalid();
        await send({action:'put-material-part',workspaceId,assetId:manifest.assetId,index:part.index,base64:encode(new Uint8Array(bytes))});
        offset+=part.bytes;progress?.(offset,manifest.bytes);
      }
      const saved=MaterialStateSchema.parse(await send({action:'finish-material',workspaceId,assetId:manifest.assetId}));
      if(saved.status!=='ready'||JSON.stringify(saved.manifest)!==JSON.stringify(manifest))return invalid();return saved;
    },
    async download(assetId,digest,course) {
      const state=await read(assetId,course), parts:Uint8Array<ArrayBuffer>[]=[];
      if(state.manifest.sha256!==digest)return invalid();
      for(const part of state.manifest.parts){
        const value=await send({action:'read-material-part',workspaceId,assetId,index:part.index,...(course?{course}:{})}) as {base64?:unknown};
        if(typeof value?.base64!=='string')return invalid();
        const bytes=Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0));
        if(bytes.length!==part.bytes||await sha256(bytes.buffer)!==part.sha256)return invalid();parts.push(bytes);
      }
      const blob=new Blob(parts,{type:state.manifest.mimeType});
      if(blob.size!==state.manifest.bytes||await sha256(await blob.arrayBuffer())!==digest)return invalid();
      await authorize();return blob;
    },
  };
}
