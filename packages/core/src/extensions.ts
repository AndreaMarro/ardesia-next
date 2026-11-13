import {CoreError, EducationalObjectSchema, extensionDefinitionDigest, type CoreSnapshot, type ExtensionData, type ExtensionObject} from '@ardesia/contracts';

export function extensionHistory(state:CoreSnapshot):ExtensionObject[]{
  const result=state.documents.flatMap(doc=>doc.objects).filter((o):o is ExtensionObject=>o.type==='extension');
  for(const event of state.events){
    if(!('documentId'in event)||!event.payload||typeof event.payload!=='object'||Array.isArray(event.payload))continue;
    const candidates=[event.payload.object,event.payload.previous];
    if(event.type==='plugin-release-changed'&&Array.isArray(event.payload.objects))for(const change of event.payload.objects){
      if(change&&typeof change==='object'&&!Array.isArray(change))candidates.push(change.object,change.previous);
    }
    for(const candidate of candidates){
      if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||candidate.type!=='extension')continue;
      if(event.type==='plugin-release-changed')throw new CoreError('INVALID_SNAPSHOT','A plugin release transition cannot contain extension objects.');
      const parsed=EducationalObjectSchema.safeParse(candidate);if(!parsed.success||parsed.data.type!=='extension')throw new CoreError('INVALID_SNAPSHOT','Invalid historical extension object.');result.push(parsed.data);
    }
  }
  return result;
}
/** Derived per-Core index. Rebuilt from all validated history, never persisted. */
export async function validateExtensionDefinitions(state:CoreSnapshot):Promise<Map<string,string>>{
  const releases=new Map<string,string>(),checked=new Set<string>();
  for(const object of extensionHistory(state)){
    const d=object.data,identity=`${d.definition.typeId}@${d.definition.version}`;
    if(releases.has(identity)&&releases.get(identity)!==d.definitionDigest)throw new CoreError('INVALID_SNAPSHOT','An extension release has conflicting definitions.');
    releases.set(identity,d.definitionDigest);
    // Digest equality cannot authenticate a different payload; check every distinct definition.
    const bytes=JSON.stringify(d.definition);
    if(!checked.has(bytes)){
      if(await extensionDefinitionDigest(d.definition)!==d.definitionDigest)throw new CoreError('INVALID_SNAPSHOT','Extension definition digest mismatch.');
      checked.add(bytes);
    }
  }
  return releases;
}
export async function validateExtensionUse(releases:ReadonlyMap<string,string>,data:ExtensionData):Promise<void>{
  if(await extensionDefinitionDigest(data.definition)!==data.definitionDigest)throw new CoreError('INVALID_REFERENCE','Extension definition digest mismatch.');
  const known=releases.get(`${data.definition.typeId}@${data.definition.version}`);
  if(known!==undefined&&known!==data.definitionDigest)throw new CoreError('INVALID_REFERENCE','This extension version already identifies a different definition. Create a new version.');
}
