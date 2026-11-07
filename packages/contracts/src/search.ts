import type {EducationalObject} from './index.ts';

/** Text from an already authorized, schema-checked object. No runtime execution,
 * URL resolution or history lookup. Budgets cover every valid ExtensionData. */
export function objectSearchText(object:EducationalObject):string{
  const parts:string[]=[object.title];let length=object.title.length,visited=0;
  function collect(value:unknown,depth=0):void{
    if(++visited>16_000||depth>24||length>=262_144)return;
    if(typeof value==='string'){
      const text=value.slice(0,Math.max(0,262_143-length));parts.push(text);length+=text.length+1;return;
    }
    if(value&&typeof value==='object')for(const entry of Object.values(Object.getOwnPropertyDescriptors(value))){
      if(entry.enumerable&&'value'in entry)collect(entry.value,depth+1);
      if(visited>16_000||length>=262_144)break;
    }
  }
  if(object.type==='note')collect(object.data.text);
  else if(object.type==='formula'){collect(object.data.latex);collect(object.data.description);}
  else if(object.type==='source'){collect(object.data.publisher);collect(object.data.locator);collect(object.data.url);}
  else if(object.type==='extension'){
    const {definition,state}=object.data;
    collect(state);collect(definition.name);collect(definition.description);collect(definition.fallback);
    // Program code is not lesson prose. Its user-authored collections live in state.
    if(definition.renderer==='ardesia.composition/1'){
      // Read prose/labels, not implementation IDs, component kinds or variable names.
      const body=definition.body as {fields?:unknown[];nodes?:unknown[]};
      function labels(value:unknown,depth=0):void{
        if(!value||typeof value!=='object'||depth>24)return;
        const node=value as {label?:unknown;unit?:unknown;fallback?:unknown;props?:{text?:unknown;label?:unknown;unit?:unknown};children?:unknown[]};
        collect(node.label);collect(node.unit);collect(node.fallback);collect(node.props?.text);collect(node.props?.label);collect(node.props?.unit);
        node.children?.forEach(child=>labels(child,depth+1));
      }
      body.fields?.forEach(field=>labels(field));body.nodes?.forEach(node=>labels(node));
    }else if(definition.renderer!=='ardesia.program/1')collect(definition.body);
  }
  return parts.join('\n');
}

/** A bounded excerpt around the literal match, with consistent Unicode and
 * whitespace handling in both the archive and MCP. null means no match. */
export function searchTextExcerpt(text:string,query:string):string|null{
  const readable=text.normalize('NFKC').replace(/\s+/gu,' ').trim();
  const needle=query.normalize('NFKC').replace(/\s+/gu,' ').trim().toLocaleLowerCase('it');
  const folded=readable.toLocaleLowerCase('it'),at=folded.indexOf(needle);if(at<0)return null;
  let matchStart=at,matchEnd=at+needle.length;
  // Lowercasing can expand a code point (e.g. İ → i + combining dot).
  // Map its offsets back before slicing the readable, case-preserving excerpt.
  if(needle&&folded.length!==readable.length){
    let lowerIndex=0,readIndex=0;
    for(const letter of readable){
      const next=lowerIndex+letter.toLocaleLowerCase('it').length;
      if(lowerIndex<=at&&next>at)matchStart=readIndex;
      if(lowerIndex<at+needle.length&&next>=at+needle.length){matchEnd=readIndex+letter.length;break;}
      lowerIndex=next;readIndex+=letter.length;
    }
  }
  const start=Math.max(0,matchStart-60),end=Math.min(readable.length,Math.max(matchEnd,start+220));
  return (start?'…':'')+readable.slice(start,end)+(end<readable.length?'…':'');
}
