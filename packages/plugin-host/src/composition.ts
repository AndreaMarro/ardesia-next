import {CompositionBodySchema, COMPOSITION_RENDERER, type ExtensionData, type ExtensionValue} from '@ardesia/contracts';

type Value = number | string | boolean;
type Expr = {kind:'value';value:Value}|{kind:'name';name:string}|{kind:'unary';op:string;value:Expr}|{kind:'binary';op:string;left:Expr;right:Expr}|{kind:'call';name:string;args:Expr[]};
const precedence:Record<string,number> = {'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6,'^':7};
const functions:Record<string,(...values:number[])=>number> = {sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,log:Math.log,floor:Math.floor,ceil:Math.ceil,round:Math.round,min:Math.min,max:Math.max,pow:Math.pow,clamp:(v,min,max)=>Math.max(min,Math.min(max,v))};
const arity:Record<string,number|[number,number]>={sin:1,cos:1,tan:1,sqrt:1,abs:1,exp:1,log:1,floor:1,ceil:1,round:1,min:[1,20],max:[1,20],pow:2,clamp:3,if:3};
const fail=():never=>{throw new Error('Espressione non valida: usa variabili dichiarate e operazioni matematiche.');};
const number=(v:Value):number=>typeof v==='number'&&Number.isFinite(v)?v:fail();

/** Arithmetic grammar only. No eval, Function, member access, assignments, loops or I/O. */
export function compileExpression(source:string):(state:Record<string,ExtensionValue>)=>Value {
  if(!source.length||source.length>1000)return fail();
  const tokens:string[]=[];let offset=0;
  while(offset<source.length){
    const rest=source.slice(offset),space=/^\s+/.exec(rest);if(space){offset+=space[0].length;continue;}
    const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[A-Za-z][A-Za-z0-9_]*|^"(?:[^"\\]|\\["\\nrt])*"|^(?:<=|>=|==|!=|&&|\|\||[+\-*/%^(),!<>])/.exec(rest);
    if(!match||tokens.length>=400)return fail();tokens.push(match[0]);offset+=match[0].length;
  }
  let cursor=0,nodes=0;
  function parse(min=0,depth=0):Expr {
    if(depth>32||++nodes>400)return fail();
    const token=tokens[cursor++];if(!token)return fail();let left:Expr;
    if(token==='('){left=parse(0,depth+1);if(tokens[cursor++]!==')')return fail();}
    else if(['+','-','!'].includes(token))left={kind:'unary',op:token,value:parse(7,depth+1)};
    else if(token.startsWith('"'))left={kind:'value',value:JSON.parse(token) as string};
    else if(/^[.\d]/.test(token))left={kind:'value',value:number(Number(token))};
    else if(/^[A-Za-z]/.test(token)){
      if(tokens[cursor]==='('){
        if(!Object.hasOwn(arity,token))return fail();cursor++;const args:Expr[]=[];
        if(tokens[cursor]!==')')do{args.push(parse(0,depth+1));if(tokens[cursor]!==',')break;cursor++;}while(true);
        if(tokens[cursor++]!==')')return fail();
        const expected=arity[token]!;if(typeof expected==='number'?args.length!==expected:args.length<expected[0]||args.length>expected[1])return fail();
        left={kind:'call',name:token,args};
      } else left={kind:'name',name:token};
    }else return fail();
    while(cursor<tokens.length){const op=tokens[cursor]!,rank=Object.hasOwn(precedence,op)?precedence[op]:undefined;if(rank===undefined||rank<min)break;cursor++;left={kind:'binary',op,left,right:parse(op==='^'?rank:rank+1,depth+1)};}
    return left;
  }
  const ast=parse();if(cursor!==tokens.length)return fail();
  return state=>{
    let budget=1200;
    function read(e:Expr):Value{
      if(--budget<0)return fail();let result:Value;
      if(e.kind==='value')return e.value;
      if(e.kind==='name'){
        if(e.name==='pi')return Math.PI;if(e.name==='e')return Math.E;if(e.name==='true')return true;if(e.name==='false')return false;
        const value=Object.hasOwn(state,e.name)?state[e.name]:undefined;
        return typeof value==='number'||typeof value==='string'||typeof value==='boolean'?value:fail();
      }
      if(e.kind==='unary'){const value=read(e.value);result=e.op==='!'?!value:e.op==='-'?-number(value):number(value);}
      else if(e.kind==='call'){
        if(e.name==='if')return read(e.args[0]!)?read(e.args[1]!):read(e.args[2]!);
        result=functions[e.name]!(...e.args.map(arg=>number(read(arg))));
      }else{
        const a=read(e.left);
        if(e.op==='&&')return Boolean(a)&&Boolean(read(e.right));if(e.op==='||')return Boolean(a)||Boolean(read(e.right));
        const b=read(e.right);
        switch(e.op){
          case '+':result=number(a)+number(b);break;case '-':result=number(a)-number(b);break;
          case '*':result=number(a)*number(b);break;case '/':result=number(a)/number(b);break;
          case '%':result=number(a)%number(b);break;case '^':result=number(a)**number(b);break;
          case '<':result=number(a)<number(b);break;case '<=':result=number(a)<=number(b);break;
          case '>':result=number(a)>number(b);break;case '>=':result=number(a)>=number(b);break;
          case '==':result=a===b;break;case '!=':result=a!==b;break;default:return fail();
        }
      }
      if(typeof result==='number'&&!Number.isFinite(result))throw Error('Il risultato non è finito per questi valori.');
      return result;
    }
    return read(ast);
  };
}

export function compositionBody(data:ExtensionData){
  if(data.definition.renderer!==COMPOSITION_RENDERER)return null;
  return CompositionBodySchema.parse(data.definition.body);
}
export function expressionValue(expression:string,state:ExtensionData['state']):Value{return compileExpression(expression)(state);}

/** Rename lexical identifiers, never text literals or exponent fragments. */
export function renameExpression(source:string,before:string,after:string):string{
  compileExpression(source);
  return source.replace(/"(?:[^"\\]|\\["\\nrt])*"|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*/g,(token,offset:number)=>token===before&&!/^\s*\(/.test(source.slice(offset+token.length))?after:token);
}
