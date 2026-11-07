import {COMPOSITION_RENDERER, type CompositionBody, type CompositionNode, type ExtensionDefinition} from '@ardesia/contracts';
import {compileExpression,renameExpression} from '@ardesia/plugin-host';

export function initialDefinition():ExtensionDefinition{
  return {format:'ardesia-extension/1',typeId:'user.'+crypto.randomUUID(),version:1,name:'Il mio strumento',description:'Pendolo semplice: piccole oscillazioni, gravità costante g = 9,81 m/s². Esempio da verificare prima della pubblicazione.',license:'Tutti i diritti riservati',renderer:COMPOSITION_RENDERER,fallback:'Strumento composto con controlli e risultati. La definizione originale è inclusa.',body:{
    fields:[{key:'L',label:'Lunghezza',kind:'number',initial:1,min:0.1,max:3,step:0.1,unit:'m'}],
    nodes:[{id:'intro',kind:'text',props:{text:'Esplora il periodo di un pendolo. Piccole oscillazioni · g = 9,81 m/s².'}},
      {id:'length',kind:'input',props:{field:'L',appearance:'slider'}},
      {id:'period',kind:'value',props:{label:'Periodo',expression:'2*pi*sqrt(L/9.81)',unit:'s'}},
      {id:'graph',kind:'plot',props:{label:'Periodo T (s)',expression:'2*pi*sqrt(L/9.81)',variable:'L',min:0.1,max:3,unit:'m'}}],
  }};
}
export const componentLabels:Record<string,string>={text:'Testo',input:'Controllo',value:'Risultato',plot:'Grafico',group:'Gruppo',action:'Azione',scene:'Scena',shape:'Forma'};
const isContainer=(node:CompositionNode)=>node.kind==='group'||node.kind==='scene';
export function mapNodes(nodes:CompositionNode[],id:string,change:(node:CompositionNode)=>CompositionNode|null):CompositionNode[]{
  return nodes.flatMap(node=>{if(node.id===id){const next=change(node);return next?[next]:[];}return [{...node,...(isContainer(node)&&node.children?{children:mapNodes(node.children,id,change)}:{})}];});
}
export function flattenNodes(nodes:CompositionNode[],depth=0):{node:CompositionNode;depth:number}[]{return nodes.flatMap(node=>[{node,depth},...(isContainer(node)?flattenNodes(node.children??[],depth+1):[])]);}
export function validateCompositionExpressions(body:CompositionBody):void{
  for(const {node}of flattenNodes(body.nodes)){
    if(['value','plot','action'].includes(node.kind))compileExpression(String(node.props.expression));
    if(node.kind==='shape')for(const name of ['x','y','width','height'])compileExpression(String(node.props[name]));
  }
}
export function renameCompositionField(body:CompositionBody,from:string,to:string):CompositionBody{
  if(flattenNodes(body.nodes).some(({node})=>node.kind==='plot'&&node.props.variable===to&&to!==from))throw Error('Questo nome è già la variabile locale di un grafico. Scegli un nome diverso.');
  const rename=(nodes:CompositionNode[]):CompositionNode[]=>nodes.map(node=>{
    if(!Object.hasOwn(componentLabels,node.kind))return node;
    const props={...node.props};
    if(['input','action'].includes(node.kind)&&props.field===from)props.field=to;
    if(node.kind==='plot'&&props.variable===from)props.variable=to;
    if(['value','plot','action'].includes(node.kind))props.expression=renameExpression(String(props.expression),from,to);
    if(node.kind==='shape')for(const key of ['x','y','width','height'])props[key]=renameExpression(String(props[key]),from,to);
    return {...node,props,...(isContainer(node)&&node.children?{children:rename(node.children)}:{})};
  });
  return {...body,fields:body.fields.map(field=>field.key===from?{...field,key:to}:field),nodes:rename(body.nodes)};
}
export function moveNode(nodes:CompositionNode[],id:string,delta:number):CompositionNode[]{
  const index=nodes.findIndex(n=>n.id===id),next=index+delta;
  if(index>=0&&next>=0&&next<nodes.length){const copy=[...nodes];[copy[index],copy[next]]=[copy[next]!,copy[index]!];return copy;}
  return nodes.map(n=>isContainer(n)&&n.children?{...n,children:moveNode(n.children,id,delta)}:n);
}
export function appendComponent(body:CompositionBody,kind:string,parent:string|null):{body:CompositionBody;selected:string}{
  const id='n'+crypto.randomUUID().replaceAll('-','').slice(0,12),field='v'+id.slice(1,8);
  const nodes:Record<string,CompositionNode>={
    text:{id,kind,props:{text:'Il tuo testo'}}, input:{id,kind,props:{field,appearance:'slider'}},
    value:{id,kind,props:{label:'Risultato',expression:body.fields[0]?.key??'0',unit:''}},
    plot:{id,kind,props:{label:'Grafico',expression:'x^2',variable:'x',min:0,max:10,unit:''}},
    group:{id,kind,props:{layout:'stack'},children:[]},
    action:{id,kind,props:{label:'Incrementa',field:body.fields.find(f=>f.kind==='number')?.key??field,expression:(body.fields.find(f=>f.kind==='number')?.key??field)+'+1'}},
    scene:{id,kind,props:{label:'La mia scena',width:400,height:240},children:[{id:id+'s',kind:'shape',props:{shape:'circle',x:'200',y:'120',width:'40',height:'40',color:'#235e50'}}]},
    shape:{id,kind,props:{shape:'rect',x:'20',y:'20',width:'100',height:'50',color:'#235e50'}},
  };
  const node=nodes[kind]!;
  const needField=kind==='input'||kind==='action'&&!body.fields.some(f=>f.kind==='number');
  const fields=needField?[...body.fields,{key:field,label:'Valore',kind:'number' as const,initial:1,min:0,max:100,step:1,unit:''}]:body.fields;
  const container=flattenNodes(body.nodes).find(n=>n.node.id===parent)?.node;
  const nested=container&&(container.kind==='group'&&kind!=='shape'||container.kind==='scene'&&kind==='shape');
  return {body:{fields,nodes:nested?mapNodes(body.nodes,container.id,n=>({...n,children:[...n.children??[],node]})):[...body.nodes,node]},selected:id};
}
