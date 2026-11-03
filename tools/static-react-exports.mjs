import {createHash} from 'node:crypto';
import ts from 'typescript';
const leaves = /\/node_modules\/(?:react\/cjs\/react(?:-jsx-runtime)?|react-dom\/cjs\/react-dom(?:-client)?|scheduler\/cjs\/scheduler)\.production\.js$/;
const entries = /\/node_modules\/(?:react\/(?:index|jsx-runtime)|react-dom\/(?:index|client)|scheduler\/index)\.js$/;
// Closed production consumer: expose the pinned CJS exports to ordinary tree-shaking.
// Keep package APIs and startup effects; fail closed on any dependency-byte change.
const hashes = {
  "react/index.js": "60caffdecbdc5db3bc4ec4e83df9488345ccb271d07533b9210bf5750918d97e",
  "react/jsx-runtime.js": "b392951a77d0a2e6a6bd017e49d768481ae5b63c4109c6c31f622cf7b2433edc",
  "react-dom/index.js": "ba1a3e33489f868371561777607e3ee5091df0f7ea3f1a10f789d6b86e4c1505",
  "react-dom/client.js": "00e348ab3d6bc2eef908345d0bc4e008c95bcfecec060dfda5c4967953761396",
  "scheduler/index.js": "145965504d60007bc25486ab930b0367867dcd5d579ccd343c148d69349a7cfb",
  "react/cjs/react.production.js": "0b5529981841afa1b58c76ba85c29bb681ff5f07cd8cde6a10b967d3915b8e1c",
  "react/cjs/react-jsx-runtime.production.js": "1e46f15002696985e80c61d47aaa30dabb03c954270a690f5f7dfbbacfa9002b",
  "react-dom/cjs/react-dom.production.js": "7a05d7f7bb2b02aae84018a88d4815a2181eef48d2cb8172d403eaa2b131eefd",
  "react-dom/cjs/react-dom-client.production.js": "a319b413b7a19ee34422d9a12a8e7afd003c07846716d278ba1a0898e8cb6251",
  "scheduler/cjs/scheduler.production.js": "679adff761d31e9426604f80c0e99be44a3e6f4c6834b0218ecf0312a67c171f"
};
export function staticReactExports() {
 const dce = new Map();
 return {
 name:'ardesia-static-react-exports', apply:'build', enforce:'pre',
 resolveId(id){if(dce.has(id))return id;},load(id){return dce.get(id);},
 transform(code,id){
  if(id.startsWith('\0'))return;
  const key=id.slice(id.lastIndexOf('/node_modules/')+14);
  if(!Object.hasOwn(hashes,key))return;
  if(createHash('sha256').update(code).digest('hex')!==hashes[key])throw Error('Pinned React input changed: '+key);
  if(entries.test(id)){
   const pos=code.indexOf("if (process.env.NODE_ENV === 'production')");
   const req=/module\.exports = require\('([^']+\.production\.js)'\)/.exec(code);
   if(pos<0||!req)throw Error('unrecognized entry '+id);
   let prefix='';
   if(code.includes('function checkDCE()')){
    const virtual='\0react-dce:'+id;dce.set(virtual,code.slice(0,pos)+'\ncheckDCE();');prefix='import '+JSON.stringify(virtual)+';\n';
   }
   return {code:prefix+'export * from '+JSON.stringify(req[1])+';\nimport * as api from '+JSON.stringify(req[1])+';\nexport default api;\n',map:null};
  }
  if(!leaves.test(id))return;
  if(id.endsWith('/react/cjs/react.production.js')){
   const a=code.indexOf('var ReactNoopUpdateQueue = '),b=code.indexOf('var isArrayImpl = ');
   if(a<0||b<a)throw Error('component region changed');
   const region=code.slice(a,b).replace('  assign = Object.assign,\n','');
   code=code.slice(0,a)+'var assign = Object.assign;\nvar classes = /* @__PURE__ */ (() => {\n'+region+'return {Component, PureComponent};\n})();\nvar Component = /* @__PURE__ */ (() => classes.Component)();\nvar PureComponent = /* @__PURE__ */ (() => classes.PureComponent)();\n'+code.slice(b);
  }
  const sf=ts.createSourceFile(id,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS), names=new Set(),declared=new Set(),edits=[],imports=new Map(),aliases=new Map();
  function scan(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&ts.isIdentifier(n.initializer.expression)&&n.initializer.expression.text==='require'){
    const spec=n.initializer.arguments[0].text;if(!imports.has(spec))imports.set(spec,'__react_import_'+imports.size);aliases.set(n.name.text,imports.get(spec));
  }ts.forEachChild(n,scan);}scan(sf);
  function visit(n){
   if(ts.isIdentifier(n)&&aliases.has(n.text)&&!(ts.isVariableDeclaration(n.parent)&&n.parent.name===n)){
    edits.push({start:n.getStart(sf),end:n.end,text:aliases.get(n.text)});return;
   }
   if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='exports'){
    const name=n.name.text;names.add(name);
    const assignment=ts.isBinaryExpression(n.parent)&&n.parent.left===n&&n.parent.operatorToken.kind===ts.SyntaxKind.EqualsToken;
    const top=assignment&&ts.isExpressionStatement(n.parent.parent)&&ts.isSourceFile(n.parent.parent.parent);
    if(top)declared.add(name);
    edits.push({start:n.getStart(sf),end:n.end,text:(top?'var ':'')+'__react_export_'+name});return;
   }
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='require'){
    if(n.arguments.length!==1||!ts.isStringLiteral(n.arguments[0]))throw Error('dynamic require');
    const spec=n.arguments[0].text;if(!['react','react-dom','scheduler'].includes(spec))throw Error('unknown require '+spec);
    if(!imports.has(spec))imports.set(spec,'__react_import_'+imports.size);
    edits.push({start:n.getStart(sf),end:n.end,text:imports.get(spec)});return;
   }
   ts.forEachChild(n,visit);
  }visit(sf);
  for(const e of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,e.start)+e.text+code.slice(e.end);
  const undeclared=[...names].filter(n=>!declared.has(n));
  return {code:[...imports].map(([s,n])=>'import * as '+n+' from '+JSON.stringify(s)+';').join('\n')+'\n'+(undeclared.length?'var '+undeclared.map(n=>'__react_export_'+n).join(',')+';\n':'')+code+'\nexport {'+[...names].map(n=>'__react_export_'+n+' as '+n).join(',')+'};',map:null};
 }
 };
}
