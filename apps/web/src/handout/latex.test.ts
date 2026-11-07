import {describe,expect,it} from 'vitest';
import {CoreError,type LessonDocument,type InkObject} from '@ardesia/contracts';
import {projectHandout} from '@ardesia/lesson-os';
import {handoutLatex,inkBounds,inkTikz} from './latex';
import {texMath,texText} from './tex';
import {prepareHandout} from './prepare';
const time='2026-11-07T10:00:00.000Z';
const base={id:'ink',title:'Annotazione',x:999999,y:-999999,width:200,height:100,revision:1,status:'draft' as const,provenance:{origin:'authored' as const,sources:[],createdBy:'teacher',createdAt:time}};
const ink:InkObject={...base,type:'ink',data:{color:'#294435',width:4,points:[{x:-30,y:15,pressure:0},{x:200,y:150,pressure:1}]}};
const lesson:LessonDocument={id:'lesson',ownerId:'teacher',title:'Una lezione',revision:3,status:'draft',createdAt:time,updatedAt:time,connections:[],objects:[ink]};
describe('safe TeX and TikZ output',()=>{
  it('emits supported mathematics canonically and validates syntax',()=>{
    for(const formula of ['T=2\\pi\\sqrt{\\frac{L}{g}}','E=\\frac{1}{2}kx^2','\\sqrt[3]{x}','\\left(\\frac{x}{y}\\right)^2','\\text{massa in kg}','\\operatorname{rank}(A)','α+β≤π'])expect(texMath(formula),formula).not.toBeNull();
    for(const invalid of ['x^','\\frac{a}','\\left(x','x}}','\\begin{matrix}a\\end{matrix}'])expect(texMath(invalid),invalid).toBeNull();
  });
  it('blocks TeX engine, macro, environment and preprocessing injection',()=>{
    for(const payload of ['\\input{secret}','\\write18{touch file}','\\csname input\\endcsname','\\catcode`x=0','\\directlua{os.execute(1)}','^^5cinput{secret}','\\def\\a{1}\\a','x%\\input{file}','\\text{ok}\\end{document}','\\href{file:///secret}{x}','\\includegraphics{secret}','\\newcommand{\\a}{x}','\\text{ok}\n\\input{secret}'])expect(texMath(payload),payload).toBeNull();
    expect(texMath('\\text{\\input{secret}}')).toBeNull();
    expect(texMath('\\text{\\alpha}')).toBeNull();
    expect(texMath('\\left\\langlefoo x \\right)')).toBeNull();
    expect(texMath('{'.repeat(65)+'x'+'}'.repeat(65))).toBeNull();
  });
  it('escapes every text surface without verbatim or raw executable comments',()=>{
    const hostile='\\end{document}\n^^5cinput{secret}%&#_$';
    const out=texText(hostile);
    expect(out).not.toContain('\\end{');expect(out).not.toContain('^^');expect(out).toContain('\\textbackslash{}');expect(out).toContain('\\%');
    const document={...lesson,title:hostile,objects:[{...base,id:'formula',title:hostile,type:'formula' as const,data:{latex:hostile,description:hostile}}]};
    const result=handoutLatex(projectHandout(document));
    expect(result.source.match(/\\end\{document\}/g)).toHaveLength(1);
    expect(result.source).not.toContain('\\input{');expect(result.source).not.toContain('^^');expect(result.source).not.toContain('verbatim');expect(result.warnings).toHaveLength(1);
  });
  it('normalizes ink from its actual sample bounds including pressure and extreme board positions',()=>{
    expect(inkBounds(ink)).toEqual({left:-30.6,top:14.4,width:234,height:139});
    const text=inkTikz(ink);
    expect(text).not.toContain('999999');expect(text).not.toContain('NaN');expect(text).not.toContain('Infinity');
    const radii=[...text.matchAll(/radius=([\d.]+)cm/g)].map(m=>Number(m[1]));
    expect(radii).toHaveLength(2);expect(radii[1]!).toBeGreaterThan(radii[0]!);
    expect(text).toContain('-- cycle;');
  });
  it('preserves unsupported Unicode visibly and reports conversion limits',()=>{
    const result=handoutLatex(projectHandout({...lesson,title:'Studio 🧪'}));
    expect(result.source).toContain('[U+1F9EA]');expect(result.warnings).toHaveLength(1);
    expect(texText('Energia è già quantità')).toContain('\\`{e}');
  });
  it('does not swallow a permission refusal while resolving historical sources',()=>{
    const cited={...lesson,objects:[{...ink,provenance:{...ink.provenance,sources:[{sourceId:'source',revision:1,locator:'p 1'}]}}]};
    expect(prepareHandout(cited,()=>{throw new CoreError('NOT_FOUND','Missing');}).missingSources).toHaveLength(1);
    expect(()=>prepareHandout(cited,()=>{throw new CoreError('FORBIDDEN','No access');})).toThrow('No access');
  });
});
