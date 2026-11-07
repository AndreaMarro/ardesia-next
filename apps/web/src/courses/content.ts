import type {CourseInput} from '@ardesia/contracts';
export const phaseLabels = {prediction: 'Prima di iniziare', activity: 'Metti alla prova', transfer: 'In un altro contesto'} as const;
export const helpLabels = {explanation: 'Il modello', referenceFeedback: 'Confronta il ragionamento', recovery: 'Riparti da qui'} as const;
export function blankUnit(): CourseInput['units'][number] {
  return {id: crypto.randomUUID(), title: 'Nuova unità', objective: '', prerequisites: '', explanation: '', prediction: '', activity: '',
    referenceFeedback: '', recovery: '', transfer: '', sources: [], lesson: null};
}
/** Original draft, adapted from the legacy learning structure, not a reproduction of a textbook. */
export function springCourse(): CourseInput {
  return {title: 'Una molla, un modello, una scelta', description: 'Dalle forze in equilibrio a una scelta motivata. Un piccolo percorso per leggere le misure e riconoscere i limiti di un modello.', license: 'Tutti i diritti riservati · testi originali Ardesia, bozza AI', units: [{
    ...blankUnit(), sources: [{title: 'OpenStax · College Physics 2e · §16.1', url: 'https://openstax.org/books/college-physics-2e/pages/16-1-hookes-law-stress-and-strain-revisited', revision: '2e, §16.1 · riferimento verificato il 7 novembre 2026', license: 'Collegamento bibliografico; nessun testo o figura riprodotti'}], title: 'Quanto si allunga una molla?',
    objective: 'Usare la legge di Hooke in equilibrio, controllare le unità e decidere quando i dati non giustificano il modello lineare.',
    prerequisites: 'Distinguere forza (N), allungamento rispetto alla lunghezza a riposo (m) e rigidità (N/m). Saper dividere e convertire centimetri in metri: 1 cm = 0,01 m.',
    explanation: 'Consideriamo una molla ideale tirata lentamente lungo il suo asse, senza attrito. In equilibrio la forza applicata F bilancia la forza elastica, opposta allo spostamento: F − kx = 0. Quindi x = F/k, con k positivo. Qui F e x indicano moduli. La legge elastica vale entro il regime lineare; non descrive la rottura o le deformazioni permanenti. La relazione x = F/k richiede equilibrio: durante un’oscillazione la legge elastica resta utilizzabile, ma la forza applicata non bilancia necessariamente quella elastica.\n\nEsempio: F = 2 N e k = 100 N/m danno x = 0,02 m, cioè 2 cm. Le unità si semplificano: N ÷ (N/m) = m. A forza fissata, una rigidità maggiore produce un allungamento minore. A forza nulla, il modello restituisce x = 0. Su un grafico F in funzione di x la pendenza è k.',
    prediction: 'Due molle hanno rigidità k e 2k. Applica lentamente la stessa forza, mantenendo ciascuna molla in equilibrio. Quale si allunga di più? Prevedi il rapporto tra gli allungamenti e spiega perché, prima di fare i conti.',
    activity: 'Una molla ideale con k = 150 N/m è sottoposta a F = 3 N. Calcola l’allungamento in metri e centimetri. Ripeti con k = 300 N/m, mantenendo F = 3 N. Scrivi il controllo delle unità e verifica la tua previsione sul rapporto degli allungamenti.',
    referenceFeedback: 'La molla con rigidità k si allunga il doppio di quella con rigidità 2k, a parità di forza. Nell’attività: x = 3/150 m = 0,02 m = 2 cm. Con k = 300 N/m ottieni 0,01 m = 1 cm: metà allungamento. La divisione restituisce una lunghezza. Un risultato numerico da solo non mostra se hai controllato equilibrio, unità e regime lineare: esplicita anche queste condizioni.',
    recovery: 'Se hai moltiplicato F per k, controlla le dimensioni: N × N/m non è una lunghezza. Isola x nell’equazione F = kx. Se hai ottenuto 200 cm, ricorda che 1 m = 100 cm. Riparti dall’esempio con F = 2 N, poi torna ai tuoi 3 N. Puoi salvare una nuova risposta: la prima resta nel percorso.',
    transfer: 'Devi scegliere una molla per uno strumento con corsa massima 3 cm e carico 5 N. Misuri A: 2 N → 1 cm, 4 N → 2 cm; B: 2 N → 1,5 cm, 4 N → 5 cm. Misuri x dalla lunghezza a forza nulla e, per questo confronto, trascuri l’incertezza delle misure. Quale candidata è compatibile con F = kx sui dati? Stima se A rispetterebbe la corsa, indica l’ipotesi necessaria e proponi una misura ulteriore prima di usarla. Due punti non provano la linearità in tutto l’intervallo.',
  }]};
}
