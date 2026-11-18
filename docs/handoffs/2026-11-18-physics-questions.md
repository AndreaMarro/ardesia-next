# Revisione dei quesiti di Fisica

18 novembre 2026, ore 16:35 CET (Europe/Rome). Mandato diretto del titolare per la revisione scientifica e didattica della banca. Repository \`AndreaMarro/ardesia-next\`, branch \`codex/physics-question-review-20261118\`, basata sulla revisione verificata \`5a844fc\` della PR58. Il riferimento GitHub alla revisione finale, la CI e il deploy accompagnano la consegna. La PR59, dedicata al catalogo delle offerte, è un lavoro parallelo.

## Stato della banca

L’analisi del commit \`5cfbdcb055ba3ba136f97fb56e997f06e6cf3605\` ha verificato la corrispondenza Git dei file, gli hash del manifesto e lo schema di 4.000 record in 27 file. Ci sono 4.000 ID univoci, 2.537 quesiti a scelta e 1.463 completamenti. I livelli base, facile, medio e difficile contano ciascuno 1.000 record. Non sono emerse chiavi duplicate, violazioni dello schema o incoerenze tra unità dello shard e tassonomia.

Le due frasi standard sui simboli e sul controllo del risultato ricorrono entrambe in 3.864 soluzioni. Tutti i primi suggerimenti sono identici. Ho trovato 591 formulazioni con l’unità «1» e nessun campo esplicito per figure nei record. Le 1.220 differenze testuali tra l’alternativa designata e la risposta includono unità aggiunte e forme equivalenti come \`100000 m\` e \`10⁵ m\`. Sono segnalazioni da interpretare, non 1.220 errori scientifici. Le chiavi esistono in tutte le domande a scelta. Il confronto normalizzato dei testi e delle firme non ha trovato duplicati esatti. La vicinanza semantica richiede una lettura per famiglie.

Le 32.727 formule dei passaggi legacy sono in notazione testuale. Non c’è una convenzione TeX da applicare indiscriminatamente. Il render KaTeX con controllo degli errori è stato applicato alle formule riscritte. Il campione precedente di 688 record, con 658 casi dichiarati, non è riproducibile esattamente senza l’elenco degli ID. L’audit corrente conferma il fenomeno sullo snapshot integrale, a un perimetro diverso. [Dati dell’audit e metodo](../sources/physics-2026-27/question-review/README.md).

## Cosa è cambiato

Il primo lotto conta 40 quesiti, due per livello in ciascuno dei cinque percorsi. Due record mancavano nella selezione Next al livello facile richiesto e sono stati recuperati dallo snapshot. Il secondo lotto aggiunge dodici esercizi già attivi per affrontare altri punti deboli. Ho conservato chiavi e valori attesi, chiarito ipotesi e incognite e modificato i distrattori che non aiutavano a riconoscere un errore. Le motivazioni e le controprove si leggono accanto al singolo record nell’area editoriale.

| Quesito | Prima | Dopo |
| --- | --- | --- |
| \`u1-area-conversion-01\` | Chiedeva un valore «in 1» dopo un blocco di ipotesi generiche. | Una griglia mostra otto celle e distingue superficie fisica e unità di misura. |
| \`u2-mean-velocity-03\` | Regola di velocità media immersa in spiegazioni standard. | Andata e ritorno si vedono nello schema. La soluzione separa spostamento netto e distanza totale. |
| \`u3-bernoulli-height-speed-09\` | Il testo nominava la pressione come incognita, poi chiedeva la quota. | Quota, pressione disponibile e condizioni di validità sono dichiarate. |
| \`u5-isobaric-work-06\` | La traccia passava dalla richiesta di lavoro alla variazione di volume. | Il lavoro è un dato. L’area nel grafico p–V guida verso l’aumento di 3 L. |
| \`u6-connected-plate-separation-charge-13\` | Tensione costante e cariche iniziali diverse apparivano come dati di un’unica prova. | Due prove distinte chiariscono il vincolo. La carica varia in ciascuna prova a tensione fissata e il rapporto richiesto vale 3/2. |
| \`u7-snell-refracted-sine-06\` | Calcolo immerso nelle convenzioni ripetute. | Le due facce e le normali rendono verificabile perché il seno emergente torna 3/5. |
| \`u7-radioactive-survivors-16\` | Soluzione con passaggi standard attorno al calcolo esponenziale. | Due dimezzamenti tra le misure portano a un’emivita di un’ora. Il grafico ricostruisce 96, 48, 24 e 12 milioni. |

Dalla lezione lo studente può provare una scelta o un numero, leggere un feedback, aprire un indizio e consultare lo svolgimento senza espandere ogni passaggio. I due collegamenti sperimentali riguardano interferenza e campo elettrico, con una previsione e un confronto da fare nel laboratorio. I disegni distinguono i grafici in scala dagli schemi qualitativi e hanno una descrizione testuale. Il PDF usa gli stessi testi e figure e non contiene titolo generale o metadati d’autore. Il footer richiesto è presente su tutte le pagine.

## Copertura e prove

| Misura | Conteggio |
| --- | ---: |
| Esistenti e sottoposti a controlli automatici | 4.000 |
| ID legacy già raggiungibili nelle edizioni Next riservate | 259, in 290 posizioni |
| ID legacy complessivamente raggiungibili includendo le nuove lezioni | 261 |
| Revisioni scientifiche AI e riscritture individuali | 52 su 4.000 |
| Quesiti guidati fruibili nelle lezioni e verificati nell’interfaccia | 52 in 29 lezioni |
| Quesiti con rappresentazione originale | 27 |
| Quesiti nel PDF campione | 10 |

Le etichette delle figure e le formule sono state corrette dopo le prove di impaginazione. Il test ha aperto tutti i 52 quesiti con feedback e soluzione su desktop, smartphone da 360 px, iPad verticale e iPad orizzontale emulati, senza errori JavaScript o formule fuori dalla propria area. La revisione indipendente ha provato risposte corrette ed errate e l’uso da tastiera senza JavaScript. Queste prove non coprono un iPad fisico o uno screen reader. Le attività e le edizioni archiviate in Core conservano i propri progressi. Il feedback guidato della pagina è transitorio. [Ricevute e schermate](../sources/physics-2026-27/question-review/evidence) · [PDF](../sources/physics-2026-27/question-review/sample/Quesiti-campione-Ardesia.pdf) · [Sorgente TeX](../sources/physics-2026-27/question-review/sample/Quesiti-campione-Ardesia.tex).

## Qualità e copertura restante

Nel perimetro consultato erano disponibili specifiche e misure dello stile, senza esemplari delle dispense originali di Andrea. Il confronto si basa quindi sul mandato: spiegazioni proporzionate alla domanda, condizioni che giustificano il modello, notazione leggibile, calcoli verificabili e figure legate al passaggio che chiariscono. Lo studente può, per esempio, distinguere l’angolo interno dal raggio emergente invece di memorizzare una sostituzione in Snell. Restano 3.948 quesiti legacy senza revisione individuale di questo tipo, oltre alla revisione scientifica umana. Il prossimo lotto può partire dai 209 ID già attivi in Next e non ancora riscritti, dando priorità ai casi con riferimento ambiguo o distrattori incoerenti. La pipeline e il catalogo accettano un nuovo file di lotto tracciato, con verifica di chiave, mapping, KaTeX e rappresentazione.
