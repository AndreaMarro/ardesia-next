import {describe,it,expect} from 'vitest';
import {CompositionBodySchema,type CompositionBody} from '@ardesia/contracts';
import {renameCompositionField,validateCompositionExpressions,flattenNodes,mapNodes,moveNode} from './definitions';

const body=():CompositionBody=>({fields:[{key:'L',kind:'number',label:'Lunghezza',initial:1}],nodes:[{id:'input',kind:'input',props:{field:'L'}},{id:'plot',kind:'plot',props:{label:'Curva',variable:'x',expression:'L+x',min:0,max:10}}]});
describe('Creator preserves the meaning and boundaries of an open definition',()=>{
  it('rejects renaming a global field into the local plot variable without changing the draft',()=>{
    const original=body(),bytes=JSON.stringify(original);
    expect(()=>renameCompositionField(original,'L','x')).toThrow(/variabile locale/);
    expect(JSON.stringify(original)).toBe(bytes);
    expect(renameCompositionField(original,'L','distance').nodes[1]!.props).toMatchObject({variable:'x',expression:'distance+x'});
  });
  it('renames the shared control and plot parameter while preserving builtins and literal strings',()=>{
    const original=body();original.nodes[1]!.props={label:'Curva',variable:'L',expression:'min(L,10)+if(true,L,0)',min:0,max:10};
    expect(renameCompositionField(original,'L','distance').nodes[1]!.props).toMatchObject({variable:'distance',expression:'min(distance,10)+if(true,distance,0)'});
  });
  it('keeps unknown component props and children opaque during validation and field renaming',()=>{
    const original=body(),future={id:'future',kind:'future/formula',props:{expression:'future.member(L)',field:'L',variable:'L',custom:{x:1}},fallback:'Formula futura',children:[{id:'hidden',kind:'value',props:{label:'Opaque future payload',expression:'future.other(L)'}}]};
    original.nodes.push(future);expect(CompositionBodySchema.safeParse(original).success).toBe(true);
    expect(()=>validateCompositionExpressions(original)).not.toThrow();
    const renamed=renameCompositionField(original,'L','distance');expect(renamed.nodes[2]).toEqual(future);
    expect(flattenNodes(original.nodes).map(n=>n.node.id)).toEqual(['input','plot','future']);
    expect(mapNodes(original.nodes,'hidden',()=>null)).toEqual(original.nodes);
    expect(moveNode(original.nodes,'hidden',-1)).toEqual(original.nodes);
    const broken=body();broken.nodes[1]!.props.expression='unsafe.member(L)';expect(()=>validateCompositionExpressions(broken)).toThrow();
  });
});
