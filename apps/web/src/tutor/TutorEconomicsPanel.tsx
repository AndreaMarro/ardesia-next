import {projectTutorEconomics} from '@ardesia/lesson-os';
import type {TutorRecord} from '@ardesia/contracts';
import {money} from './values';

export function TutorEconomicsPanel({records}:{records:readonly TutorRecord[]}){
  let result:ReturnType<typeof projectTutorEconomics>;
  try{result=projectTutorEconomics(records);}catch{return <p role="alert">Le schede disponibili non bastano per ricostruire i risultati economici. Aggiorna lo studio.</p>;}
  if(!result.currencies.length)return null;
  return <section className="tutor-economics" aria-label="Risultati economici"><h3>Il lavoro, oltre gli incassi.</h3>
    <p className="tutor-lead">Ricavi delle lezioni svolte e quote dei pacchetti consumate con la presenza. Costi e preparazione già sostenuti contano anche per appuntamenti programmati o annullati.</p>
    {result.currencies.map(value=><article key={value.currency} aria-label={`Risultato economico ${value.currency}`}><h4>{value.currency}</h4>
      <div className="tutor-economics-grid"><div><span>Ricavi maturati</span><strong>{money(value.earnedMinor,value.currency)}</strong></div><div><span>Costi diretti</span><strong>{money(value.directCostMinor,value.currency)}</strong></div><div><span>Margine operativo</span><strong>{money(value.operatingMarginMinor,value.currency)}</strong></div></div>
      <p className="hint">{money(value.singleEarnedMinor,value.currency)} da compensi singoli · {money(value.packageEarnedMinor,value.currency)} da quote pacchetto. Valore pacchetti ancora da svolgere: {money(value.remainingPackageValueMinor,value.currency)}.</p>
      <div className="tutor-economics-grid"><div><span>Tempo lavorato</span><strong>{value.workMinutes}<small>min · {value.teachingMinutes} lezione + {value.preparationMinutes} preparazione</small></strong></div><div><span>Ricavo / ora lavorata</span><strong>{value.earnedPerHourMinor===null?'—':money(value.earnedPerHourMinor,value.currency)}</strong></div><div><span>Margine / ora lavorata</span><strong>{value.operatingMarginPerHourMinor===null?'—':money(value.operatingMarginPerHourMinor,value.currency)}</strong></div></div>
      {(value.unenteredCostCount>0||value.unenteredPreparationCount>0)&&<p className="hint">Calcolo parziale: {value.unenteredCostCount} appuntamenti senza costi indicati e {value.unenteredPreparationCount} senza preparazione indicata. I campi vuoti valgono zero nel calcolo.</p>}
    </article>)}
    <details><summary>Come sono calcolati</summary><p>I compensi singoli includono le assenze addebitate in appuntamenti svolti. Addebiti per annullamenti e lezioni ancora programmate non sono ricavi di lezioni svolte. Il prezzo di un pacchetto matura in proporzione ai minuti consumati, con arrotondamento cumulativo alla più piccola unità della valuta. Il tempo di una lezione di gruppo è contato una sola volta.</p><p>Il margine sottrae solo i costi diretti registrati. Non comprende imposte, contributi o costi generali e non è un risultato fiscale. Gli incassi annotati restano separati. Ogni valuta conserva il proprio conto; nessuna conversione automatica. I risultati si ricostruiscono dalle revisioni correnti delle schede.</p></details>
  </section>;
}
