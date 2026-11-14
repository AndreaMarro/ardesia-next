import {canonicalJson,type InkObject} from '@ardesia/contracts';
import {planHandout, type Handout} from '@ardesia/lesson-os';
import {inkPlates,materialPlate,plateTikz,inkBounds} from './plates';
export {inkBounds} from './plates';
import {texMath, texText} from './tex';

// Breakable escaped data: no verbatim environment, raw URL or executable comments.
const data=(value:string)=>[...value].map(c=>texText(c)+'\\allowbreak{}').join('');
export function handoutLatex(handout:Handout,rasters:Record<string,string>={},additionalWarnings:string[]=[]):{source:string;warnings:string[]} {
  const {document,sources,missingSources}=handout,warnings:string[]=[...additionalWarnings];
  const lines=[
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[T1]{fontenc}', '\\usepackage[utf8]{inputenc}', '\\usepackage{lmodern}',
    '\\usepackage[margin=18mm]{geometry}', '\\usepackage{amsmath,amssymb,tikz,graphicx}', '\\newsavebox{\\ardesiamath}',
    '\\setlength{\\parindent}{0pt}', '\\setlength{\\parskip}{6pt}', '\\sloppy',
    '\\begin{document}', '{\\small ARDESIA / DISPENSA}',
    `\\section*{${texText(document.title)}}`,
    `Revisione ${document.revision} / ${document.status==='draft'?'DRAFT — non approvata':'Stato salvato: approved'}.`,
    `Lezione: \\texttt{${data(document.id)}}. Aggiornata: ${texText(document.updatedAt)}.`,
    'Esportazione statica in ordine spaziale, non una ricostruzione didattica. Scrittura e annotazioni conservano la loro geometria in tavole; collegamenti e provenienza sono riportati in fondo. Bozze, modifiche in attesa, audio e lavoro personale degli studenti non sono inclusi. Formule troppo larghe vengono ridotte per entrare nella pagina.',
  ].map(line=>line.replace('DRAFT —','DRAFT ---'));
  let outputBytes=lines.reduce((sum,line)=>sum+new TextEncoder().encode(line).length+2,0);
  const append=(...parts:string[])=>{for(const part of parts){outputBytes+=new TextEncoder().encode(part).length+2;if(outputBytes>64*1024*1024)throw Error('Il sorgente LaTeX supera 64 MiB. Nessun oggetto è stato omesso.');lines.push(part);}};
  for(const block of planHandout(handout).blocks){
    if(block.kind==='ink'){
      const ink=document.objects.filter((o):o is InkObject=>o.type==='ink'&&block.inkIds.includes(o.id));
      const plates=inkPlates(ink);
      for(const [index,plate] of plates.entries())append('\\begin{minipage}{\\linewidth}','\\subsection*{Scrittura / tavola '+(index+1)+' di '+plates.length+'}',plateTikz(plate),'\\end{minipage}');
      continue;
    }
    const object=document.objects.find(o=>o.id===block.objectId)!;
    if(object.type==='material')append('\\begin{minipage}{\\linewidth}');
    append(`\\subsection*{${texText(object.title)}}`);
    switch(object.type){
      case 'material':{
        const path=rasters[object.id];
        if(path)append(plateTikz(materialPlate(object,document.objects.filter((o):o is InkObject=>o.type==='ink'&&block.inkIds.includes(o.id))),path));
        else warnings.push('Materiale originale e annotazioni non incorporati in questo sorgente solo testo: prepara il pacchetto completo.');
        append('\\end{minipage}',texText(object.data.name),`Pagina ${object.data.page}/${object.data.pageCount}.`,texText(object.data.license),`SHA-256: ${data(object.data.sha256)}`);
        break;
      }
      case 'note':append(object.data.text.split('\n').map(texText).join('\n\n'));break;
      case 'formula':{
        const math=texMath(object.data.latex);
        if(math===null){warnings.push(`Formula «${object.title}»: sorgente conservato come testo; sintassi LaTeX non supportata.`);append('Formula conservata come sorgente testuale:',`\\texttt{${data(object.data.latex)}}`);}
        else append(`\\sbox{\\ardesiamath}{$\\displaystyle ${math}$}`, '\\begin{center}', '\\ifdim\\wd\\ardesiamath>\\linewidth', '\\typeout{ARDESIA_MATH_SCALED}', '\\resizebox{\\linewidth}{!}{\\usebox{\\ardesiamath}}', '\\else\\usebox{\\ardesiamath}\\fi', '\\end{center}');
        append(texText(object.data.description));break;
      }
      case 'ink':for(const plate of inkPlates([object]))append(plateTikz(plate));break;
      case 'source':append(`${texText(object.data.publisher)}. ${texText(object.data.locator)}.`,texText(object.data.sourceRevision),`\\texttt{${data(object.data.url)}}`,texText(object.data.license));break;
      case 'extension':append(texText(object.data.definition.name),texText(object.data.definition.fallback),`Tipo: ${texText(object.data.definition.typeId)}, versione ${object.data.definition.version}.`,texText(object.data.definition.license),`Stato salvato: \\texttt{${data(canonicalJson(object.data.state))}}`);warnings.push('Oggetto componibile esportato come descrizione e stato: grafici e interazioni non sono tradotti in TikZ.');break;
      case 'lab':append('Laboratorio statico: nessuna simulazione viene eseguita.',`\\texttt{${data(object.data.pluginId+'@'+object.data.pluginVersion)}}`, `Stato salvato: \\texttt{${data(canonicalJson(object.data.state))}}`);break;
    }
    append(`{\\small Oggetto \\texttt{${data(object.id)}} / revisione ${object.revision} / ${texText(object.status)}.}`);
  }
  append('\\section*{Fonti e provenienza}');
  if(missingSources.length){warnings.push(`${missingSources.length} revisioni di fonte non disponibili: i riferimenti esatti sono conservati.`);append('Alcune revisioni di fonte non sono disponibili in questa copia; nessuna versione corrente le sostituisce.');}
  for(const object of document.objects){
    append(`\\paragraph{${texText(object.title)}}`, `\\texttt{${data(object.id)}} / revisione ${object.revision}; ${texText(object.provenance.origin)}; autore ${texText(object.provenance.createdBy)}; ${texText(object.provenance.createdAt)}.`);
    if(object.type==='lab')append(`Identita del laboratorio: \\texttt{${data(canonicalJson({...object.data,state:undefined}))}}`);
    for(const ref of object.provenance.sources){
      const source=sources.find(s=>s.id===ref.sourceId&&s.revision===ref.revision);
      append(`Fonte \\texttt{${data(ref.sourceId)}} / revisione ${ref.revision}: ${texText(ref.locator)}.`,source?`${texText(source.title)} / ${texText(source.status)}. ${texText(source.data.publisher)}; ${texText(source.data.sourceRevision)}; ${texText(source.data.locator)}. \\texttt{${data(source.data.url)}}. ${texText(source.data.license)}. Provenienza della fonte: \\texttt{${data(canonicalJson(source.provenance))}}`:'Revisione non disponibile.');
    }
  }
  if(document.connections.length){append('\\section*{Collegamenti}');for(const c of document.connections)append(`\\texttt{${data(c.from)}} $\\rightarrow$ \\texttt{${data(c.to)}}: ${texText(c.label)}. Collegamento \\texttt{${data(c.id)}}.`);}
  if(lines.some(line=>line.includes('[U+')))warnings.push('Alcuni caratteri sono rappresentati con il loro codice Unicode nel sorgente LaTeX; la stampa dal browser conserva il testo originale.');
  if(warnings.length)append('\\section*{Conversioni e limiti}',...warnings.map(texText));
  append('\\end{document}');
  return {source:lines.join('\n\n')+'\n',warnings};
}
