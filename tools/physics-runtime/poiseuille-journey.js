/* Guided interaction around the existing Poiseuille demo, with explicit edition-bound files. */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const source=JSON.parse(byId('journey-data').textContent);
 const radius=byId('radius'), notes=byId('journey-notes'), transfer=byId('transfer-answer');
 const values=['half','quarter','sixteenth'];
 let attempts=[],checkedTransfer=false,revision=0,importGeneration=0;
 const selected=name=>document.querySelector(`input[name="${name}"]:checked`)?.value??null;
 const status=message=>{byId('save-status').textContent=message;};
 const changed=()=>{revision++;status('Modifiche solo in questa pagina. Scarica di nuovo il file per conservarle.');};
 const recovery={A:'recupero-media',B:'recupero-media',C:'recupero-profilo',D:'recupero-unita',E:'nuova-applicazione'};
 function prediction(){
  const answer=selected('prediction');
  byId('prediction-feedback').textContent=!answer?'Scegli, poi porta il raggio a 0,50 nel laboratorio. La previsione resta visibile per il confronto.':Number(radius.value)!==0.5?'Previsione scelta. Porta il raggio a 0,50 per confrontarla con la misura.':answer==='sixteenth'?'La misura conferma la previsione: Q/Q₀ = (0,50)⁴ = 0,0625, cioè 1/16. Pressione, viscosità e lunghezza sono rimaste fisse.':answer==='quarter'?'Hai considerato soltanto l’area, che diventa 1/4. Anche la velocità media diventa 1/4: la portata diventa (1/4)·(1/4) = 1/16.':'La portata non è proporzionale al raggio: dimezzandolo, area e velocità media diventano entrambe 1/4. Il loro prodotto vale 1/16.';
 }
 function feedback(){
  const target=byId('quiz-feedback');target.replaceChildren();
  const choice=source.quiz.choices.find(c=>c.id===attempts.at(-1));
  const p=document.createElement('p');
  p.textContent=choice?(choice.id===source.quiz.correctChoice?'Il ragionamento è coerente. ':'Un passaggio da rivedere. ')+choice.feedback:'Scegli un’alternativa e confronta il ragionamento quando sei pronto.';target.append(p);
  if(choice){const a=document.createElement('a');a.href='#'+recovery[choice.id];a.textContent=choice.id===source.quiz.correctChoice?'Applica a un problema diverso →':'Riprendi questo passaggio →';target.append(a);}
  byId('attempt-note').textContent=attempts.length?`${attempts.length} confronti sullo stesso quesito · ultima alternativa confrontata: ${attempts.at(-1)}. Non sono prove indipendenti di apprendimento.`:'Nessun tentativo ancora confrontato.';
 }
 function checkTransfer(){
  const text=transfer.value.trim().replace(',','.');
  const number=/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)?Number(text):NaN;
  byId('transfer-feedback').textContent=!Number.isFinite(number)||number<=0?'Scrivi un tempo positivo in secondi, usando solo il numero.':Math.abs(number-40)<=0.05?'Il tempo è coerente: 40,0 s. Il liquido ignoto ha viscosità doppia; alla stessa pressione la sua portata è metà del riferimento. Confronta anche i passaggi, non soltanto il numero.':'Il risultato da ricostruire è 40,0 s. Parti dalle portate volume/tempo e dal rapporto Q ∝ Δp/η: η ignota = 2,40 mPa·s; poi Q = 0,0750 mL/s. Apri il controllo qui sotto.';
 }
 function snapshot(){return {prediction:selected('prediction'),radius:Number(radius.value),quiz:selected('quiz'),attempts:[...attempts],transfer:transfer.value,checkedTransfer,notes:notes.value};}
 function valid(value){
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!=='attempts,checkedTransfer,notes,prediction,quiz,radius,transfer')return false;
  return (value.prediction===null||values.includes(value.prediction))&&Number.isFinite(value.radius)&&value.radius>=0.5&&value.radius<=1.5&&Math.abs(value.radius*20-Math.round(value.radius*20))<1e-8&&(value.quiz===null||typeof value.quiz==='string'&&/^[A-E]$/.test(value.quiz))&&Array.isArray(value.attempts)&&value.attempts.length<=30&&value.attempts.every(v=>typeof v==='string'&&/^[A-E]$/.test(v))&&typeof value.checkedTransfer==='boolean'&&typeof value.transfer==='string'&&value.transfer.length<=80&&typeof value.notes==='string'&&value.notes.length<=1600;
 }
 for(const id of ['prediction-controls','quiz-controls','transfer-answer','check-transfer','journey-notes','save-journey','resume-journey'])byId(id).disabled=false;
 document.querySelectorAll('input[name=prediction]').forEach(input=>input.addEventListener('change',()=>{prediction();changed();}));
 radius.addEventListener('input',()=>{prediction();changed();});
 document.querySelectorAll('input[name=quiz]').forEach(input=>input.addEventListener('change',()=>{feedback();changed();}));
 byId('check-quiz').addEventListener('click',()=>{
  const choice=selected('quiz');if(!choice){byId('quiz-feedback').textContent='Scegli un’alternativa prima del confronto.';return;}
  if(attempts.length>=30){byId('quiz-feedback').textContent='Hai già conservato 30 confronti sullo stesso quesito. Passa alla nuova applicazione; i confronti precedenti restano nel file.';return;}
  attempts.push(choice);feedback();changed();
 });
 transfer.addEventListener('input',()=>{checkedTransfer=false;byId('transfer-feedback').textContent='Risposta modificata: confrontala quando sei pronto.';changed();});
 byId('check-transfer').addEventListener('click',()=>{checkedTransfer=true;checkTransfer();changed();});
 notes.addEventListener('input',changed);
 byId('save-journey').addEventListener('click',()=>{
  const work={format:'ardesia-guided-lesson/1',edition:source.edition,unitId:source.unitId,study:snapshot()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(work,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='ardesia-poiseuille-lavoro.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('File preparato per il download. Conservalo sul dispositivo; le modifiche successive richiedono un nuovo download.');
 });
 byId('resume-journey').addEventListener('change',async event=>{
  const generation=++importGeneration,atRevision=revision,file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
   if(file.size>16384)throw Error('size');
   const work=JSON.parse(await file.text());
   if(generation!==importGeneration)return;
   if(revision!==atRevision){status('Hai modificato il lavoro durante la lettura del file. Nessuna modifica sovrascritta: riapri il file quando sei pronto.');return;}
   if(!work||work.format!=='ardesia-guided-lesson/1'||work.edition!==source.edition||work.unitId!==source.unitId||!valid(work.study))throw Error('format');
   const s=work.study;
   for(const name of ['prediction','quiz'])document.querySelectorAll(`input[name=${name}]`).forEach(input=>{input.checked=input.value===s[name];});
   radius.value=String(s.radius);radius.dispatchEvent(new Event('input',{bubbles:true}));
   attempts=[...s.attempts];checkedTransfer=s.checkedTransfer;transfer.value=s.transfer;notes.value=s.notes;prediction();feedback();
   if(checkedTransfer)checkTransfer();else byId('transfer-feedback').textContent='Risposta ripresa, ancora da confrontare.';
   revision++;status('Lavoro riaperto dalla stessa edizione: parametri, risposte, confronti e note ripristinati.');
  }catch{if(generation===importGeneration)status('File non compatibile o danneggiato. Occorre un file di questa edizione, entro 16 KiB. Il lavoro presente è conservato.');}
 });
})();
