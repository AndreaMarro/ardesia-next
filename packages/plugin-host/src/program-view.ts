import {isExtensionJson, PROGRAM_VIEW_TAGS, ProgramStateSchema, type ProgramNode, type ProgramResult} from '@ardesia/contracts';

const tags=new Set(PROGRAM_VIEW_TAGS);
const svgTags=new Set('svg g path circle ellipse rect line polyline polygon text title desc'.split(' '));
const voidTags=new Set(['input','hr','br','path','circle','ellipse','rect','line','polyline','polygon']);
const events=new Set(['click','input','change','keydown','pointerdown','pointermove','pointerup']);
const colors=/^(?:#[0-9a-fA-F]{3,8}|none|currentColor|transparent|black|white|red|blue|green|gray)$/;
const numericAttrs=new Set('x y x1 y1 x2 y2 cx cy r rx ry width height min max step maxLength rows cols colSpan rowSpan strokeWidth opacity fillOpacity strokeOpacity strokeDashoffset value'.split(' '));
const textAttrs=new Set(['title','aria-label','placeholder','value']);
const boolAttrs=new Set(['checked','disabled','selected','open','multiple','readOnly']);
const styleDimensions=new Set('width height minWidth maxWidth minHeight maxHeight padding paddingTop paddingRight paddingBottom paddingLeft margin marginTop marginRight marginBottom marginLeft gap rowGap columnGap borderRadius borderWidth fontSize lineHeight letterSpacing flexGrow flexShrink flexBasis opacity'.split(' '));
const styleEnums:Record<string,readonly string[]>={display:['block','inline','inline-block','flex','grid','none'],flexDirection:['row','column','row-reverse','column-reverse'],flexWrap:['wrap','nowrap'],alignItems:['start','end','center','stretch','baseline'],justifyContent:['start','end','center','space-between','space-around','space-evenly'],textAlign:['left','right','center','start','end'],fontWeight:['normal','bold','400','500','600','700'],fontStyle:['normal','italic'],whiteSpace:['normal','pre','pre-wrap'],overflow:['hidden','auto'],borderStyle:['solid','dashed','dotted','none'],position:['relative','static']};
const fail=()=>{throw Error('Interfaccia del programma non valida: controlla elementi, attributi e stili consentiti.');};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000000;
const numbers=(v:unknown,max=8192)=>typeof v==='string'&&v.length<=max&&/^[0-9eE.,+\s-]+$/.test(v)&&v.trim().split(/[\s,]+/).every(s=>bounded(Number(s)));
function validAttr(tag:string,key:string,value:unknown,svg:boolean):boolean{
  if(textAttrs.has(key))return (typeof value==='string'&&value.length<=8192)||(key==='value'&&bounded(value));
  if(key==='role')return typeof value==='string'&&['img','group','status','note','presentation'].includes(value);
  if(boolAttrs.has(key))return typeof value==='boolean'&&!svg;
  if(key==='type')return tag==='input'&&typeof value==='string'&&['text','number','range','checkbox'].includes(value);
  if(key==='viewBox'){if(tag!=='svg'||!numbers(value,100))return false;const values=String(value).trim().split(/[\s,]+/).map(Number);return values.length===4&&values.every(n=>Math.abs(n)<=10000)&&values[2]!>=1&&values[3]!>=1;}
  if(key==='d')return tag==='path'&&typeof value==='string'&&value.length<=8192&&/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]*$/.test(value)&&(value.match(/[-+]?(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?/g)??[]).every(n=>bounded(Number(n)));
  if(key==='points')return svg&&numbers(value)&&String(value).length<=4096;
  if(key==='fill'||key==='stroke')return svg&&typeof value==='string'&&colors.test(value);
  if(key==='textAnchor')return tag==='text'&&typeof value==='string'&&['start','middle','end'].includes(value);
  if(key==='strokeLinecap')return svg&&typeof value==='string'&&['butt','round','square'].includes(value);
  if(!numericAttrs.has(key)||!bounded(value))return false;
  if(['opacity','fillOpacity','strokeOpacity'].includes(key))return value>=0&&value<=1;
  if(['colSpan','rowSpan'].includes(key))return Number.isInteger(value)&&value>=1&&value<=24;
  if(key==='rows')return Number.isInteger(value)&&value>=1&&value<=30;
  if(key==='cols')return Number.isInteger(value)&&value>=1&&value<=120;
  if(key==='maxLength')return Number.isInteger(value)&&value>=0&&value<=8192;
  if(key==='strokeWidth')return value>=0&&value<=100;
  return Math.abs(value)<=10000;
}
function validStyle(key:string,value:unknown):boolean{
  if(['color','backgroundColor','borderColor'].includes(key))return typeof value==='string'&&colors.test(value);
  if(Object.hasOwn(styleEnums,key))return typeof value==='string'&&styleEnums[key]!.includes(value);
  if(key==='gridTemplateColumns')return typeof value==='string'&&/^(?:[1-9][0-9]?(?:fr|px|%) ?){1,12}$/.test(value);
  if(styleDimensions.has(key)){
    if(key==='opacity')return typeof value==='number'&&value>=0&&value<=1;
    if(['flexGrow','flexShrink'].includes(key))return typeof value==='number'&&value>=0&&value<=10;
    if(key==='lineHeight')return typeof value==='number'&&value>=.8&&value<=3;
    const dimension=/^(?:min|max)?(?:Width|Height)$/.test(key)||['width','height','flexBasis'].includes(key);
    if(value==='auto')return dimension;
    const match=typeof value==='string'?value.match(/^([0-9]+(?:\.[0-9]+)?)(px|rem|%)$/):null;
    if(typeof value!=='number'&&!match)return false;
    const number=typeof value==='number'?value:Number(match![1]),unit=match?.[2]??'px';
    if(!Number.isFinite(number)||number<0)return false;
    if(unit==='%')return dimension&&number<=100;
    const pixels=unit==='rem'?number*16:number;
    return pixels<=(dimension?2048:128)&&(key!=='fontSize'||pixels>=8);
  }
  return false;
}
/** Validate before rendering, never sanitize by stripping: a rejected view keeps the last good state untouched. */
export function validateProgramResult(value:unknown):ProgramResult{
  if(!isExtensionJson(value)||!plain(value)||Object.keys(value).some(k=>!['state','view'].includes(k))||!ProgramStateSchema.safeParse(value.state).success)fail();
  const root=(value as Record<string,unknown>).view;
  const stack=[{node:root,depth:0,svg:false,table:false}];let count=0,geometry=0;
  while(stack.length){
    const {node,depth,svg:parentSvg,table:parentTable}=stack.pop()!;
    if(++count>500||depth>20)fail();
    if(typeof node==='string'){if(node.length>8192)fail();continue;}
    if(!plain(node)||!(typeof node.tag==='string'&&tags.has(node.tag))||Object.keys(node).some(k=>!['tag','key','attrs','style','events','children'].includes(k)))fail();
    const n=node as unknown as ProgramNode,svg=n.tag==='svg'||parentSvg,table=n.tag==='table'||parentTable;
    if(n.tag==='svg'&&parentSvg||n.tag==='table'&&parentTable)fail();
    geometry+=String(n.attrs?.d??n.attrs?.points??'').match(/[-+]?(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?/g)?.length??0;if(geometry>4096)fail();
    if(svg!==svgTags.has(n.tag))fail();
    if(n.key!==undefined&&(typeof n.key!=='string'||n.key.length>100))fail();
    for(const [field,validate] of [['attrs',(key:string,v:unknown)=>validAttr(n.tag,key,v,svg)],['style',validStyle],['events',(key:string,v:unknown)=>events.has(key)&&(!['input','change'].includes(key)||['input','textarea','select'].includes(n.tag))&&typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(v)]] as const){
      const entries=n[field];if(entries!==undefined&&(!plain(entries)||Object.entries(entries).some(([k,v])=>!validate(k,v))))fail();
    }
    if(n.children!==undefined){
      if(!Array.isArray(n.children)||voidTags.has(n.tag)&&n.children.length||n.tag==='textarea'&&n.children.length)fail();
      const keys=new Set<string>();
      for(const child of n.children){if(typeof child==='object'&&child!==null&&child.key!==undefined){if(keys.has(child.key))fail();keys.add(child.key);}stack.push({node:child,depth:depth+1,svg,table});}
    }
  }
  if(typeof root==='string')fail();
  return value as unknown as ProgramResult;
}
