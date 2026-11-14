import type {InkObject} from '@ardesia/contracts';
import type {Handout} from '@ardesia/lesson-os';
import {radius} from '../components/board-geometry';
import {texMath, texText} from './tex';

export function inkBounds(object: InkObject) {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of object.data.points){const r=radius(p,object.data.width);left=Math.min(left,p.x-r);top=Math.min(top,p.y-r);right=Math.max(right,p.x+r);bottom=Math.max(bottom,p.y+r);}
  return {left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}
const number=(value:number)=>String(Number(value.toFixed(6)));
/** Generated numbers and validated RGB only; raw user strings never enter TikZ syntax. */
export function inkTikz(object:InkObject):string {
  const b=inkBounds(object),scale=Math.min(14/b.width,6/b.height);
  const xy=(x:number,y:number)=>`(${number((x-b.left)*scale)},${number((y-b.top)*scale)})`;
  const parts=[`\\definecolor{ardesiaink}{HTML}{${object.data.color.slice(1)}}`, '\\begin{tikzpicture}[x=1cm,y=-1cm]'];
  for(let i=0;i<object.data.points.length;i++){
    const p=object.data.points[i]!,r=radius(p,object.data.width),q=object.data.points[i+1];
    parts.push(`\\path[fill=ardesiaink,draw=none] ${xy(p.x,p.y)} circle[radius=${number(r*scale)}cm];`);
    if(!q)continue;const length=Math.hypot(q.x-p.x,q.y-p.y);if(!length)continue;
    const dx=(q.y-p.y)/length,dy=(p.x-q.x)/length,s=radius(q,object.data.width);
    parts.push(`\\path[fill=ardesiaink,draw=none] ${xy(p.x+dx*r,p.y+dy*r)} -- ${xy(p.x-dx*r,p.y-dy*r)} -- ${xy(q.x-dx*s,q.y-dy*s)} -- ${xy(q.x+dx*s,q.y+dy*s)} -- cycle;`);
  }
  return parts.concat('\\end{tikzpicture}').join('\n');
}
// Breakable escaped data: no verbatim environment, raw URL or executable comments.
const data=(value:string)=>[...value].map(c=>texText(c)+'\\allowbreak{}').join('');
export function handoutLatex(handout:Handout):{source:string;warnings:string[]} {
  const {document,sources,missingSources}=handout,warnings:string[]=[];
  const lines=[
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[T1]{fontenc}', '\\usepackage[utf8]{inputenc}', '\\usepackage{lmodern}',
    '\\usepackage[margin=22mm]{geometry}', '\\usepackage{amsmath,amssymb,tikz,graphicx}', '\\newsavebox{\\ardesiamath}',
    '\\setlength{\\parindent}{0pt}', '\\setlength{\\parskip}{6pt}', '\\sloppy',
    '\\begin{document}', '{\\small ARDESIA / DISPENSA}',
    `\\section*{${texText(document.title)}}`,
    `Revisione ${document.revision} / ${document.status==='draft'?'DRAFT — non approvata':'Stato salvato: approved'}.`,
    `Lezione: \\texttt{${data(document.id)}}. Aggiornata: ${texText(document.updatedAt)}.`,
    'Esportazione statica in ordine di lettura. Le posizioni della lavagna non sono riprodotte; collegamenti e provenienza sono riportati in fondo. Bozze, modifiche in attesa, audio e lavoro personale degli studenti non sono inclusi. Formule troppo larghe vengono ridotte per entrare nella pagina.',
  ].map(line=>line.replace('DRAFT —','DRAFT ---'));
  for(const object of document.objects){
    lines.push(`\\subsection*{${texText(object.title)}}`);
    switch(object.type){
      case 'material':lines.push(texText(object.data.name),`Pagina ${object.data.page}/${object.data.pageCount}.`,texText(object.data.license),`SHA-256: ${data(object.data.sha256)}`);warnings.push('Materiale originale e annotazioni ancorate non incorporati: il riferimento esatto è conservato. Scarica il file originale dalla lezione.');break;
      case 'note':lines.push(object.data.text.split('\n').map(texText).join('\n\n'));break;
      case 'formula':{
        const math=texMath(object.data.latex);
        if(math===null){warnings.push(`Formula «${object.title}»: sorgente conservato come testo; sintassi LaTeX non supportata.`);lines.push('Formula conservata come sorgente testuale:',`\\texttt{${data(object.data.latex)}}`);}
        else lines.push(`\\sbox{\\ardesiamath}{$\\displaystyle ${math}$}`, '\\begin{center}', '\\ifdim\\wd\\ardesiamath>\\linewidth', '\\typeout{ARDESIA_MATH_SCALED}', '\\resizebox{\\linewidth}{!}{\\usebox{\\ardesiamath}}', '\\else\\usebox{\\ardesiamath}\\fi', '\\end{center}');
        lines.push(texText(object.data.description));break;
      }
      case 'ink':lines.push(inkTikz(object));break;
      case 'source':lines.push(`${texText(object.data.publisher)}. ${texText(object.data.locator)}.`,texText(object.data.sourceRevision),`\\texttt{${data(object.data.url)}}`,texText(object.data.license));break;
      case 'extension':lines.push(texText(object.data.definition.name),texText(object.data.definition.fallback),`Tipo: ${texText(object.data.definition.typeId)}, versione ${object.data.definition.version}.`,texText(object.data.definition.license),`Stato salvato: \\texttt{${data(JSON.stringify(object.data.state))}}`);warnings.push('Oggetto componibile esportato come descrizione e stato: grafici e interazioni non sono tradotti in TikZ.');break;
      case 'lab':lines.push('Laboratorio statico: nessuna simulazione viene eseguita.',`\\texttt{${data(object.data.pluginId+'@'+object.data.pluginVersion)}}`, `Stato salvato: \\texttt{${data(JSON.stringify(object.data.state))}}`);break;
    }
    lines.push(`{\\small Oggetto \\texttt{${data(object.id)}} / revisione ${object.revision} / ${texText(object.status)}.}`);
  }
  lines.push('\\section*{Fonti e provenienza}');
  if(missingSources.length){warnings.push(`${missingSources.length} revisioni di fonte non disponibili: i riferimenti esatti sono conservati.`);lines.push('Alcune revisioni di fonte non sono disponibili in questa copia; nessuna versione corrente le sostituisce.');}
  for(const object of document.objects){
    lines.push(`\\paragraph{${texText(object.title)}}`, `\\texttt{${data(object.id)}} / revisione ${object.revision}; ${texText(object.provenance.origin)}; autore ${texText(object.provenance.createdBy)}; ${texText(object.provenance.createdAt)}.`);
    if(object.type==='lab')lines.push(`Identita del laboratorio: \\texttt{${data(JSON.stringify({...object.data,state:undefined}))}}`);
    for(const ref of object.provenance.sources){
      const source=sources.find(s=>s.id===ref.sourceId&&s.revision===ref.revision);
      lines.push(`Fonte \\texttt{${data(ref.sourceId)}} / revisione ${ref.revision}: ${texText(ref.locator)}.`,source?`${texText(source.title)} / ${texText(source.status)}. ${texText(source.data.publisher)}; ${texText(source.data.sourceRevision)}; ${texText(source.data.locator)}. \\texttt{${data(source.data.url)}}. ${texText(source.data.license)}. Provenienza della fonte: \\texttt{${data(JSON.stringify(source.provenance))}}`:'Revisione non disponibile.');
    }
  }
  if(document.connections.length){lines.push('\\section*{Collegamenti}');for(const c of document.connections)lines.push(`\\texttt{${data(c.from)}} $\\rightarrow$ \\texttt{${data(c.to)}}: ${texText(c.label)}. Collegamento \\texttt{${data(c.id)}}.`);}
  lines.push('\\end{document}');
  if(lines.some(line=>line.includes('[U+')))warnings.push('Alcuni caratteri sono rappresentati con il loro codice Unicode nel sorgente LaTeX; la stampa dal browser conserva il testo originale.');
  return {source:lines.join('\n\n')+'\n',warnings};
}
