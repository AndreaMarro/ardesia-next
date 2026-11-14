import {it,expect} from 'vitest';
import {projectHandout,planHandout} from '@ardesia/lesson-os';
import {canonicalJson,extensionDefinitionDigest,type LessonDocument,type InkObject,type MaterialObject} from '@ardesia/contracts';
import {initialProgram} from '../creator/program-example';
import {buildHandoutFiles,verifyHandoutFiles,handoutHash} from './bundle';
import {inkPlates,materialPlate,plateSvg,plateTikz,visibleInk} from './plates';
import {rasterSize} from '../materials/render';

const time='2026-11-08T12:00:00.000Z';
const base={title:'Originale',x:10,y:10,width:100,height:200,revision:1,status:'draft' as const,provenance:{origin:'authored' as const,sources:[],createdBy:'author',createdAt:time}};
const stroke:InkObject={...base,id:'ink-a',type:'ink',data:{points:[{x:0,y:0,pressure:.1},{x:20,y:10,pressure:.9}],color:'#294435',width:3}};
const lesson:LessonDocument={id:'lesson',ownerId:'author',title:'La lezione',revision:7,status:'draft',createdAt:time,updatedAt:time,connections:[],objects:[stroke]};
const decode=(bytes:Uint8Array)=>new TextDecoder().decode(bytes);
const encode=(value:unknown)=>new TextEncoder().encode(canonicalJson(value)+'\n');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN7cAAAAASUVORK5CYII=','base64'));
async function fixture(){
  const digest=await handoutHash(png),path='assets/'+digest+'.png',original='originals/'+digest+'.png';
  const material:MaterialObject={...base,id:'material',type:'material',x:8000,y:5000,data:{assetId:'asset',sha256:digest,mimeType:'image/png',name:'Originale.png',license:'CC0',page:1,pageCount:1,pageWidth:1,pageHeight:1}};
  const ink={...stroke,x:31,y:42,data:{...stroke.data,anchor:{objectId:material.id,x:20,y:30}}};
  const handout=projectHandout({...lesson,objects:[material,ink,{...stroke,id:'free-b',x:-20,y:-40}]});
  return {handout,assets:[{objectId:material.id,originalPath:original,rasterPath:path,width:1,height:1,dpi:1,limited:true}],files:{[path]:png,[original]:png},notice:'Copia offline verificata'};
}
it('preserves original snapshots, complete coverage and shared annotation geometry after a page move',async()=>{
  const input=await fixture(),before=structuredClone(input.handout.document),plan=planHandout(input.handout);
  expect(plan.coverage.map(o=>o.objectId).sort()).toEqual(['free-b','ink-a','material']);
  const material=before.objects[0] as MaterialObject,ink=before.objects[1] as InkObject;
  const plate=materialPlate(material,[ink]),moved=materialPlate({...material,x:material.x+4000,y:material.y-3000},[ink]);
  expect(plate.bounds).toEqual(moved.bounds);expect(plateSvg(plate)).toEqual(plateSvg(moved));expect(plate.ink[0]).toMatchObject({dx:11,dy:12});
  const files=await buildHandoutFiles(input),verified=await verifyHandoutFiles(files);
  expect(JSON.parse(decode(files['source.json']!)).document).toEqual(before);
  expect(input.handout.document).toEqual(before);expect(decode(verified.mainTex)).toContain('\\includegraphics');
  expect(verified.warnings.join(' ')).toContain('Copia offline');expect(verified.warnings.join(' ')).toContain('Risoluzione ridotta');
  expect(files[input.assets[0]!.originalPath]).toEqual(png);
  expect(await buildHandoutFiles(input)).toEqual(files);
});
it('rejects omitted originals, corrupted byte payloads, changed generated TeX and forged self-consistent hashes',async()=>{
  const input=await fixture(),files=await buildHandoutFiles(input);
  const omitted={...files};delete omitted[input.assets[0]!.originalPath];await expect(verifyHandoutFiles(omitted)).rejects.toThrow();
  const broken={...files,[input.assets[0]!.rasterPath]:new Uint8Array(png).fill(0)};await expect(verifyHandoutFiles(broken)).rejects.toThrow();
  const altered:Record<string,Uint8Array>={...files,'main.tex':new TextEncoder().encode('\\input{/etc/passwd}')};
  const manifest=JSON.parse(decode(altered['manifest.json']!));const entry=manifest.files.find((f:{path:string})=>f.path==='main.tex');
  entry.bytes=altered['main.tex']!.length;entry.sha256=await handoutHash(altered['main.tex']!);altered['manifest.json']=encode(manifest);
  await expect(verifyHandoutFiles(altered)).rejects.toThrow('Generated file mismatch');
  await expect(verifyHandoutFiles({...files,'private-token.txt':encode('secret')})).rejects.toThrow();
  const source=JSON.parse(decode(files['source.json']!));source.document.notes='PRIVATE';await expect(verifyHandoutFiles({...files,'source.json':encode(source)})).rejects.toThrow();
});
it('regenerates byte-identical TeX after canonical JSON reorders nested Creator state keys',async()=>{
  const definition=initialProgram();
  const state={next:2,ideas:[{text:'Misura salvata',id:1}],draft:''};
  const handout=projectHandout({...lesson,objects:[{...base,id:'program',type:'extension',data:{definition,definitionDigest:await extensionDefinitionDigest(definition),state}}]});
  const files=await buildHandoutFiles({handout,assets:[],files:{},notice:''});
  const verified=await verifyHandoutFiles(files);
  expect(verified.mainTex).toEqual(files['main.tex']);
  expect(handout.document.objects[0]!.type==='extension'&&handout.document.objects[0]!.data.state).toEqual(state);
});
it('keeps multi-stroke spacing and pressure on a common scale and continues a boundary crossing in adjacent tiles',()=>{
  const second={...stroke,id:'ink-b',x:35};
  const tiles=inkPlates([stroke,second]);expect(tiles).toHaveLength(1);expect(tiles[0]!.ink.map(s=>s.dx)).toEqual([10,35]);
  const svg=plateSvg(tiles[0]!);expect(svg).toContain('M9.34 10');expect(svg).toContain('M34.34 10');
  expect(plateTikz(tiles[0]!)).toContain('\\clip');
  const crossing=inkPlates([{...stroke,x:630,y:20}]);expect(crossing).toHaveLength(2);
  expect(crossing[0]!.bounds.left).toBeLessThan(640);expect(crossing[1]!.bounds.left).toBe(640);expect(crossing.every(p=>p.ink[0]!.object===crossing[0]!.ink[0]!.object)).toBe(true);
  const negative=inkPlates([{...stroke,x:-40,y:-30}]);expect(negative[0]!.bounds.left).toBeLessThan(-40);expect(negative[0]!.bounds.top).toBeLessThan(-30);
  expect(()=>inkPlates(Array.from({length:65},(_,i)=>({...stroke,id:'ink-'+i,x:10+640*i})))).toThrow('64 tavole');
});
it('bounds print rasters independently of declared material geometry',()=>{
  for(const [width,height] of [[600,800],[1e9,1],[1,1e9],[1e9,1e9]]){
    const out=rasterSize(width!,height!,{width:1e6,height:1e6,maxPixels:8_000_000});
    expect(out.width*out.height).toBeLessThanOrEqual(8_000_000);
  }
  expect(()=>rasterSize(NaN,1,{width:100,height:100,maxPixels:10000})).toThrow();
});
it('clips dense ink before emission and rejects a crowded plate without silently dropping samples',()=>{
  const points=Array.from({length:20000},(_,i)=>({x:10+5100*i/19999,y:30+6200*i/19999,pressure:.5}));
  const object={...stroke,x:0,y:0,width:5200,height:6300,data:{...stroke.data,points}};
  const plates=inkPlates([object]),emitted=plates.reduce((sum,p)=>sum+visibleInk(p.ink[0]!,p.bounds).flat().length,0);
  expect(plates.length).toBeGreaterThan(8);expect(emitted).toBeLessThan(22000);
  expect(emitted).toBeLessThan(points.length*plates.length/4);
  const crowd=Array.from({length:2},(_,i)=>({...stroke,id:'crowd-'+i,data:{...stroke.data,points:points.map((p,index)=>({...p,x:index%200,y:Math.floor(index/200)}))}}));
  expect(()=>inkPlates(crowd)).toThrow('troppi campioni');
  expect(object.data.points).toBe(points);
});
