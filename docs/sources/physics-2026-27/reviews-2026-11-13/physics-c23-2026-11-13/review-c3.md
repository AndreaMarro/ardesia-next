# Revisione scientifica indipendente C3 — 13 novembre 2026

Esito sul candidato finale: nessun difetto scientifico P1/P2 concreto rimasto aperto nei 15 problemi esaminati. Si tratta di revisione di un agente distinto dall’autore C3, non di approvazione scientifica umana. Contenuti DRAFT, humanApproval=false.

## Perimetro e identificazione

- Problemi: `/tmp/ardesia-c23-c3/problems.json`, SHA-256 `d7378d34a778af556ae0d96b4d6b98c047f68a95f6db3f60f243342e095f2e97`.
- Controlli autore: `/tmp/ardesia-c23-c3/checks.json`, SHA-256 `94707bdc30235098f660a68adb0df757aa7154f7efebb401b1629cb6c3571d23`.
- Letti integralmente prompt, soluzioni, ipotesi, diagnosi d’errore e note di originalità di tutti i 15 problemi U5-01…05, confrontandoli con cinque problemi originali precedenti, 31 verifiche finali e il mapping editoriale degli obiettivi.
- Fonte condivisa confrontata con i candidati congelati: i 15 oggetti C3 corrispondono esattamente; il corpus complessivo contiene 69 originali, preservando tutti i 39 oggetti della base dc2985e e aggiungendo i 30 oggetti C2/C3.

## Controlli eseguiti e risultati

Tutti i 74 controlli aritmetici forniti dall’autore sono stati rieseguiti mediante interprete AST numerico limitato. Inoltre sono stati rifatti calcoli fisici distinti per ogni problema: condizioni di equilibrio del pistone, moli conservate, offset di pressione, capacità del recipiente sottratta da quella totale, distinzione Cv/Cp, bilancio con condensazione, conduttanze parallele, perdita radiativa e convettiva, inversione a due temperature, convenzione sul lavoro, due percorsi con gli stessi estremi, adiabatica, COP, conteggio esplicito dei 16 microstati e integrazione entropica dei corpi finiti. Il JSON associato registra i risultati e le espressioni; lo script è `/tmp/ardesia-c23-review-c3.py`.

Riscontri rappresentativi:

| Problema | Ricalcolo indipendente | Osservazione scientifica |
|---|---|---|
| U5-01-a | p=110 kPa, V≈9,065 L | Pressione assoluta, peso sul pistone e conversione kelvin coerenti. |
| U5-01-b | pf=(240·3+60·6)/9=120 kPa | Conservazione delle moli nel sistema complessivo; media pesata, non aritmetica. |
| U5-01-c | offset=20 kPa, pV=240 J | Tre dati compatibili con il modello: non dimostrano da soli la causa dell’offset. |
| U5-02-a | Ccampione=(900−360)/3=180 J/K; c=900 J/(kg K) | La capacità del recipiente non viene attribuita al campione. |
| U5-02-b | ΔTV≈48,135 K; ΔTp≈28,881 K; Wp=120 J | Il calore uguale non impone uguale aumento di temperatura. |
| U5-02-c | Tf=36040/504≈71,508 °C | Tutto il vapore condensa. Calore latente e successivo raffreddamento entrano entrambi; modello a pressione costante dichiarato. |
| U5-03-a | Gtot=2 W/K; P=20 W; Q60s=1200 J | Due vie in parallelo. |
| U5-03-b | Piniziale=19,9225 W; dT/dt≈−0,0996125 K/s | È una tangente iniziale; la perdita diminuisce raffreddandosi. |
| U5-03-c | ε=0,5; G=0,05 W/K; P350K=6,41584375 W | Emissività riferita alla superficie del corpo; vuoto non elimina conduzione nei sostegni o radiazione. |
| U5-04-a | Wgas=−80 J; ΔU=80 J; Tf=288 K | Rigidità esclude il lavoro di volume, non quello d’albero. |
| U5-04-b | Wirr=200 J; Wrev=300 ln3≈329,584 J | Temperatura iniziale e finale uguale non implica isoterma dell’intero processo irreversibile. |
| U5-04-c | TB=1200 K; ΔUAB=1121,85 J; volume finale diverso | Ritorno alla temperatura iniziale non significa ciclo. |
| U5-05-a | Qcaldo=300 J; COP=4 | COP e rendimento di motore sono rapporti differenti; nessuna fattibilità termica dedotta senza temperature. |
| U5-05-b | Ω2=6, Ω4=1; ΔS=kB ln6≈2,474·10⁻²³ J/K | Conteggio enumerato; ipotesi di equiprobabilità e modello finito dichiarati. |
| U5-05-c | Tf=350 K; ΔStot≈6,940945 J/K | Corpi finiti: uso di C ln(Tf/Ti), non Q/Tf per tutto il processo. |

