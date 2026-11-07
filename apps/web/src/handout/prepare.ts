import {CoreError, type EducationalObject, type LessonDocument, type SourceReference} from '@ardesia/contracts';
import {projectHandout} from '@ardesia/lesson-os';

export function prepareHandout(document:LessonDocument, readSource?:(ref:SourceReference)=>EducationalObject){
  const exact:EducationalObject[]=[],seen=new Set<string>();
  if(readSource)for(const ref of document.objects.flatMap(o=>o.provenance.sources)){
    const key=ref.sourceId+'@'+ref.revision;
    if(seen.has(key)||document.objects.some(o=>o.type==='source'&&o.id===ref.sourceId&&o.revision===ref.revision))continue;
    seen.add(key);
    try{exact.push(readSource(ref));}
    catch(error){if(!(error instanceof CoreError)||error.code!=='NOT_FOUND')throw error;}
  }
  return projectHandout(document,exact);
}
