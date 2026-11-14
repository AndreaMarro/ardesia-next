# Cortex + Qwen locale: controprova di recupero

**Decisione: mantenere Cortex 0.2 senza modello nel percorso predefinito.** Il modello locale è stato eseguito realmente sul Mac M4, ma in questo esperimento non aumenta i file attesi recuperati e peggiora il loro ordinamento. Non è stato integrato nel prodotto. Nessuna patch generata o eseguita.

## Protocollo e risultato

Protocollo congelato alle **02:17:10 UTC del 14 novembre 2026**, SHA-256 `7374b2ea4b65d6adae3886666a75bf04a678d001f0f78443734542cca31ec7dd`. Esecuzione 02:18:28–02:20:45 UTC. Dieci descrizioni italiane di workflow reali implementati, scritte e associate a un punto d'ingresso rilevante prima di vedere le ricerche. Non sono dieci ticket storici risolti, un campione rappresentativo o una prova di generalizzazione.

Confronto: Cortex 0.2 con query originale; ricerca tramite massimo sei keyword inglesi proposte dal modello; riordino locale dell'unione dei candidati baseline/keyword. Due passaggi sugli stessi dieci casi, il secondo in ordine inverso senza modifiche. Tre misure baseline per caso. Il primo passaggio inizia dopo uno scaricamento esplicito del modello: solo la sua prima chiamata è realmente a freddo; le successive sono a modello caricato. La seconda ripetizione può beneficiare anche delle cache del servizio.

| Metodo | File atteso nei primi 4 | File atteso al primo posto | MRR@4 |
|---|---:|---:|---:|
| Cortex 0.2 | 4/10 | 3/10 | 0,333 |
| Espansione locale, con fallback baseline su output invalido | 3/10 | 2/10 | 0,233 |
| Unione e riordino locale, con fallback baseline su ranking invalido | 4/10 | 2/10 | 0,283 |

**Stessi risultati nei due passaggi.** Nessun nuovo caso recuperato dal riordino. Nessuna perdita di Hit@4 rispetto alla baseline, ma l'importazione corsi scende dalla prima alla seconda posizione. L'espansione perde il caso esportazione offline. Il confronto non viene presentato come «100% di accuratezza» nei soli casi dove il modello ha prodotto un output valido.

| Misura | Primo passaggio | Secondo passaggio |
|---|---:|---:|
| Mediana baseline, inclusa rilettura/hash del corpus | 1,555 s | 1,560 s |
| Mediana percorso completo baseline + espansione + riordino | 4,217 s | 2,827 s |
| Output espansione non conformi | 6/10 | 6/10 |
| Ranking non conformi | 3/10 | 3/10 |

La soglia fissata prima dell'esperimento richiedeva almeno due Hit@4 aggiuntivi, nessuna regressione, mediana entro tre secondi e nessun ranking invalido. **Non superata in entrambi i passaggi.** Anche superarla avrebbe giustificato solo una prova più ampia su casi non usati, non l'adozione automatica.

## Cosa è fallito

Il modello introduce spesso `typescript` e `react`, termini poco discriminanti, e in più casi supera il limite di sei keyword. «Registrazione» diventa `registration`, mentre il componente tratta registrazioni di lezione (`recordings`): un errore semantico rilevante. Una risposta di espansione termina per limite di generazione e non è JSON completo. Tre ranking non rispettano il contratto di restituire tutti gli ID una sola volta. Gli output invalidi vengono conservati e provocano il fallback, mai esecuzione o ricerca arbitraria.

Cinque file attesi sono assenti dall'intera unione dei candidati: un riordinatore non può recuperarli. Il file «prossimo passo» è presente in quinta posizione nella baseline, ma il ranking del modello è invalido e non migliora il recupero. Questo suggerisce che la prima debolezza da affrontare è la ricerca lessicale da richieste lunghe in italiano, non un modello più elaborato a valle di candidati insufficienti.

