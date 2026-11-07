import {z} from 'zod';

export const COMPOSITION_RENDERER = 'ardesia.composition/1';
const key = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/).refine(value=>!['constructor','prototype','__proto__'].includes(value));
const short = z.string().min(1).max(240);
export type ExtensionValue = null | boolean | number | string | ExtensionValue[] | {[key:string]:ExtensionValue};
/** Bounds are resource budgets, not a catalog of educational object types. */
export function isExtensionJson(value: unknown): value is ExtensionValue {
  const stack = [{value,depth:0}], seen = new Set<object>(); let count = 0;
  try {
    while(stack.length) {
      const {value,depth} = stack.pop()!;
      if(++count>8_000 || depth>20) return false;
      if(value===null||typeof value==='boolean') continue;
      if(typeof value==='number') {if(!Number.isFinite(value))return false;continue;}
      if(typeof value==='string') {if(value.length>32_768)return false;continue;}
      if(typeof value!=='object'||seen.has(value))return false;
      seen.add(value);
      if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
      if(Object.getOwnPropertySymbols(value).length)return false;
      const entries=Object.getOwnPropertyDescriptors(value);
      if(Array.isArray(value)&&(Object.keys(entries).length!==value.length+1||Object.keys(entries).filter(k=>k!=='length').some((k,i)=>k!==String(i))))return false;
      for(const [name,d] of Object.entries(entries)) {
        if(Array.isArray(value)&&name==='length')continue;
        if(['__proto__','constructor','prototype'].includes(name)||name.length>200||!d.enumerable||!('value'in d))return false;
        stack.push({value:d.value,depth:depth+1});
      }
    }
    return new TextEncoder().encode(JSON.stringify(value)).byteLength<=131_072;
  }catch{return false;}
}
const Json = z.custom<ExtensionValue>(isExtensionJson);
const Primitive = z.union([z.number().finite(),z.string().max(10_000),z.boolean()]);
export const CompositionFieldSchema = z.strictObject({
  key:key.refine(v=>!['pi','e','true','false'].includes(v)), label:short, kind:z.enum(['number','text','boolean']), initial:Primitive,
  min:z.number().finite().optional(),max:z.number().finite().optional(),step:z.number().positive().optional(),unit:z.string().max(40).optional(),
}).superRefine((field,ctx)=>{
  if(typeof field.initial!==({number:'number',text:'string',boolean:'boolean'} as const)[field.kind])ctx.addIssue({code:'custom',message:'Initial value does not match field type'});
  if(field.kind==='number' && (field.min!==undefined&&field.max!==undefined&&field.min>=field.max || typeof field.initial==='number'&&(field.min!==undefined&&field.initial<field.min || field.max!==undefined&&field.initial>field.max)))ctx.addIssue({code:'custom',message:'Invalid numeric range'});
});
export type CompositionField = z.infer<typeof CompositionFieldSchema>;
export interface CompositionNode {id:string;kind:string;props:Record<string,ExtensionValue>;children?:CompositionNode[];fallback?:string;}
const Node: z.ZodType<CompositionNode> = z.lazy(()=>z.strictObject({id:key,kind:z.string().regex(/^[a-z][a-z0-9./-]{0,99}$/),props:z.record(z.string(),Json),children:z.array(Node).max(200).optional(),fallback:z.string().max(2000).optional()}));
const Expression = z.string().min(1).max(1_000);
const props = {
  group:z.strictObject({layout:z.enum(['stack','columns']).default('stack')}),
  text:z.strictObject({text:z.string().max(10_000)}),
  input:z.strictObject({field:key,appearance:z.enum(['slider','field']).optional()}),
  value:z.strictObject({label:short,expression:Expression,unit:z.string().max(40).optional()}),
  plot:z.strictObject({label:short,expression:Expression,variable:key.refine(v=>!['pi','e','true','false'].includes(v)),min:z.number().finite(),max:z.number().finite(),unit:z.string().max(40).optional()}).refine(p=>p.min<p.max),
  action:z.strictObject({label:short,field:key,expression:Expression}),
  scene:z.strictObject({label:short,width:z.number().positive().max(10_000),height:z.number().positive().max(10_000)}),
  shape:z.strictObject({shape:z.enum(['circle','rect','line']),x:Expression,y:Expression,width:Expression,height:Expression,color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}),
};
export const CompositionBodySchema = z.custom<unknown>(isExtensionJson).pipe(z.strictObject({fields:z.array(CompositionFieldSchema).max(100),nodes:z.array(Node).max(200)})).superRefine((body,ctx)=>{
  const fields=new Map(body.fields.map(f=>[f.key,f])), ids=new Set<string>();
  if(fields.size!==body.fields.length)ctx.addIssue({code:'custom',message:'Duplicate field key'});
  const stack=body.nodes.map(node=>({node,parent:''}));let count=0;
  while(stack.length){
    const {node,parent}=stack.pop()!;
    if(++count>200){ctx.addIssue({code:'custom',message:'Composition exceeds 200 nodes'});break;}
    if(ids.has(node.id))ctx.addIssue({code:'custom',message:'Duplicate component identity'});ids.add(node.id);
    const schema=Object.hasOwn(props,node.kind)?props[node.kind as keyof typeof props]:undefined;
    if(schema&&!schema.safeParse(node.props).success)ctx.addIssue({code:'custom',message:`Invalid ${node.kind} component`});
    if(!schema&&!node.fallback)ctx.addIssue({code:'custom',message:'Unknown components need a readable fallback'});
    if(['input','action'].includes(node.kind)&&!fields.has(String(node.props.field)))ctx.addIssue({code:'custom',message:'Component field does not exist'});
    if(node.kind==='input'&&node.props.appearance==='slider') {const f=fields.get(String(node.props.field));if(!f||f.kind!=='number'||f.min===undefined||f.max===undefined)ctx.addIssue({code:'custom',message:'Slider needs a bounded numeric field'});}
    if(node.kind==='shape'&&parent!=='scene')ctx.addIssue({code:'custom',message:'Shapes belong inside a scene'});
    if(node.kind==='scene'&&node.children?.some(c=>c.kind!=='shape'))ctx.addIssue({code:'custom',message:'Scene children must be shapes'});
    if(schema&&!['group','scene'].includes(node.kind)&&node.children?.length)ctx.addIssue({code:'custom',message:'Leaf components cannot contain children'});
    for(const child of node.children??[])stack.push({node:child,parent:node.kind});
  }
});
export type CompositionBody = z.infer<typeof CompositionBodySchema>;
export const ExtensionDefinitionSchema = z.custom<unknown>(isExtensionJson).pipe(z.strictObject({
  format:z.literal('ardesia-extension/1'), typeId:z.string().regex(/^[a-z][a-z0-9.-]{2,119}$/), version:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  name:short,description:z.string().max(2000),license:z.string().min(1).max(300),
  renderer:z.string().regex(/^[a-z][a-z0-9./-]{2,119}$/),body:Json,
  fallback:z.string().min(1).max(10_000),
})).superRefine((definition,ctx)=>{
  if(definition.renderer===COMPOSITION_RENDERER&&!CompositionBodySchema.safeParse(definition.body).success)ctx.addIssue({code:'custom',message:'Invalid compositional definition'});
});
export type ExtensionDefinition = z.infer<typeof ExtensionDefinitionSchema>;
export const ExtensionLineageSchema = z.strictObject({
  typeId:z.string().min(1).max(120),version:z.number().int().positive(),definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),definitionLicense:z.string().min(1).max(300),
  objectId:z.string().min(1).max(200).optional(),objectRevision:z.number().int().positive().optional(),createdBy:z.string().min(1).max(200).optional(),createdAt:z.iso.datetime().optional(),
  sources:z.array(z.strictObject({id:z.string().min(1).max(200),revision:z.number().int().positive(),title:short,
    url:z.url().refine(v=>['https:','http:'].includes(new URL(v).protocol)),publisher:z.string().max(300),locator:z.string().max(1000),referenceLocator:z.string().max(1000),sourceRevision:z.string().max(300),license:z.string().max(300)})).max(100),
  missingSources:z.array(z.strictObject({sourceId:z.string().max(200),revision:z.number().int().positive(),locator:z.string().max(1000)})).max(100),
}).superRefine((entry,ctx)=>{const fields=[entry.objectId,entry.objectRevision,entry.createdBy,entry.createdAt];if(fields.some(v=>v!==undefined)&&fields.some(v=>v===undefined))ctx.addIssue({code:'custom',message:'Object origin requires its complete identity'});});
export type ExtensionLineage = z.infer<typeof ExtensionLineageSchema>;
export const ExtensionDataSchema = z.custom<unknown>(isExtensionJson).pipe(z.strictObject({
  definition:ExtensionDefinitionSchema,definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),state:z.record(key,Json),lineage:z.array(ExtensionLineageSchema).max(32).optional(),
})).superRefine(({definition,state},ctx)=>{
  if(definition.renderer!==COMPOSITION_RENDERER)return;
  const parsed=CompositionBodySchema.safeParse(definition.body);if(!parsed.success)return;
  const fields=parsed.data.fields;
  if(Object.keys(state).length!==fields.length)ctx.addIssue({code:'custom',message:'State must contain exactly the declared fields'});
  for(const field of fields){const v=state[field.key];if(typeof v!==typeof field.initial || typeof v==='number'&&(field.min!==undefined&&v<field.min||field.max!==undefined&&v>field.max))ctx.addIssue({code:'custom',message:`Invalid state for ${field.key}`});}
});
export type ExtensionData = z.infer<typeof ExtensionDataSchema>;
/** Attribution, not authentication. No author is invented for a bare imported definition. */
export function extensionOrigin(data:ExtensionData):ExtensionLineage{return {typeId:data.definition.typeId,version:data.definition.version,definitionDigest:data.definitionDigest,definitionLicense:data.definition.license,sources:[],missingSources:[]};}
export function appendExtensionOrigin(data:ExtensionData,origin:ExtensionLineage):ExtensionData{
  const checked=ExtensionLineageSchema.parse(origin),lineage=data.lineage??[];
  return ExtensionDataSchema.parse({...data,lineage:lineage.some(entry=>JSON.stringify(ExtensionLineageSchema.parse(entry))===JSON.stringify(checked))?lineage:[...lineage,checked]});
}
/** Canonical data digest: integrity and version identity, never publisher authentication. */
export async function extensionDefinitionDigest(definition:ExtensionDefinition):Promise<string>{
  const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`:JSON.stringify(v);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(ExtensionDefinitionSchema.parse(definition))));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
