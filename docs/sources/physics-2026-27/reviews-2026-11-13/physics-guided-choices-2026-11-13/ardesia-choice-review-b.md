# Revisione indipendente — quattro quiz guidati del gruppo B

Esito: nessun P1/P2 scientifico concreto rilevato. Letti tutti i quattro prompt, le venti alternative, tutti i feedback e le soluzioni; una sola scelta soddisfa tutti i dati e le condizioni in ciascun quiz. La revisione è svolta da agente diverso dall’autore B; non è un’approvazione umana. DRAFT e humanApproval=false preservati.

Problemi SHA-256: `d4645a877ea70a8c95158efc80a14305609124d6fa7cdd18ac16f14d0bf34c48`.
Controlli SHA-256: `5a410e4557d867646156040a7a03a0b8b70dfd57f05228ac84a8bfd3559735e9`.
Entrambi verificati sui file finali congelati. Il JSON registra gli hash degli altri input letti.

## Valutazione per quiz

**U6-01 — unica scelta C.** F=qE=−4·10⁻⁶ N e a=−4 m/s². A 1 s, x=0 e v=−2 m/s. L’arresto avviene a 0,5 s, x=0,5 m. Controllo energetico distinto: K iniziale=2·10⁻⁶ J; il lavoro del campo fino all’arresto è −2·10⁻⁶ J, e il percorso di ritorno lo restituisce. I distrattori A/B/D/E descrivono rispettivamente assenza di accelerazione, ritorno confuso con arresto, omissione del termine v₀t e segno della carica sbagliato. Le due condizioni richieste, posizione e velocità, rendono la scelta unica. Mapping U6-01.06 diretto, senza dichiarare verificata tutta la dinamica di cariche puntiformi.

**U6-03 — unica scelta A.** Equilibrio del metallo e superficie gaussiana fornita impongono Q_interna=−3 nC; neutralità e isolamento del guscio impongono Q_esterna=+3 nC. Le altre scelte violano Gauss, conservazione della carica o E=0 nel materiale. La frase «non in tutta la cavità» è precisa: il campo può annullarsi in punti particolari, ma non ovunque intorno alla carica interna. Non viene assunta una distribuzione superficiale uniforme. Mapping U6-03.01 all’induzione corretto; il supporto di Gauss è dato, non viene rivendicato come obiettivo autonomamente appreso. Le somme aritmetiche sono controlli di conservazione, non una dimostrazione sperimentale della schermatura.

**U4-02 — unica scelta D.** A x=0, t=T/4, le onde valgono entrambe −A, dunque −6 mm. Il profilo totale è −2A cos(kx) sin(ωt); il punto x=0 è un ventre, non un nodo permanente. La velocità iniziale −2Aω è non nulla: E ha il numero giusto ma una spiegazione energetica falsa. A/B/C sbagliano permanenza della cancellazione, soppressione di un contributo o segni. Ricalcolati separatamente i seni e controllata l’identità su 2000 coppie spazio/tempo. Per un esempio coerente λ=2 m, T=1 s e tensione/μ=(λ/T)², la media spaziale dell’energia su una lunghezza d’onda resta costante durante l’oscillazione: non si confonde questa conservazione globale con la costanza dell’energia locale in ogni punto. Mapping .01/.02 corretto per sovrapposizione e interferenza.

**U7-01 — unica scelta B.** E₀=30√2 V/m, B₀=√2·10⁻⁷ T: il rapporto omogeneo è c. Con B_eff=10⁻⁷ T si ottiene indipendentemente I=ε₀c³B_eff²=2,3895 W/m². Il rapporto misto efficace/picco non è una velocità di propagazione. A e C usano impropriamente il fattore 1/2 con il valore efficace; D deduce incompatibilità da ampiezze non confrontabili; E è compatibile con conversioni errate, non con le definizioni fornite. Le unità E/B danno m/s; ε₀E² è una densità di energia e moltiplicando per c si ottiene W/m². Mapping .03/.04/.05 pertinente a velocità, ampiezze e intensità; nessuna frequenza o validità in un mezzo diverso è dedotta.

## Controlli e confronto con le fonti

20/20 controlli forniti dall’autore rieseguiti mediante AST numerico limitato; risultati dettagliati nel JSON. Ricalcoli fisici indipendenti aggiunti per ciascun quiz, inclusi segni, bilanci di carica e onde: il controllo non si limita a confrontare due copie della stessa formula aritmetica.

Mapping confrontato con units/coverage; confronto di novità con quattro originali, quindici assessment e le situazioni delle tredici famiglie distinte fra i ventidue record di banca associati alle unità. Il moto con inversione è distinto dai campi di cariche fisse o dal moto da fermo; il guscio è distinto dalle sfere a contatto e dalla bacchetta esterna; il profilo istantaneamente nullo di onde opposte è distinto dagli estremi di intensità; il confronto fra picco ed efficace è distinto dal verso E×B e dal cambiamento di mezzo. Non rilevate copie letterali dei prompt completi; ciò non certifica indipendenza semantica universale o originalità rispetto a tutte le fonti esterne.

I feedback spiegano l’errore delle specifiche alternative e non attribuiscono voti o padronanza. Le soluzioni menzionano esplicitamente la lettera corretta: devono quindi essere visibili soltanto nel confronto richiesto, dopo la registrazione dell’aiuto prevista dal consumer. Questo è un vincolo d’integrazione, non un difetto del contenuto separato.

Nessuna esecuzione di widget, browser o Core; nessun giudizio anticipato sull’ordine degli eventi o sulla persistenza. Nessuna modifica ai file dell’autore o del repository. Restano bozze soggette alla revisione scientifica umana dichiarata dai materiali.
