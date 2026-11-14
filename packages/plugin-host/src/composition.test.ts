import {describe,expect,it} from 'vitest';
import {compileExpression,renameExpression} from './composition';

describe('bounded declarative expression runtime',()=>{
  it('evaluates mathematical models, conditional branches and state transitions without JavaScript',()=>{
    expect(compileExpression('2*pi*sqrt(L/9.81)')({L:1})).toBeCloseTo(2.00606668,7);
    expect(compileExpression('2^3^2')({})).toBe(512);
    expect(compileExpression('-2^2 + 10')({})).toBe(6);
    expect(compileExpression('if(count >= 10, 0, count+1)')({count:9})).toBe(10);
    expect(compileExpression('if(false, 1/0, 3)')({})).toBe(3);
    expect(compileExpression('label')({label:'Esperimento'})).toBe('Esperimento');
    expect(compileExpression('clamp(x, 0, 100)')({x:120})).toBe(100);
  });
  it.each(['window.location','globalThis','constructor.constructor("return this")()','fetch("https://example.com")','x=3','while(true){}','[1,2]','x[0]','__proto__','sqrt()','sin(1,2)','1/0','sqrt(-1)','1e999','x toString y'])('rejects invalid or executable expression %s',source=>{
    expect(()=>compileExpression(source)({x:1})).toThrow();
  });
  it('bounds parsing depth and work before evaluation',()=>{
    expect(()=>compileExpression('('.repeat(100)+'1'+')'.repeat(100))).toThrow();
    expect(()=>compileExpression('1+'.repeat(600)+'1')).toThrow();
    expect(()=>compileExpression('secret')(Object.create({secret:42}))).toThrow();
  });
  it('renames identifiers without touching string literals, other names or scientific notation',()=>{
    const expression='if(L>0, L+LL+1e-3, "L")';
    expect(renameExpression(expression,'L','length')).toBe('if(length>0, length+LL+1e-3, "L")');
    expect(compileExpression(renameExpression('L*2+20','L','distance'))({distance:30})).toBe(80);
    expect(renameExpression('1e3 + e','e','energy')).toBe('1e3 + energy');
    expect(renameExpression('min(x,10)+min','min','threshold')).toBe('min(x,10)+threshold');
    expect(compileExpression(renameExpression('min (x,10)+min','min','threshold'))({x:12,threshold:2})).toBe(12);
    expect(()=>renameExpression('L +','L','length')).toThrow();
  });
});
