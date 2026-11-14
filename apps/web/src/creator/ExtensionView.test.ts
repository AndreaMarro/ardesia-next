import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import type {ExtensionData} from '@ardesia/contracts';
import {ExtensionView} from './ExtensionView';
const data=(expression:string,min:number,max:number):ExtensionData=>({definition:{format:'ardesia-extension/1',typeId:'test.plot',version:1,name:'Curva',description:'Fixture',license:'CC0-1.0',renderer:'ardesia.composition/1',fallback:'Curva',body:{fields:[],nodes:[{id:'plot',kind:'plot',props:{label:'Curva',variable:'x',expression,min,max}}]}},definitionDigest:'0'.repeat(64),state:{}});
describe('composed plots preserve finite scientific scale',()=>{
  it.each([['x',-1e308,1e308],['x',-1e-300,1e-300],['0',0,10]] as const)('renders finite positions for %s on [%s,%s]',(expression,min,max)=>{
    const html=renderToStaticMarkup(createElement(ExtensionView,{data:data(expression,min,max)}));
    expect(html).not.toContain('role="alert"');expect(html).not.toMatch(/NaN|Infinity/);
    const path=/<path d="([^"]+)" fill="none" stroke="var\(--primary\)"/.exec(html)![1]!;
    const points=path.match(/[ML][\d.e+-]+,[\d.e+-]+/g)!.map(point=>point.slice(1).split(',').map(Number));
    expect(points).toHaveLength(81);expect(points.flat().every(Number.isFinite)).toBe(true);
    const range=Math.max(...points.map(p=>p[1]!))-Math.min(...points.map(p=>p[1]!));
    expect(range).toBe(expression==='0'?0:160);
  });
});