| Caso | Posizione baseline | Posizione dopo riordino |
|---|---:|---:|
| Importazione PDF | 3 | 3 |
| Recupero tratti dopo conflitto | assente | assente |
| Prossimo passo dello studente | 5 | 5, fallback |
| Turni e dimensione raster | assente | assente |
| Ripresa importazione corso | 1 | 2 |
| Validazione pacchetto Fisica | assente | assente |
| Economia tutor | 1 | 1 |
| Esportazione copia offline | 1 | 1 |
| Recupero registrazione | assente | assente |
| Anteprima Creator | assente | assente |

«Assente» significa assente dalla risposta limitata della ricerca, non dal repository. Il target è un file rilevante scelto manualmente: altri file restituiti potrebbero essere pertinenti e non ricevono credito da questa metrica. Un file trovato non dimostra che il frammento basti a scrivere una patch corretta.

## Ambiente, contesto e risorse

- Mac **Apple M4**, **16 GiB** di RAM, macOS 15.6 arm64, Python 3.15.2, Ollama **0.40.14**.
- Modello **qwen2.5-coder:1.5b**, GGUF **Q4_K_M**, digest `d7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668`; dimensione su disco dichiarata dall'API 986.062.089 byte. Licenza conservata nella directory superiore.
- Finestra configurata **8192 token**, temperatura 0, seed 41, massimo 180 token generati per chiamata. Massimo prompt di riordino osservato: **1892 token** secondo il contatore locale del servizio; non è un conteggio di token cloud risparmiati.
- Prima richiesta realmente a freddo: **1,245 s** di parete, dei quali **0,521 s** dichiarati dal servizio per caricamento. Le durate grezze di caricamento, prompt, generazione e cache sono nei risultati.
- Modello residente dichiarato da `/api/ps`: **1.367.049.502 byte**, interamente attribuiti a `size_vram` dal servizio; su memoria unificata questa voce non va sommata alla RAM come memoria separata. Campione RSS del processo runner: **1.767.040 KiB**. È un campione, non il picco del processo né l'incremento netto del sistema.
- Corpus ammesso: **680 file, 8.871.405 byte**. Copia isolata costruita soltanto dai file ammessi da Cortex, con verifica di ogni hash. Origine HEAD `5feb0a9781964b05bf594fa59e63579245e9abee`; manifest `6ffbdc51f6250e9b6e7028caeab57b3400d8f83aadff852a0451794e4d9fe2ca`. È una copia dei file di lavoro ammessi, non un'affermazione che il checkout fosse interamente pulito.
- Budget 8.000 byte e massimo otto frammenti per ricerca. Mediana evidenza baseline: 7.885,5 byte. Il riordinatore vede al massimo dodici percorsi distinti e 450 caratteri iniziali del primo frammento per percorso; nessun risultato inventato viene accettato.
- Processo condiviso con altre attività sul Mac: le latenze non sono un benchmark hardware isolato. Non sono stati misurati energia, risparmio monetario, token fatturati, velocità di sviluppo o riduzione dei difetti.

## Confini rispettati e passo sensato successivo

Il programma usa solo HTTP verso **127.0.0.1:11435**, disabilitando il proxy per queste richieste, e legge soltanto il corpus autorizzato dall'indice. Nessuna chiamata al cloud, messaggio esterno, rete verso altri host o esecuzione di output del modello. Il processo Ollama del coordinatore è rimasto avviato. A fine prova è stato inviato `keep_alive: 0`; la verifica successiva restituisce **`models: []`**, quindi il modello non è più residente.

Conservare la baseline e questo risultato negativo. Un eventuale nuovo lavoro dovrebbe confrontare prima una normalizzazione deterministica delle query lunghe e una ricerca per simboli/percorsi, su casi separati; questo esperimento non dimostra che tali interventi funzionino. Non cambiare i prompt sui dieci casi e chiamare il risultato successivo «generalizzazione».

Artefatti: `protocol.json`, `evaluate.py`, `environment.json`, `corpus-provenance.json`, `results.json`, `run.log`, `resources-*.json`, `unload.json`. Lo snapshot `corpus/` e i database sono intermedi privati ricostruibili: non vanno pubblicati o copiati indiscriminatamente nel repository del prodotto. I risultati contengono keyword e percorsi, non il testo integrale dei frammenti; i sorgenti rimangono nello snapshot locale.