## Mapping e originalità

Il rilievo iniziale sul mapping di U5-05-b è risolto nella revisione finale confermata dall’autore: ora objectiveIds contiene soltanto U5-05.07. Il conteggio statico non verifica direttamente irreversibilità (.02) e direzione dinamica dei processi (.08); tali riferimenti sono stati rimossi. Altri nuovi problemi trattano direttamente .02/.08. I 15 problemi hanno riferimenti a 29 obiettivi distinti: questo è un conteggio di collegamenti didattici, non una prova di copertura esaustiva o padronanza.

I tre livelli per unità introducono ragionamenti diversi: calibrazione, vincoli termodinamici, scelta dei confini, inferenza di parametri e limiti del modello, non soltanto sostituzioni numeriche. Il confronto non rileva prompt completi copiati dalle verifiche finali o prompt identici agli originali precedenti. La verifica testuale non dimostra indipendenza semantica assoluta né validità psicometrica; alcune leggi fondamentali sono necessariamente condivise.

## Integrazione e demo

Riletti i tre piccoli aggiornamenti del feedback preesistente: `V_f/V_i=2 (adimensionale)`, `T_f≈33,33 °C`, `η_C=0,40=40%` sono correzioni di rappresentazione coerenti con le rispettive soluzioni. Il nuovo feedback del laboratorio a 30/40/60% restituisce correttamente ΔStot=0,3/0/−0,6 J/K.

Il builder usa ora gli id espliciti `original-20261113-u3-04-b` e `original-20261113-u5-02-a`, insieme alle lezioni corrette U3-04 e U5-02. Le pagine generate mostrano rispettivamente «Misurare una viscosità con due raccolte» e «Prima si misura il recipiente, poi il campione». Manifest e HTML coincidono con questa selezione. La CTA di indice «sulla viscosità» corrisponde al nuovo problema; non promette più una rete di tubi. Il delta non modifica escaping, invio dei contatti o dichiarazioni commerciali. Le soluzioni rimangono in dettagli apribili esplicitamente.

Hash builder: `2ec21f050a0f354ddcb27521cbe6f4ee360e5034b2c9b0ad1b305faf4cfe0cf9`.
Hash HTML C2: `f6c992c347c545dfbb9a383f33c56ec649cefddb0a6503ed35e1c591d1ce3439`.
Hash HTML C3: `a98a4b971e332ebc418dd67ae8d3cc4476f505a3fc2ef84b16f5ea0a1abd5302`.

## Limiti

Nessuna esecuzione browser o Verify completa effettuata da questo revisore. È stata letta la nuova prova E2E di risposta al problema COP, persistenza nel Core, apertura esplicita della soluzione e ripresa dopo reload; il suo esito esecutivo resta a carico della sessione root. La corrispondenza dei 15 C2 condivisi è un controllo d’integrazione sui miei elaborati, non una revisione scientifica indipendente C2: quella è svolta dall’altro agente. Nessuna modifica alle sorgenti condivise, nessuna pubblicazione, nessun passaggio a APPROVED.
