import {z} from 'zod';
import {COMPOSITION_RENDERER,type CompositionBody,type ExtensionDefinition} from './extensions.ts';
import type {ExtensionObject} from './index.ts';
const id=z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const revision=z.number().int().positive();
export const CONCEPT_LINK_TYPE='ardesia.knowledge.link';
export const ConceptLinkStateSchema=z.object({sourceDocumentId:id,sourceDocumentRevision:revision,sourceObjectId:id,sourceObjectRevision:revision,
 targetDocumentId:id,targetDocumentRevision:revision,targetObjectId:id,targetObjectRevision:revision,
 sourceTitle:z.string().min(1).max(240),targetTitle:z.string().min(1).max(240),relation:z.string().min(1).max(200)}).strict();
export type ConceptLinkState=z.infer<typeof ConceptLinkStateSchema>;
/** An authored concept link is an ordinary portable Creator object. The link is
 * a claim, never an authorization to resolve either endpoint. */
export function conceptLinkDefinition(input:ConceptLinkState):ExtensionDefinition{
 const state=ConceptLinkStateSchema.parse(input);
 const body:CompositionBody={fields:Object.entries(state).map(([key,initial])=>({key,label:key,kind:typeof initial==='number'?'number':'text',initial:typeof initial==='number'?1:''})),nodes:[
  {id:'from',kind:'value',props:{label:'Da',expression:'sourceTitle'}},
  {id:'relation',kind:'value',props:{label:'Relazione',expression:'relation'}},
  {id:'to',kind:'value',props:{label:'A',expression:'targetTitle'}}]};
 return {format:'ardesia-extension/1',typeId:CONCEPT_LINK_TYPE,version:1,name:'Collegamento concettuale',description:'Due oggetti, due revisioni esatte. I backlink sono ricavati dai collegamenti autorizzati.',license:'Tutti i diritti riservati',renderer:COMPOSITION_RENDERER,body:body as unknown as ExtensionDefinition['body'],fallback:'Collegamento concettuale: consulta le due fonti e la relazione nei campi dello stato.'};
}
export function conceptLinkState(object:ExtensionObject):ConceptLinkState|null{
 if(object.data.definition.typeId!==CONCEPT_LINK_TYPE||object.data.definition.version!==1)return null;
 const result=ConceptLinkStateSchema.safeParse(object.data.state);return result.success?result.data:null;
}
