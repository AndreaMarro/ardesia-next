/** Emit reproducible LaTeX from the same reviewed editorial records used in the lessons. */
import {readFileSync, writeFileSync} from 'node:fs';
import {loadReviewedQuestions, parts, reviewDirectory} from './physics-reviewed-content.mjs';

const output = process.argv[2];
if (!output) throw Error('Usage: node tools/build-physics-reviewed-pdf.mjs OUTPUT.tex');
const sample = JSON.parse(readFileSync(reviewDirectory+'/pdf-sample.json','utf8'));
const byId = new Map(loadReviewedQuestions().map(q=>[q.id,q]));
const rows = sample.map(id => {
  const row = byId.get(id);
  if (!row) throw Error('Missing sample record: '+id);
  return row;
});
const courses = Map.groupBy(rows, q=>q.courseId);
if (rows.length !== 10 || new Set(sample).size !== 10 || courses.size !== 5 || [...courses.values()].some(items=>items.length!==2))
  throw Error('The sample needs two distinct questions per course.');

const commands = new Set('frac dfrac tfrac sqrt cdot times mathrm mathbf mathit text left right big Big sin cos tan ln log exp pi theta alpha beta delta Delta mu rho lambda omega Omega phi varphi gamma Gamma pm mp prime circ approx le ge leq geq neq equiv propto vec hat bar overline int sum infty quad qquad textstyle displaystyle textsuperscript lvert rvert mathop tau varepsilon epsilon sigma Sigma partial degree overrightarrow angstrom dot ell'.split(' '));
const escaped = new Map(Object.entries({
  '\\': '\\textbackslash{}', '{':'\\{', '}':'\\}', '%':'\\%', '&':'\\&', '#':'\\#', '$':'\\$', '_':'\\_', '^':'\\textasciicircum{}', '~':'\\textasciitilde{}',
  '−':'\\(-\\)', '×':'\\(\\times\\)', '→':'\\(\\rightarrow\\)', '←':'\\(\\leftarrow\\)', 'Δ':'\\(\\Delta\\)', 'μ':'\\(\\mu\\)', 'Ω':'\\(\\Omega\\)',
  'π':'\\(\\pi\\)', 'θ':'\\(\\theta\\)', 'ρ':'\\(\\rho\\)', 'λ':'\\(\\lambda\\)', 'η':'\\(\\eta\\)', 'α':'\\(\\alpha\\)', 'β':'\\(\\beta\\)',
  '′':'\\(^{\\prime}\\)', '²':'\\textsuperscript{2}', '³':'\\textsuperscript{3}', '⁻':'\\textsuperscript{-}', '¹':'\\textsuperscript{1}',
  '₀':'\\textsubscript{0}', '₁':'\\textsubscript{1}', '₂':'\\textsubscript{2}', '₃':'\\textsubscript{3}', '₄':'\\textsubscript{4}',
  '≥':'\\(\\geq\\)', '≤':'\\(\\leq\\)', '≈':'\\(\\approx\\)', '·':'\\(\\cdot\\)', '∞':'\\(\\infty\\)'
}));
const plain = value => Array.from(value, char => escaped.get(char) ?? char).join('');
const linearMath = value => {
  for (const [,command] of value.matchAll(/\\([a-zA-Z]+)/g)) {
    if (!commands.has(command)) throw Error('Unsupported TeX command: '+command);
  }
  if (/[%#&\r\n]/.test(value) || /\\(?![a-zA-Z,;:! ])/u.test(value)) throw Error('Unsupported TeX punctuation: '+value);
  return '\\('+value+'\\)';
};
const tex = value => parts(value).map(({value,math})=>math ? linearMath(value) : plain(value)).join('');
const para = value => tex(value)+'\\par\n';

function tikz(figure) {
  const coord = (x,y) => '('+x+','+(180-y)+')';
  const line = (style,[x1,y1,x2,y2]) => '\\draw['+style+'] '+coord(x1,y1)+' -- '+coord(x2,y2)+';';
  return [
    '\\begin{center}',
    '\\begin{tikzpicture}[x=.32mm,y=.32mm]',
    '\\path[use as bounding box] (0,-2) rectangle (400,180);',
    ...figure.lines.map(segment=>line('draw=forest,line width=.6pt',segment)),
    ...(figure.arrows??[]).map(segment=>line('->,draw=forest,line width=.6pt',segment)),
    ...figure.labels.map(l=>'\\node[text=ink,font=\\sffamily\\footnotesize,anchor=base] at '+coord(l.x,l.y)+' {'+plain(l.text)+'};'),
    '\\end{tikzpicture}\\par',
    '\\small\\itshape '+tex(figure.caption),
    '\\end{center}'
  ].join('\n');
}

const samplePages = rows.map((q,i) => {
  const choices = q.options.map(option=>'\\item['+option.id+'.] '+tex(option.text)).join('\n');
  const answer = q.answer.kind==='choice'
    ? q.answer.id+'. '+q.options.find(o=>o.id===q.answer.id).text
    : q.answer.kind==='text' ? q.answer.accepted[0] : q.answer.exact+(q.answer.unit==='1'?'':' '+q.answer.unit);
  return [
    '% '+q.id+' · '+q.origin.sha256,
    '\\begin{samepage}',
    '\\noindent{\\sffamily\\large\\bfseries\\color{forest} '+tex(q.title)+'}\\par\\smallskip',
    para(q.prompt),
    q.figure?.stage==='prompt'?tikz(q.figure):'',
    choices?'\\begin{list}{}{\\setlength{\\leftmargin}{1.4em}\\setlength{\\itemsep}{.1em}\\setlength{\\parsep}{0pt}}\\small\n'+choices+'\n\\end{list}':'',
    '{\\small\\textbf{'+(q.hints.length===1?'Suggerimento':'Suggerimenti')+'.} '+q.hints.map(tex).join(' ')+'\\par}',
    '\\medskip\\noindent\\textbf{Risposta.} '+para(answer),
    q.figure?.stage==='solution'?tikz(q.figure):'',
    ...q.solution.map(para),
    '\\end{samepage}',
    i===rows.length-1?'':'\\newpage'
  ].join('\n');
});
const preamble = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=20mm,bottom=25mm]{geometry}
\usepackage{fontspec}
\usepackage{amsmath,amssymb,xcolor,tikz,fancyhdr}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{forest}{HTML}{265F51}
\definecolor{ink}{HTML}{172C25}
\color{ink}
\setlength{\parindent}{0pt}
\setlength{\parskip}{.38em}
\setlength{\emergencystretch}{2em}
\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\small Andrea Marro 3461653930 se serve chiedi!}
\renewcommand{\headrulewidth}{0pt}
\begin{document}
`;
writeFileSync(output,preamble+samplePages.join('\n')+'\n\\end{document}\n');
