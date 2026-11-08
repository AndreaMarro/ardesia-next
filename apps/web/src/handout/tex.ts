import {renderToString} from 'katex';
// TeX is a programming language. Never interpolate user data as TeX code.
const escapes: Record<string, string> = {'\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}'};
const symbols: Record<string, string> = {'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','θ':'theta','λ':'lambda','μ':'mu','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','φ':'phi','ω':'omega','Δ':'Delta','Σ':'Sigma','Ω':'Omega','∞':'infty','×':'times','·':'cdot','±':'pm','≤':'leq','≥':'geq','≠':'neq','→':'rightarrow','∈':'in'};
/** Printable ASCII plus Latin accents; unrepresentable code points remain explicit. */
export function texText(text: string): string {
  return [...text.normalize('NFC')].map(char => {
    if (escapes[char]) return escapes[char];
    if (symbols[char]) return `\\ensuremath{\\${symbols[char]}}`;
    if (char === '\n' || char === '\r' || char === '\t') return ' ';
    if (char >= ' ' && char <= '~') return char;
    const punctuation: Record<string, string> = {'«':'\\guillemotleft{}','»':'\\guillemotright{}','’':"'",'‘':"'",'“':'``','”':"''",'–':'--','—':'---','…':'\\ldots{}',' ':'~','−':'-','°':'\\ensuremath{^\\circ}','§':'\\S{}','©':'\\copyright{}','•':'\\textbullet{}'};
    if (punctuation[char]) return punctuation[char];
    const decomposed = [...char.normalize('NFD')], accents: Record<string, string> = {'\u0300':'`','\u0301':"'",'\u0302':'^','\u0303':'~','\u0308':'"','\u0327':'c'};
    if (decomposed.length === 2 && /^[A-Za-z]$/.test(decomposed[0]!) && accents[decomposed[1]!]) return `\\${accents[decomposed[1]!]!}{${decomposed[0]}}`;
    return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`;
  }).join('');
}

type MathNode = {kind:'literal'; value:string} | {kind:'group'; children:MathNode[]} | {kind:'command'; name:string; args:MathNode[][]; optional?:MathNode[]} | {kind:'text'; name:'text'|'operatorname'; value:string} | {kind:'delimiter'; side:'left'|'right'; value:string};
const zero = new Set('alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega infty partial nabla ell hbar pm mp times div cdot ast circ bullet le leq ge geq ne neq approx sim simeq equiv propto in notin subset supset subseteq supseteq cup cap emptyset forall exists neg land lor to rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow mapsto dots ldots cdots vdots ddots sin cos tan arcsin arccos arctan sinh cosh tanh log ln exp min max lim sup inf sum prod int iint iiint oint'.split(' '));
const arities: Record<string, number> = {frac:2, dfrac:2, tfrac:2, binom:2, sqrt:1, overline:1, underline:1, vec:1, hat:1, bar:1, dot:1, ddot:1, mathrm:1, mathbf:1, mathit:1, mathcal:1, mathbb:1, overset:2, underset:2};
/** A small mathematical grammar -> AST -> canonical TeX. Unknown constructs are data.
 * No macro definitions, expansion, environments, comments, files or engine primitives. */
export function texMath(input: string): string | null {
  if (input.length > 10_000 || input.includes('^^')) return null;
  let index=0, depth=0, pairs=0;
  const fail = (): never => {throw Error('Unsupported formula');};
  const spaces = () => {while (/\s/.test(input[index] ?? '') && index < input.length) index++;};
  const group = (): MathNode[] => {spaces(); if (input[index++] !== '{') fail(); return sequence('}');};
  function sequence(end = ''): MathNode[] {
    if (++depth > 64) fail();
    const nodes: MathNode[]=[];
    while (index < input.length && (!end || input[index] !== end)) {
      const char=input[index++]!;
      if (/\s/.test(char)) {nodes.push({kind:'literal',value:' '});continue;}
      if (char==='{') {nodes.push({kind:'group',children:sequence('}')});continue;}
      if (char==='}') fail();
      if (symbols[char]) {nodes.push({kind:'command',name:symbols[char]!,args:[]});continue;}
      if (char==='−') {nodes.push({kind:'literal',value:'-'});continue;}
      if (char==='\\') {
        const name=input.slice(index).match(/^[A-Za-z]+/)?.[0];
        if (!name) {
          const escaped=input[index++] ?? '';
          if (!['{','}','|',',',';',':','!',' ','%','#','_','&'].includes(escaped)) fail();
          nodes.push({kind:'command',name:escaped,args:[]});continue;
        }
        index+=name.length;
        if (name==='text' || name==='operatorname') {
          spaces();if(input[index++]!=='{')fail();
          const start=index;let level=1;
          while(index<input.length && level){const c=input[index++]!;if(c==='{')level++;if(c==='}')level--;}
          if(level)fail();
          const value=input.slice(start,index-1);
          if(!/^[\p{L}\p{N}\s.,:;!?()=+/-]*$/u.test(value))fail();
          nodes.push({kind:'text',name,value});continue;
        }
        if (name==='left'||name==='right') {
          spaces();let delimiter=input[index++] ?? '';
          if(delimiter==='\\'){const d=input.slice(index).match(/^(?:(?:langle|rangle|lvert|rvert|lVert|rVert)(?![A-Za-z])|\{|\})/)?.[0];if(!d)fail();index+=d!.length;delimiter='\\'+d;}
          else if(!['(',')','[',']','|','.','/'].includes(delimiter))fail();
          pairs+=name==='left'?1:-1;if(pairs<0)fail();
          nodes.push({kind:'delimiter',side:name,value:delimiter});continue;
        }
        if(zero.has(name)){nodes.push({kind:'command',name,args:[]});continue;}
        if(!Object.hasOwn(arities,name))fail();
        spaces();let optional:MathNode[]|undefined;
        if(name==='sqrt'&&input[index]==='['){index++;optional=sequence(']');}
        const args=Array.from({length:arities[name]!},()=>group());
        nodes.push({kind:'command',name,args,...(optional?{optional}: {})});continue;
      }
      if(!/^[A-Za-z0-9+\-=<>.,:;!?()[\]|/'^_]$/.test(char))fail();
      nodes.push({kind:'literal',value:char});
    }
    if(end && input[index++]!==end)fail();depth--;return nodes;
  }
  const emit=(nodes:MathNode[]):string=>nodes.map(node=>{
    if(node.kind==='literal')return node.value;
    if(node.kind==='group')return '{'+emit(node.children)+'}';
    if(node.kind==='text')return '\\'+node.name+'{'+texText(node.value)+'}';
    if(node.kind==='delimiter')return '\\'+node.side+node.value+' ';
    return '\\'+node.name+(node.optional?'['+emit(node.optional)+']':'')+node.args.map(arg=>'{'+emit(arg)+'}').join('')+(node.args.length?'':' ');
  }).join('');
  try {
    const ast=sequence();if(pairs!==0||index!==input.length)return null;
    const output=emit(ast);
    // Syntax check only: security comes from the grammar and canonical emitter above.
    renderToString(output,{throwOnError:true,trust:false,strict:'error',maxExpand:1000});
    return output;
  }catch{return null;}
}
