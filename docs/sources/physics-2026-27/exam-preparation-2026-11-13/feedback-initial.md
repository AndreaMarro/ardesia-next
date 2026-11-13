# Proposta di feedback per 31 quesiti legacy — 13 novembre 2026

**DRAFT — humanApproval: false.** Identità sorgente `8fbebc1e9e40ffd3e0c9210323a036560cf5b9d1`. Nuovi feedback, nessun nuovo quiz: conservati esattamente ID, prompt, cinque alternative e chiavi della selezione precedente.

**Contenuto:** 105 feedback specifici per le 105 alternative dei 21 MC; 10 svolgimenti di completamento, ciascuno con un controllo dimensionale e due errori plausibili marcati come ipotesi educative. La proposta corregge il rinvio Lorentz senza modificare sorgenti.

Questa è autoria AI in attesa di revisione indipendente, non approvazione umana. Le ipotesi d’errore non descrivono ciò che abbia fatto uno studente. Nessun punteggio, parser, timer, app o procedura ufficiale di correzione implementato. I completamenti numerici sono allenamento editoriale; il loro confronto automatico non è normato da questo rapporto.

## Feedback delle alternative

### `u1-scalar-product-03` — C1, sf-2026-u1-04

**Ipotesi:** Due vettori non nulli, perpendicolari; prodotto scalare euclideo.

**Chiave preservata:** A.

**A — Corretta: Zero**

Il prodotto scalare è |A||B|cosθ. Con θ=90° il coseno è zero: il risultato si annulla anche se nessuno dei due vettori è nullo.

Ripassa il prodotto scalare come modulo di un vettore per la componente dell’altro nella sua direzione.

**B — Errata: Il prodotto positivo dei moduli**

Il prodotto positivo dei moduli si ottiene per vettori paralleli concordi, quando cosθ=1. Per vettori perpendicolari manca invece una componente dell’uno lungo l’altro.

Confronta i valori del prodotto scalare per θ=0°, 90° e 180°.

**C — Errata: La somma dei moduli**

Sommare i moduli è un’operazione diversa dal prodotto scalare. In particolare, due moduli positivi darebbero una somma positiva, mentre l’ortogonalità impone prodotto scalare nullo.

Ripassa la differenza fra somma di vettori, somma dei moduli e prodotto scalare.

**D — Errata: Il rapporto dei moduli**

Il rapporto dei moduli è positivo e non misura l’allineamento dei vettori. Il prodotto scalare dipende anche dall’angolo e qui vale zero per cos90°=0.||Ricostruisci la formula A·B=|A

B|cosθ e controlla il ruolo dell’angolo.

**E — Errata: Un vettore perpendicolare a entrambi**

Un vettore perpendicolare a entrambi descrive la direzione del prodotto vettoriale fra vettori non paralleli. Il prodotto scalare, invece, restituisce uno scalare: qui zero.

Confronta risultato, formula e significato geometrico dei prodotti scalare e vettoriale.

### `u1-scientific-scale-03` — C1, sf-2026-u1-01

**Ipotesi:** Rapporto primo tempo/secondo; entrambi in secondi.

**Chiave preservata:** B.

**A — Errata: 1/2**

Il valore 1/2 non è il rapporto richiesto: già il primo tempo, 0,004 s, è maggiore del secondo, 0,0002 s. Il rapporto primo/secondo deve quindi superare uno.

Ripassa la stima del risultato prima del calcolo e l’ordine numeratore/denominatore.

**B — Corretta: 20**

Separando coefficienti ed esponenti si ottiene (4/2)·10^(−3−(−4))=2·10=20. Le unità s/s si cancellano.

Controlla il risultato moltiplicando 20 per il secondo tempo: si ritrova il primo.

**C — Errata: 2**

Il valore 2 considera soltanto 4/2. Il rapporto fra le potenze di dieci vale 10, perché −3−(−4)=1: quel fattore va ancora moltiplicato.

Ripassa la divisione di potenze con la stessa base, soprattutto con esponenti negativi.

**D — Errata: 1/20**

Il valore 1/20 corrisponde al secondo tempo diviso il primo. Il testo chiede l’ordine inverso, quindi il risultato è 20.

Scrivi prima il rapporto con le etichette «primo/secondo», poi sostituisci i numeri.

**E — Errata: 200**

Il valore 200 contiene un fattore dieci in eccesso. La differenza fra gli esponenti è 1, non 2: (4/2)·10=20.

Esegui separatamente il rapporto dei coefficienti e la sottrazione degli esponenti.

### `u2-center-mass-weighted-03` — C1, sf-2026-u2-05

**Ipotesi:** Sistema dei due corpi e interazione interna elastica; risultante esterna orizzontale nulla. Riferimento inerziale della meccanica ordinaria.

**Chiave preservata:** C.

**A — Errata: Oscilla necessariamente come la molla**

La molla può far oscillare la distanza fra i corpi, ma le sue forze sono interne al sistema. Non impone un’oscillazione del centro di massa, che risponde alla risultante esterna.

Ripassa la distinzione fra moto relativo dei corpi e moto del loro centro di massa.

**B — Errata: Accelera nella direzione del corpo più pesante**

La massa maggiore modifica la posizione del centro di massa, non crea una forza esterna. Con risultante esterna orizzontale nulla, M a_CM,x=0.

Ripassa separatamente definizione del centro di massa ed equazione del suo moto.

**C — Corretta: Con velocità costante, eventualmente nulla**

Nel riferimento inerziale del modello, M a_CM,x=F_ext,x=0. La velocità orizzontale del centro di massa resta quindi quella iniziale: può essere nulla oppure diversa da zero.

Ripassa perché accelerazione nulla significa velocità costante, non necessariamente quiete.

**D — Errata: Sempre fermo, qualunque fosse la velocità iniziale**

La quiete è solo il caso particolare di velocità iniziale nulla. Se il sistema possiede quantità di moto orizzontale iniziale, questa si conserva e il centro di massa trasla.

Confronta due condizioni iniziali con la stessa risultante esterna nulla.

**E — Errata: Con accelerazione uguale a quella del corpo più leggero**

L’accelerazione del centro di massa è la media pesata delle accelerazioni dei due corpi, non quella del più leggero. Le forze elastiche interne si compensano nella somma.

Ripassa M a_CM=ΣF_esterne e la compensazione delle coppie di forze interne.

### `u2-static-threshold-03` — C1, sf-2026-u2-02

**Ipotesi:** Blocco fermo; solo spinta e attrito in orizzontale; massimo statico 10 N.

**Chiave preservata:** E.

**A — Errata: 10 N**

10 N è il massimo attrito statico disponibile, non il valore obbligatorio. Con una spinta di 4 N, un attrito di 10 N lascerebbe una risultante di 6 N, incompatibile con l’equilibrio descritto.

Ripassa la disuguaglianza |F_attr,s|≤μ_s N e il significato della soglia.

**B — Errata: 6 N**

6 N è la differenza fra soglia e spinta, ma l’attrito effettivo deve bilanciare la spinta stessa. Servono 4 N nel verso opposto, non la capacità di attrito rimasta disponibile.

Disegna il diagramma delle forze orizzontali e imponi somma nulla.

**C — Errata: 0 N**

Con attrito nullo resterebbe la sola spinta orizzontale di 4 N: il blocco accelererebbe. Il testo specifica invece che resta fermo.

Ripassa il legame fra equilibrio traslazionale e risultante delle forze.

**D — Errata: 14 N**

14 N è la somma di due dati con ruoli diversi e supera anche il massimo statico ammesso. L’equilibrio richiede soltanto 4 N contrari alla spinta.

Distingui forza applicata, forza di attrito e limite massimo di attrito.

**E — Corretta: 4 N**

La risultante deve essere nulla: l’attrito vale 4 N in verso opposto alla spinta. Il valore è possibile perché 4 N è inferiore alla soglia di 10 N.

Ripassa come l’attrito statico si adatta alla forza applicata prima dello scorrimento.

### `u2-mean-velocity-03` — C1, sf-2026-u2-01

**Ipotesi:** Andata 6 m e ritorno 6 m sullo stesso asse; durata totale 4 s.

**Chiave preservata:** B.

**A — Errata: 6 m/s e 3 m/s**

La rapidità media di 3 m/s è corretta, ma la velocità media vettoriale non può avere modulo 6 m/s: posizione finale e iniziale coincidono e lo spostamento è nullo.

Ripassa la definizione di velocità media come spostamento diviso tempo totale.

**B — Corretta: 0 m/s e 3 m/s**

Lo spostamento è 6−6=0 m, mentre la distanza è 6+6=12 m. Dividendo entrambi per 4 s si ottengono, nell’ordine, 0 m/s e 3 m/s.

Confronta spostamento orientato e lunghezza totale del percorso.

**C — Errata: 3 m/s e 0 m/s**

Le due grandezze sono invertite. La velocità media vettoriale usa lo spostamento nullo; la rapidità media usa la distanza positiva di 12 m.

Associa a ciascuna definizione il suo numeratore prima di dividere per il tempo.

**D — Errata: 3 m/s e 3 m/s**

3 m/s è la rapidità media, ma non la velocità media vettoriale: sommare i tratti come lunghezze elimina l’informazione sul ritorno verso ovest.

Ripassa la somma algebrica degli spostamenti su un asse orientato.

**E — Errata: 0 m/s e 0 m/s**

Il primo zero è corretto, il secondo no: tornare al punto di partenza non cancella i 12 m effettivamente percorsi. La rapidità media vale 12/4=3 m/s.

Ripassa perché spostamento nullo non significa distanza nulla o assenza di moto.

### `u2-inelastic-rest-03` — C1, sf-2026-u2-04

**Ipotesi:** Sistema dei due corpi; impulso esterno trascurabile durante l’urto; corpi uniti dopo.

**Chiave preservata:** C.

**A — Errata: La quantità di moto di ciascun corpo separatamente**

Ogni corpo riceve un impulso dall’altro e può cambiare quantità di moto. A compensarsi sono gli impulsi interni nella somma sul sistema, non il cambiamento di ciascun corpo.

Ripassa la scelta del sistema e la distinzione fra forze interne ed esterne.

**B — Errata: La somma dei moduli delle due velocità**

La somma delle rapidità non è protetta da una legge di conservazione. La quantità conservata pesa le velocità vettoriali con le masse: p_tot=m₁v₁+m₂v₂.

Ripassa quantità di moto e differenza fra somma vettoriale e somma dei moduli.

**C — Corretta: La quantità di moto totale**

La variazione di quantità di moto totale uguaglia l’impulso esterno. Nel modello in cui questo è trascurato, p_tot si conserva anche se i corpi rimangono uniti.

Ripassa il bilancio impulso–quantità di moto per l’intero sistema.

**D — Errata: L’energia cinetica totale**

Restare attaccati caratterizza l’urto completamente anelastico: l’energia cinetica può trasformarsi in deformazioni e altre forme interne. La conservazione di p_tot non implica quella di K_tot.

Confronta ciò che si conserva negli urti elastici e anelastici.

**E — Errata: La velocità di ciascun corpo**

Le velocità individuali generalmente cambiano e, dopo l’urto, diventano uguali perché i corpi proseguono uniti. La conservazione riguarda la quantità di moto totale.

Ripassa il calcolo della velocità comune tramite m₁v₁+m₂v₂=(m₁+m₂)v_f.

### `u3-archimedes-force-03` — C2, sf-2026-u3-02

**Ipotesi:** Corpo rigido interamente immerso, densità del liquido e g costanti, nessun contatto.

**Chiave preservata:** D.

**A — Errata: Si annulla appena il corpo non è più visibile.**

La visibilità del corpo non determina alcuna forza idrostatica. La spinta dipende da densità del liquido, gravità e volume spostato, tutti costanti nelle condizioni assegnate.

Ripassa F_A=ρ_liquido gV_spostato e il significato dei tre fattori.

**B — Errata: Aumenta perché tutte le pressioni aumentano.**

Le pressioni locali aumentano, ma la spinta è la loro risultante sulla superficie chiusa. L’aumento comune non cambia il peso del liquido spostato, quindi non aumenta F_A.

Ripassa la differenza fra pressione in un punto e forza risultante delle pressioni.

**C — Errata: Diminuisce perché il corpo si allontana dalla superficie.**

Allontanarsi dalla superficie non riduce il volume immerso: il corpo resta interamente immerso e rigido. Con densità e g costanti, F_A resta invariata.

Confronta immersione parziale e completa, tenendo distinto il volume spostato dalla profondità.

**D — Corretta: Resta uguale se volume e densità del liquido non cambiano.**

F_A=ρ_liquido gV_spostato: tutti i fattori restano costanti. Le pressioni assolute cambiano con la profondità, ma la loro differenza produce la stessa spinta.

Ripassa la derivazione idrostatica del principio di Archimede.

**E — Errata: Diventa uguale al peso del corpo in ogni caso.**

La spinta non è automaticamente uguale al peso del corpo. Tale uguaglianza richiede un particolare equilibrio senza altre forze verticali; qui conta il peso del liquido spostato.

Confronta densità del corpo e del liquido e scrivi tutte le forze verticali presenti.

### `u3-poiseuille-flow-08` — C2, sf-2026-u3-04

**Ipotesi:** Tubo rigido cilindrico, fluido newtoniano incomprimibile, laminare sviluppato; Q e η fissi; r raddoppia, L quadruplica.

**Chiave preservata:** C.

**A — Errata: 16**

16 è il fattore con cui cresce r⁴, ma a portata imposta questo fattore riduce la pressione richiesta. Va inoltre considerata la lunghezza quadruplicata: Δp_n/Δp_i=4/16.

Ripassa la legge di Poiseuille risolta rispetto alla variabile richiesta.

**B — Errata: 1/16**

1/16 sarebbe il rapporto di pressione con r raddoppiato e lunghezza invariata. Qui L aumenta di quattro volte, perciò il rapporto diventa 4/16=1/4.

Elenca tutte le grandezze modificate e quelle mantenute fisse prima del confronto.

**C — Corretta: 1/4**

A Q e η fissi, Δp è proporzionale a L/r⁴. Quindi Δp_n/Δp_i=4/2⁴=1/4; reinserendo questo rapporto nella portata, Q resta uguale.

Ripassa i confronti mediante rapporti, che cancellano costanti e unità comuni.

**D — Errata: 1**

La compensazione non è completa: r raddoppiato divide la resistenza per 16, mentre L quadruplicata la moltiplica per 4. Rimane una riduzione di quattro volte.

Confronta dipendenze lineari e dipendenze dalla quarta potenza.

**E — Errata: 4**

4 considera la sola lunghezza quadruplicata. L’aumento del raggio è più influente: introduce un fattore 1/16, portando il rapporto complessivo a 1/4.

Ripassa perché il raggio compare alla quarta potenza nella portata laminare sviluppata.

### `u3-hydraulic-force-03` — C2, sf-2026-u3-02

**Ipotesi:** Pressa ideale senza perdite, moto lento, liquido incomprimibile, pistoni alla stessa quota/riferimento di pressione.

**Chiave preservata:** C.

**A — Errata: Le due corse sono sempre uguali.**

Corse uguali con un’area d’uscita dieci volte maggiore richiederebbero volumi spostati diversi. Il liquido incomprimibile impone invece A_i s_i=A_o s_o.

Ripassa la conservazione del volume nelle presse idrauliche ideali.

**B — Errata: L’uscita percorre dieci volte la corsa d’ingresso.**

Se forza e corsa d’uscita fossero entrambe dieci volte maggiori, il lavoro d’uscita sarebbe cento volte quello d’ingresso. La pressa ideale non crea questa energia.

Controlla contemporaneamente volume spostato e lavoro F·s.

**C — Corretta: L’uscita percorre un decimo della corsa d’ingresso.**

Il rapporto di forza 10 corrisponde a un rapporto di aree 10. Per conservare il volume, la corsa d’uscita è 1/10; il prodotto forza×corsa resta invariato.

Ripassa come una macchina ideale scambia forza con spostamento.

**D — Errata: L’uscita compie cento volte il lavoro d’ingresso.**

In assenza di perdite, il lavoro d’uscita uguaglia quello d’ingresso. Una forza maggiore è compensata da una corsa minore, non da un guadagno di energia.

Ripassa il bilancio energetico di una macchina semplice ideale.

**E — Errata: Il liquido deve creare energia interna dal nulla.**

Non serve creare energia: la stessa pressione agisce su aree diverse e il pistone più grande percorre meno strada. Il bilancio energetico resta soddisfatto.

Collega il principio di Pascal alla conservazione del volume e del lavoro.

### `u4-wave-phase-time-03` — C5, sf-2026-u4-01

**Ipotesi:** Periodo T=2/5 s, oscillazione periodica.

**Chiave preservata:** B.

**A — Errata: 1/2 Hz**

1/2 Hz significherebbe un periodo di 2 s. Il periodo assegnato è invece 2/5 s: il reciproco è 5/2 Hz.

Ripassa la divisione per una frazione e la relazione f=1/T.

**B — Corretta: 5/2 Hz**

Il periodo è T=2/5 s, dunque f=1/T=5/2 Hz. Cinque periodi durano 2 s: è lo stesso conteggio di cinque cicli ogni due secondi.

Controlla frequenza e periodo verificando fT=1.

**C — Errata: 2/5 Hz**

2/5 è il valore numerico del periodo, non della frequenza. Trasferire lo stesso numero da secondi a hertz senza invertirlo non rispetta fT=1.

Ripassa significato fisico e unità di periodo e frequenza.

**D — Errata: 5 Hz**

5 Hz richiederebbe un periodo di 1/5 s. Nel testo cinque cicli durano 2 s, quindi vanno divisi per due: f=5/2 Hz.

Ricava la frequenza contando cicli in un intervallo di durata nota.

**E — Errata: 10 Hz**

10 Hz richiederebbe un periodo di 1/10 s, più breve di quello dato. Il rapporto corretto è un secondo diviso 2/5 di secondo.

Ripassa il controllo inverso T=1/f per scartare un valore incompatibile.

### `u4-coherent-constructive-06` — C5, sf-2026-u4-02

**Ipotesi:** Stessa frequenza e polarizzazione, mezzo lineare; ampiezze 3 e 4 mm; fase relativa da 0 a π; I proporzionale ad A² nel confronto.

**Chiave preservata:** A.

**A — Corretta: 1/49**

In fase le ampiezze si sommano: 3+4=7 mm. Dopo l’inversione di π si sottraggono: |4−3|=1 mm. Il rapporto d’intensità è (1/7)²=1/49.

Ripassa separatamente sovrapposizione delle ampiezze e dipendenza quadratica dell’intensità.

**B — Errata: 1/7**

1/7 è il rapporto fra ampiezze risultanti, non fra intensità. Poiché il testo assegna I∝A², il rapporto deve essere elevato al quadrato.

Confronta le unità e il significato di ampiezza e intensità.

**C — Errata: 7**

7 è il rapporto iniziale/finale delle ampiezze; la domanda richiede finale/iniziale delle intensità. Occorrono sia inversione sia quadrato.

Scrivi esplicitamente I_f/I_i=(A_f/A_i)² prima dei calcoli.

**D — Errata: 49**

49 è il rapporto I_iniziale/I_finale. La fase passa da somma a differenza, quindi l’intensità finale diminuisce e I_finale/I_iniziale deve essere minore di uno.

Usa una previsione qualitativa per controllare l’ordine del rapporto.

**E — Errata: 1**

Le ampiezze delle singole onde restano uguali, ma la fase relativa cambia l’ampiezza risultante. Passare da 7 a 1 mm riduce l’intensità di un fattore 49.

Ripassa il ruolo della fase relativa nell’interferenza coerente.

### `u5-latent-heat-03` — C3, sf-2026-u5-02

**Ipotesi:** Sostanza pura in equilibrio solido-liquido, pressione fissata, temperatura di fusione, nessuna reazione.

**Chiave preservata:** A.

**A — Corretta: Il calore fornito cambia la frazione liquida mentre la temperatura resta costante.**

Alla pressione fissata, la coesistenza di solido e liquido della sostanza pura avviene alla temperatura di fusione. Il calore fornito trasforma ulteriore massa in liquido finché resta fase solida.

Ripassa la relazione Q=m_fusa L e il tratto orizzontale della curva di riscaldamento.

**B — Errata: L’energia interna non può cambiare.**

Temperatura costante non impone energia interna costante: durante un cambio di fase cambia lo stato della sostanza. A pressione fissata il calore latente è legato alla variazione di entalpia, comprendendo l’eventuale lavoro di volume.

Ripassa la differenza fra temperatura, energia interna e calore di trasformazione.

**C — Errata: Il calore specifico deve essere uguale a zero.**

Il tratto a temperatura costante non richiede calore specifico nullo. La formula Q=mcΔT descrive un riscaldamento nella stessa fase, mentre qui varia la frazione di fase.

Distingui calore sensibile e calore latente.

**D — Errata: Non può entrare energia perché la temperatura è costante.**

Energia può entrare anche senza aumento di temperatura: viene impiegata nel cambiamento di fase. La temperatura non misura direttamente tutto il contenuto energetico.

Ripassa perché un termometro fermo non dimostra che il calore scambiato sia zero.

**E — Errata: La temperatura cresce proporzionalmente a tutto il calore fornito.**

Finché coesistono le fasi, la pressione fissata mantiene la temperatura di fusione. La temperatura del liquido può aumentare dopo che la fusione è terminata, non lungo tutto questo tratto.

Individua nella curva di riscaldamento i tratti monofase e quelli di coesistenza.

### `u5-ideal-gas-pressure-03` — C3, sf-2026-u5-01

**Ipotesi:** Gas ideale chiuso, stati estremi di equilibrio; lavoro del gas positivo; variazioni cinetiche/potenziali macroscopiche nulle.

**Chiave preservata:** E.

**A — Errata: No, perché l’energia interna non ha alcun legame con la temperatura.**

La risposta «no» è motivata in modo errato: per un campione di gas ideale l’energia interna dipende dalla temperatura. È il lavoro, e quindi il calore, a dipendere anche dal percorso.

Ripassa U(T) per un gas ideale e Q=ΔU+W.

**B — Errata: Sì, ma soltanto usando Celsius al posto di Kelvin.**

Cambiare scala termometrica non fornisce il processo mancante. L’equazione di stato richiede kelvin e, anche con gli stati noti, non determina da sola il lavoro lungo il percorso.

Distingui equazione di stato e bilancio energetico di una trasformazione.

**C — Errata: Sì, perché il calore è una funzione di stato.**

Il calore non è una funzione di stato: descrive energia trasferita durante un processo. Con gli stessi estremi, lavori diversi richiedono calori diversi tramite Q=ΔU+W.

Confronta funzioni di stato e quantità di scambio.

**D — Errata: Sì, basta moltiplicare la pressione finale per il volume finale.**

Il prodotto p_fV_f ha dimensioni di energia ma non è in generale il calore scambiato. Non contiene l’informazione sul lavoro compiuto durante la trasformazione.

Ripassa perché coerenza dimensionale è necessaria ma non basta a identificare una grandezza.

**E — Corretta: No: il calore dipende anche dal percorso e dal lavoro scambiato.**

Gli stati estremi fissano ΔU del campione ideale, mentre il lavoro dipende dal percorso. Dato Q=ΔU+W, senza conoscere W o informazioni equivalenti non si determina sempre Q.

Confronta un’espansione isoterma reversibile con una libera espansione isolata dello stesso gas ideale.

### `u5-entropy-hot-cold-03` — C3, sf-2026-u5-05

**Ipotesi:** Due sorgenti ideali a T_h>T_c>0 costanti; Q=600 J dal caldo al freddo; nessun altro scambio.

**Chiave preservata:** E.

**A — Errata: Perché il calore perso dal caldo è inferiore a quello ricevuto dal freddo.**

Il caldo perde proprio i 600 J ricevuti dal freddo: non c’è una differenza di energia trasferita. La differenza nasce dai fattori 1/T nei due contributi di entropia.

Ripassa separatamente bilancio energetico e bilancio entropico.

**B — Errata: Perché l’entropia si misura in joule come l’energia.**

L’entropia si misura in J/K, non in J. Per sorgenti a temperatura costante, la variazione è Q/T: lo stesso calore produce moduli diversi a temperature diverse.

Esegui il controllo delle unità nella relazione ΔS=Q/T.

**C — Errata: Perché il corpo caldo non perde entropia.**

La sorgente calda perde entropia: ΔS_h=−600/T_h. Il totale aumenta perché il freddo guadagna 600/T_c, quantità maggiore in modulo dato T_c<T_h.

Scrivi i due contributi con segno prima di sommarli.

**D — Errata: Perché viene creata energia nel corpo freddo.**

Non si crea energia: la somma dei due scambi è −600+600=0 J. È positiva la variazione totale di entropia, che segnala l’irreversibilità del trasferimento.

Confronta la conservazione dell’energia con il secondo principio per il sistema complessivo.

**E — Corretta: Perché ogni joule trasferito produce una variazione di entropia maggiore alla temperatura più bassa.**

Per ogni joule ricevuto, il freddo guadagna (1 J)/T_c di entropia; il caldo ne perde (1 J)/T_h. Poiché T_c<T_h, ΔS_tot=600(1/T_c−1/T_h)>0. Il termine «produce» qui indica la variazione delle singole sorgenti; la produzione irreversibile riguarda il totale.

Ripassa variazione di entropia di una parte e produzione totale di entropia.

### `u5-net-blackbody-exchange-03` — C3, sf-2026-u5-03

**Ipotesi:** Superficie nera piccola circondata da grande ambiente nero; stessa T assoluta positiva; assorbività/emissività 1.

**Chiave preservata:** D.

**A — Errata: La legge radiativa diventa indipendente dalla temperatura.**

La potenza emessa continua a dipendere da T⁴. A uguale temperatura si annulla la differenza fra emissione e assorbimento, non la dipendenza di ciascuno dalla temperatura.

Ripassa P_em=σAT⁴ e P_net=P_em−P_ass.

**B — Errata: La superficie smette completamente di emettere radiazione.**

Una superficie nera a temperatura assoluta positiva continua a emettere. L’equilibrio è mantenuto perché riceve dall’ambiente una potenza uguale a quella emessa.

Distingui equilibrio dinamico degli scambi e assenza di scambi.

**C — Errata: L’ambiente continua a emettere ma la superficie no.**

Entrambi, superficie e ambiente nero, emettono a temperatura positiva. Non esiste nel modello un motivo per attribuire l’emissione al solo ambiente.

Applica la legge di Stefan–Boltzmann a ciascun corpo.

**D — Corretta: Entrambi emettono e assorbono, ma la potenza netta scambiata è zero.**

I contributi lordi sono positivi e uguali: P_em=P_ass=σAT⁴. Il bilancio netto è quindi zero anche se radiazione continua a passare nei due versi.

Ripassa il significato di potenza lorda e potenza netta.

**E — Errata: La potenza netta diventa infinita.**

Temperature e area finite danno potenze finite. A temperature uguali la differenza è precisamente zero, non infinita.

Controlla il limite T_superficie=T_ambiente nella formula P_net=σA(T_s⁴−T_a⁴).

### `u6-lorentz-force-03` — C4, sf-2026-u6-06

**Ipotesi:** Particella soggetta soltanto alla forza di un campo magnetico uniforme e statico nel modello classico della lezione.

**Chiave preservata:** D.

**A — Errata: La direzione del moto anche quando la velocità è perpendicolare a B**

Quando v è perpendicolare a B, la forza magnetica può essere non nulla e curva la traiettoria. Il modulo di v resta costante, mentre la direzione cambia.

Ripassa il moto circolare di una carica nel campo magnetico uniforme.

**B — Errata: La posizione nello spazio**

La posizione varia se la particella si muove: lavoro nullo non significa particella ferma. Può percorrere una circonferenza o un’elica senza cambiare energia cinetica.

Distingui posizione, velocità ed energia cinetica.

**C — Errata: La quantità di moto vettoriale in ogni situazione**

La quantità di moto vettoriale può cambiare direzione sotto la forza magnetica. Resta costante il suo modulo nel modello, non necessariamente il vettore.

Ripassa dp/dt=F e la differenza fra variazione di modulo e variazione di direzione.

**D — Corretta: Il modulo della velocità e quindi l’energia cinetica**

La forza q(v×B) è perpendicolare a v: la potenza F·v è nulla. Nel modello classico senza altre forze, K e il modulo della velocità restano costanti.

Ripassa la relazione fra lavoro, potenza e variazione dell’energia cinetica.

**E — Errata: Il vettore velocità in ogni situazione**

Il vettore velocità resta costante solo in casi particolari, come il moto parallelo a B. In generale la forza ne cambia la direzione pur senza cambiarne il modulo.

Confronta i casi v parallela, perpendicolare e obliqua a B.

**Correzione proposta:** Il feedback proposto descrive direttamente modulo/vettore e usa gli ID A–E effettivi; eliminato il rinvio legacy impreciso alla «seconda opzione». Nessuna chiave o alternativa cambiata.

### `u6-plane-capacitance-03` — C4, sf-2026-u6-03

**Ipotesi:** Interno del materiale di un conduttore in equilibrio elettrostatico, non una cavità o il dielettrico fra armature.

**Chiave preservata:** A.

**A — Corretta: Il campo elettrico è nullo**

Nel materiale conduttore in equilibrio elettrostatico, un campo non nullo muoverebbe le cariche libere. La loro redistribuzione porta quindi a E=0 all’interno del materiale.

Ripassa come si raggiunge l’equilibrio elettrostatico in un conduttore.

**B — Errata: Il campo elettrico è sempre uguale al campo esterno applicato**

Il campo esterno applicato non coincide necessariamente con quello interno: le cariche del conduttore si redistribuiscono e il loro contributo annulla il campo nel materiale.

Ripassa il principio di sovrapposizione e la redistribuzione superficiale delle cariche.

**C — Errata: Il potenziale deve essere necessariamente zero**

E=0 implica potenziale costante nel conduttore connesso, non valore obbligatoriamente zero. Lo zero di potenziale dipende dal riferimento e da eventuali collegamenti a terra.

Distingui campo nullo, equipotenzialità e messa a terra.

**D — Errata: Le cariche libere continuano ad accelerare indefinitamente**

Un’accelerazione indefinita delle cariche contraddirebbe l’equilibrio elettrostatico. In tale condizione non rimane un campo interno che sostenga quella forza.

Ripassa il significato di equilibrio e distinguilo da un conduttore percorso da corrente.

**E — Errata: La resistività deve essere esattamente infinita**

Resistività infinita descriverebbe un isolante ideale, non la ragione del campo nullo in un conduttore. Qui sono le cariche mobili a redistribuirsi fino all’equilibrio.

Confronta conduzione, isolamento ed equilibrio elettrostatico.

### `u6-faraday-average-emf-03` — C4, sf-2026-u6-07

**Ipotesi:** Spira conduttrice; flusso verso l’osservatore crescente. Si intende il contributo del campo indotto attraverso la superficie della spira.

**Chiave preservata:** C.

**A — Errata: È parallelo al filo in ogni punto**

Il campo di una corrente non è in generale parallelo al filo. Per il campo attraverso la spira, il criterio decisivo è il verso che contrasta la variazione del flusso applicato.

Ripassa la geometria del campo di una spira e la regola della mano destra.

**B — Errata: Dipende soltanto dal colore del conduttore**

Il colore del conduttore non determina il segno dell’induzione. La legge di Lenz lo collega alla variazione temporale del flusso magnetico.

Ripassa quali grandezze compaiono nella legge di Faraday–Lenz.

**C — Corretta: È diretto dalla spira lontano dall’osservatore, per opporsi all’aumento del flusso**

Il flusso applicato verso l’osservatore aumenta; la corrente indotta genera attraverso la spira un contributo nel verso opposto. Vista dall’osservatore, la corrente corrispondente è oraria.

Applica prima Lenz al flusso, poi la mano destra al verso della corrente.

**D — Errata: È diretto verso l’osservatore, per rinforzare sempre il campo applicato**

Un contributo verso l’osservatore rinforzerebbe l’aumento del flusso assegnato. Lenz richiede l’opposizione alla variazione, non il rinforzo automatico del campo applicato.

Confronta separatamente un flusso crescente e lo stesso flusso decrescente.

**E — Errata: È sempre nullo perché il campo applicato non può produrre corrente**

Un flusso magnetico variabile può generare una forza elettromotrice e una corrente nella spira conduttrice. Non va confuso con un flusso costante, che in questo modello non induce la corrente.

Ripassa la differenza fra valore di Φ e sua derivata dΦ/dt.

### `u7-photon-rate-power-03` — C5, sf-2026-u7-06

**Ipotesi:** Assorbimento a un solo fotone; confronto del requisito energetico per togliere un elettrone, senza pretesa di probabilità unitaria di assorbimento.

**Chiave preservata:** A.

**A — Corretta: La sua energia hf, quindi la frequenza, confrontata con l’energia richiesta dal processo**

In un assorbimento a un fotone l’energia disponibile è hf. Va confrontata con l’energia richiesta per rimuovere l’elettrone; è un requisito energetico, non una garanzia che ogni fotone venga assorbito.

Ripassa energia del fotone e soglia energetica di ionizzazione.

**B — Errata: Soltanto il numero totale di fotoni emessi dalla sorgente**

Il numero di fotoni modifica l’energia complessiva del fascio e il numero di occasioni d’interazione, ma non l’energia hf di ciascun fotone. Il quesito esclude l’assorbimento multifotonico.

Distingui energia per fotone, flusso di fotoni e potenza del fascio.

**C — Errata: Soltanto l’area del laboratorio**

L’area del laboratorio non fissa l’energia del singolo fotone. Nel modello elementare questa dipende dalla frequenza tramite E=hf.

Ripassa quali grandezze determinano l’energia di un quanto di radiazione.

**D — Errata: Il fatto che il fascio sia visibile all’occhio, indipendentemente dalla frequenza**

La visibilità dipende dalla sensibilità dell’occhio e non sostituisce il confronto energetico con l’atomo. Occorre conoscere hf rispetto alla soglia del processo.

Confronta classificazione dello spettro visibile e requisito energetico di ionizzazione.

**E — Errata: Il numero di minuti da cui la lampada è accesa, indipendentemente dall’energia del fotone**

Aumentare la durata dell’illuminazione può aumentare il numero di fotoni ricevuti, ma non accumula automaticamente energia in un singolo evento a un fotone. Conta l’energia hf del fotone assorbito.

Distingui energia totale erogata nel tempo ed energia del singolo evento.

### `u7-thin-lens-real-image-03` — C5, sf-2026-u7-07

**Ipotesi:** Lente sottile convergente, oggetto reale con 0<p<f, modello parassiale.

**Chiave preservata:** E.

**A — Errata: Reale e capovolta su uno schermo dall’altro lato, in ogni caso**

Con l’oggetto entro il fuoco, i raggi emergenti non convergono realmente dall’altro lato. L’immagine deriva dai loro prolungamenti sul lato dell’oggetto e non si raccoglie direttamente su quello schermo.

Ripassa il tracciamento dei raggi per 0<p<f in una lente convergente.

**B — Errata: Sempre reale e della stessa dimensione dell’oggetto**

Il carattere reale e la stessa dimensione non valgono per un oggetto entro il fuoco. In questa posizione l’immagine è virtuale e l’ingrandimento è maggiore di uno.

Confronta i casi p<f, p=2f e p>2f senza trasferire proprietà fra casi diversi.

**C — Errata: Nessuna immagine di alcun tipo**

Non si forma un’immagine reale sullo schermo, ma esiste un’immagine virtuale: i prolungamenti dei raggi emergenti si incontrano sul lato dell’oggetto.

Ripassa la definizione geometrica di immagine virtuale.

**D — Errata: Virtuale ma necessariamente più piccola dell’oggetto**

L’immagine è virtuale, ma non più piccola. Dalla lente sottile si ottiene m=f/(f−p)>1 quando 0<p<f, quindi è diritta e ingrandita.

Ripassa il segno e il modulo dell’ingrandimento trasversale.

**E — Corretta: Virtuale, diritta e ingrandita, sullo stesso lato dell’oggetto**

Con 0<p<f, 1/q=1/f−1/p è negativo: q<0. L’ingrandimento m=−q/p è positivo e maggiore di uno, quindi l’immagine è virtuale, diritta e ingrandita sul lato dell’oggetto.

Ripassa l’equazione della lente verificando il caso p=f/2: q=−f e m=2.

### `u7-beta-minus-atomic-number-03` — C5, sf-2026-u7-05

**Ipotesi:** Decadimento nucleare β⁻.

**Chiave preservata:** D.

**A — Errata: Un protone e un neutrone si annullano sempre lasciando solo luce visibile**

Il decadimento β⁻ non è annichilazione fra protone e neutrone. Trasforma un neutrone in protone con emissione di un elettrone e di un antineutrino elettronico.

Ripassa i prodotti e i bilanci di carica del decadimento β⁻.

**B — Errata: Il nucleo perde obbligatoriamente quattro nucleoni**

La perdita di quattro nucleoni caratterizza un’emissione alfa. Nel β⁻ un nucleone cambia tipo: il numero di massa A resta invariato.

Confronta le variazioni di A e Z nei decadimenti alfa e beta.

**C — Errata: Il numero atomico diminuisce di due in ogni evento**

Nel β⁻ il numero atomico aumenta di uno, perché un neutrone diventa protone. Una diminuzione di due appartiene al decadimento alfa, non a questo processo.

Scrivi separatamente il bilancio dei protoni e quello dei nucleoni totali.

**D — Corretta: Un neutrone si trasforma in protone e vengono emessi un elettrone e un antineutrino elettronico**

La trasformazione è n→p+e⁻+antineutrino elettronico. La carica si conserva: 0=(+e)+(−e)+0; il nucleo figlio ha Z aumentato di una unità e A invariato.

Ripassa il passaggio dalla reazione elementare ai numeri A e Z del nucleo.

**E — Errata: Un elettrone orbitale viene semplicemente strappato senza modificare il nucleo**

Strappare un elettrone orbitale è ionizzazione: cambia lo stato di carica dell’atomo ma non Z del nucleo. Il β⁻ è invece una trasformazione nucleare e l’elettrone viene prodotto nel decadimento.

Distingui processi della nube elettronica e trasformazioni del nucleo.

## Completamenti

### `u1-area-conversion-01` — C1, sf-2026-u1-02

**Chiave preservata:** 8 1.

**Ipotesi:** A=2 valore numerico dell’area; una vecchia unità lineare contiene c=2 nuove unità lineari.

1. A=2 è il valore numerico dell’area nella vecchia unità; c=2 indica che ogni vecchia unità lineare contiene due nuove unità.
2. Una vecchia unità di superficie contiene quindi c²=4 nuove unità di superficie. La superficie fisica resta la stessa.
3. Il nuovo valore numerico è B=A c²=2·4=8. Inserire 8 nel formato numerico richiesto.
4. Controllo inverso: B/c²=8/4=2, cioè il valore iniziale.

**Controllo dimensionale:** B è un valore numerico e la chiave usa unità 1. L’area fisica ha sempre dimensione L²: il fattore di conversione c² non la rende adimensionale.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Usare il fattore lineare anziché quello di superficie:** B=2·2=4 conterebbe soltanto una delle due direzioni. Ripassare perché le conversioni di area richiedono il quadrato del fattore lineare.
- **Invertire il verso della conversione:** B=2/4=1/2 corrisponderebbe a usare una nuova unità di superficie più grande. Qui la nuova unità è più piccola, quindi il valore numerico deve aumentare.

### `u2-gravitational-energy-01` — C1, sf-2026-u2-03

**Chiave preservata:** 40 J.

**Ipotesi:** m=2 kg, aumento di quota h=2 m, g=10 m/s² uniforme; incremento di energia potenziale rispetto all’inizio.

1. La massa è 2 kg e la quota aumenta di 2 m in un campo uniforme g=10 m/s². Si chiede la variazione di energia potenziale, non il lavoro del peso.
2. Il peso ha modulo mg=2·10=20 N. La variazione di energia potenziale per una salita h è ΔU=mgh.
3. ΔU=2·10·2=40 J: è positiva perché la quota aumenta.
4. Controllo: il lavoro della gravità è W_g=−40 J; dunque ΔU=−W_g, come richiesto per una forza conservativa.

**Controllo dimensionale:** kg·(m/s²)·m=kg·m²/s²=J.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Confondere lavoro del peso e variazione di energia potenziale:** −40 J è il lavoro della gravità durante la salita, non l’incremento di U. Ripassare ΔU=−W_conservativa.
- **Dimenticare il dislivello:** 20 N è il peso, non un’energia. Serve ancora moltiplicarlo per i 2 m di aumento di quota. Ripassare la differenza dimensionale fra forza ed energia.

### `u3-bernoulli-height-speed-01` — C2, sf-2026-u3-03

**Chiave preservata:** 12 kPa.

**Ipotesi:** Grande serbatoio, v iniziale trascurabile, fluido ideale senza perdite; getto h=1 m sopra la superficie, v=2 m/s; ρ=1000 kg/m³ e g=10 m/s².

1. Confrontare la superficie del grande serbatoio, dove la velocità è trascurabile, e il getto a quota maggiore di h=1 m, con velocità v=2 m/s. Usare il modello ideale senza perdite.
2. Bernoulli dà p_serb−p_getto=ρgh+ρv²/2: il salto di pressione sostiene sia la salita sia l’aumento di energia cinetica.
3. Il contributo di quota vale 1000·10·1=10000 Pa; quello cinetico 1000·2²/2=2000 Pa.
4. La somma è 12000 Pa=12 kPa. Inserire 12 perché l’unità richiesta è kPa.
5. Controllo fisico: ponendo v=0 resterebbero 10 kPa; la velocità non nulla richiede altri 2 kPa, quindi un risultato inferiore a 10 kPa non soddisferebbe il modello.

**Controllo dimensionale:** ρgh e ρv² hanno entrambi unità kg/(m·s²)=Pa; 12000 Pa/1000=12 kPa.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Trascurare il dislivello:** 2 kPa tiene conto soltanto della velocità del getto. Ripassare il termine gravitazionale ρgh nel bilancio di Bernoulli.
- **Restituire il valore in pascal anziché in kilopascal:** 12000 è il valore in Pa, mentre il campo richiesto è in kPa. Ripassare il prefisso kilo e indicare 12 nel formato assegnato.

### `u3-apparent-weight-01` — C2, sf-2026-u3-02

**Chiave preservata:** 20 N.

**Ipotesi:** Corpo di m=3 kg e volume esterno 1 L, interamente immerso in acqua 1 kg/L, fermo, filo verticale, g=10 m/s².

1. Il corpo è fermo e completamente immerso: il peso mg agisce verso il basso, tensione e spinta verso l’alto. Il modello non include contatti con fondo o pareti.
2. Il peso vale 3·10=30 N. Il volume esterno di 1 L sposta 1 kg d’acqua, quindi la spinta vale 1·10=10 N.
3. L’equilibrio verticale è T+F_A−mg=0, da cui T=30−10=20 N.
4. Controllo: tensione e spinta sommano 30 N. La lettura è positiva e minore del peso in aria, coerentemente con un corpo più denso dell’acqua.

**Controllo dimensionale:** (1 kg/L)·(1 L)·(10 m/s²)=10 kg·m/s²=10 N per la spinta; T è in N.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Usare il peso in aria come lettura del dinamometro:** 30 N omette la spinta che sostiene parte del corpo. Ripassare il diagramma delle tre forze in immersione.
- **Sommare la spinta al peso invece di sottrarla:** 40 N richiederebbe una tensione che si aggiunge al peso verso il basso. Nel modello il filo e la spinta sostengono il corpo verso l’alto: T=mg−F_A.

### `u4-wave-phase-space-01` — C5, sf-2026-u4-01

**Chiave preservata:** 1/4 giri.

**Ipotesi:** Onda armonica, confronto simultaneo lungo la propagazione; Δs=1 m e λ=4 m; differenza prima del modulo di un giro.

1. Confrontare simultaneamente due punti distanti Δs=1 m lungo la propagazione di un’onda armonica di lunghezza λ=4 m.
2. Una lunghezza d’onda completa corrisponde a 2π radianti, cioè un giro di fase. La separazione data è un quarto di lunghezza d’onda.
3. Il numero di giri è ν=|Δφ|/(2π)=Δs/λ=1/4. Inserire 1/4, oppure una rappresentazione numerica equivalente soltanto se il futuro allenamento la ammetterà esplicitamente.
4. Controllo: 1/4 di giro moltiplicato per 4 m per giro restituisce la separazione di 1 m.

**Controllo dimensionale:** Δs/λ è adimensionale; il risultato è espresso in giri di fase. In radianti lo stesso angolo sarebbe π/2, non il valore da inserire come numero di giri.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Invertire il rapporto fra separazione e lunghezza d’onda:** 4 giri corrisponderebbero a 16 m, non a 1 m. Ripassare che una λ rappresenta un solo giro.
- **Inserire l’angolo in radianti nel campo espresso in giri:** π/2 è l’angolo corretto in radianti, ma il campo richiede giri: occorre dividerlo per 2π. Ripassare le unità angolari.

### `u5-calorimeter-capacity-01` — C3, sf-2026-u5-02

**Chiave preservata:** 40 °C.

**Ipotesi:** Due porzioni da 2 g con c=1 J/(g K), inizialmente 80 e 20 °C; recipiente C=2 J/K a 20 °C, sistema isolato, nessun cambio di fase.

1. La porzione calda ha capacità termica 2 g·1 J/(g K)=2 J/K. La porzione fredda ha la stessa capacità; il recipiente aggiunge altri 2 J/K e parte anch’esso da 20 °C.
2. Il sistema è isolato e non cambia fase. Il calore ceduto dal caldo uguaglia quello ricevuto da freddo e recipiente: 2(80−T_f)=4(T_f−20).
3. Sviluppare: 160−2T_f=4T_f−80, quindi 240=6T_f e T_f=40 °C.
4. Controllo energetico: il caldo cede 2·40=80 J; freddo e recipiente ricevono 4·20=80 J. La temperatura finale è fra 20 e 80 °C e, per la capacità maggiore sul lato freddo, sotto la media semplice di 50 °C.

**Controllo dimensionale:** Ogni capacità in J/K moltiplicata per una differenza di temperatura in K dà J; gli intervalli di 1 °C e 1 K coincidono.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Trascurare la capacità termica del recipiente:** 50 °C sarebbe l’equilibrio delle sole due porzioni uguali. Il recipiente inizialmente freddo assorbe energia e abbassa T_f: ripassare il bilancio di tutte le parti.
- **Sommare masse e capacità termiche senza il calore specifico:** I grammi non si sommano direttamente ai J/K. Prima calcolare C=mc; qui c vale numericamente uno, ma le unità restano essenziali.

### `u5-first-law-expansion-01` — C3, sf-2026-u5-04

**Chiave preservata:** 60 J.

**Ipotesi:** Sistema chiuso, Q=100 J entrante, W=40 J fatto dal sistema; variazioni di energia cinetica/potenziale macroscopica nulle.

1. Il sistema chiuso riceve 100 J come calore e cede 40 J all’ambiente come lavoro. Non cambiano le energie cinetica e potenziale macroscopiche.
2. Usare la convenzione dichiarata: Q positivo entrante e W positivo compiuto dal sistema, quindi ΔU=Q−W.
3. ΔU=100−40=60 J. L’energia interna aumenta, ma di meno del calore ricevuto perché una parte esce come lavoro.
4. Controllo: i 60 J rimasti nel sistema più i 40 J trasferiti come lavoro ricostruiscono i 100 J entranti.

**Controllo dimensionale:** Q, W e ΔU sono energie in J; la sottrazione è dimensionalmente omogenea.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Sommare il lavoro uscente al calore entrante:** 140 J si otterrebbero se i 40 J fossero lavoro fatto sul sistema. Qui sono lavoro del sistema sull’ambiente: ripassare i versi dei trasferimenti.
- **Identificare ΔU con tutto il calore ricevuto:** 100 J trascura i 40 J usciti come lavoro. Ripassare il primo principio come bilancio fra entrate e uscite.

### `u6-current-charge-time-01` — C4, sf-2026-u6-04

**Chiave preservata:** 3 A.

**Ipotesi:** Carica positiva trasferita Q=6 mC, intervallo 2 ms; corrente media e verso coerente con il trasferimento.

1. Si chiede la corrente media: dividere la carica trasferita nell’intervallo per la sua durata, senza assumere costanza della corrente istantanea.
2. Convertire 6 mC=0,006 C e 2 ms=0,002 s.
3. I_media=0,006/0,002=3 A. I due prefissi milli si cancellano anche nel rapporto diretto 6/2.
4. Controllo: 3 A·0,002 s=0,006 C, pari ai 6 mC assegnati.

**Controllo dimensionale:** C/s=A; il rapporto mC/ms coincide con C/s perché numeratore e denominatore contengono lo stesso fattore 10⁻³.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Convertire la carica ma non il tempo:** 0,003 A deriva da 0,006 C diviso 2 s, ma l’intervallo è 2 ms. Ripassare conversioni coerenti su entrambi i dati.
- **Moltiplicare carica e tempo:** 6·2 non esprime un ritmo di trasferimento. La corrente è una carica per unità di tempo: ripassare la definizione I_media=ΔQ/Δt.

### `u6-coulomb-force-01` — C4, sf-2026-u6-01

**Chiave preservata:** 10 N.

**Ipotesi:** Cariche puntiformi positive entrambe 1 μC, distanza 3 cm; k=9·10⁹ N·m²/C², vuoto/aria come vuoto.

1. Le due cariche sono puntiformi, positive e pari a 1 μC ciascuna; la distanza è 3 cm. Si chiede il modulo della forza nel vuoto o nell’approssimazione assegnata.
2. Convertire Q=q=10⁻⁶ C e r=3·10⁻² m. Applicare F=k_eQq/r².
3. Il numeratore vale 9·10⁹·10⁻⁶·10⁻⁶=9·10⁻³ N·m². Il denominatore è (3·10⁻²)²=9·10⁻⁴ m².
4. F=(9·10⁻³)/(9·10⁻⁴)=10 N. Il verso sarebbe repulsivo, ma la risposta richiesta contiene soltanto il modulo.
5. Controllo: F r²=10·9·10⁻⁴=9·10⁻³ N·m² ricostruisce k_eQq.

**Controllo dimensionale:** (N·m²/C²)·C·C/m²=N: la distanza va espressa in metri prima del quadrato.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Usare r=3 senza convertire i centimetri:** Con k_e in SI si tratterebbero 3 cm come 3 m, ottenendo 0,001 N anziché 10 N. Ripassare conversione e quadrato della distanza.
- **Usare la distanza alla prima potenza:** Il prodotto k_eQq/r avrebbe unità N·m e non N. Ripassare la dipendenza inversamente quadratica della legge di Coulomb.

### `u7-radioactive-activity-01` — C5, sf-2026-u7-05

**Chiave preservata:** 7 Bq.

**Ipotesi:** Un solo radionuclide, N=20 nuclei, emivita 2 s; ln2 approssimato a 0,7 come esplicitamente prescritto.

1. Il campione contiene N=20 nuclei del solo radionuclide e ha emivita 2 s. Per questo esercizio il testo prescrive ln2≈0,7.
2. La costante di decadimento è λ≈0,7/2=0,35 s⁻¹. L’attività al numero N assegnato è il tasso atteso λN.
3. A≈0,35·20=7 Bq. Inserire 7 secondo l’approssimazione numerica richiesta: il valore non è esatto rispetto a ln2 non approssimato.
4. Controllo: A/N=7/20=0,35 s⁻¹ coincide con λ. Con così pochi nuclei il numero effettivo di eventi fluttua: 7 Bq non promette esattamente sette decadimenti nel successivo secondo.

**Controllo dimensionale:** λ ha unità s⁻¹; N è un conteggio, quindi A=λN si esprime in Bq, equivalenti a s⁻¹ per il tasso atteso.

**Errori plausibili: ipotesi educative, non diagnosi dello studente.**

- **Usare N/T½ senza il fattore ln2:** 10 Bq omette il fattore 0,7 prescritto. Ripassare λ=ln2/T½, che deriva dalla legge di dimezzamento.
- **Confondere attività al tempo dato con media sull’intera emivita:** 5 decadimenti/s deriva dai 10 decadimenti attesi in 2 s; è una media temporale su quell’intervallo, non il tasso iniziale A=λN≈7 Bq. Ripassare la diminuzione di N e dell’attività nel tempo.

## Provenienza e limiti

La provenienza del quesito rimane legacy; la provenienza dei nuovi feedback è `authored`, assistita da AI, revisione `exam-feedback-proposal-2026-11-13`. Il JSON preserva metadati e hash di ciascun record. Nessuna delle attribuzioni storiche viene trasformata in approvazione umana.

La fonte di selezione include 38 ricalcoli aritmetici. In questo incarico sono stati controllati conteggi, identità e corrispondenza delle chiavi; non è stata eseguita una suite applicativa o una prova su studenti. La seconda review indipendente è pendente.

I byte dei cinque sorgenti editoriali/registro sono stati confrontati con gli hash della selezione congelata. Nessun comando Git utilizzato, nessuna modifica al repository.

- `docs/sources/physics-2026-27/editorial/bank-selection.json` — SHA256 `fdd548b9e404d40613560e150959198d4477fef8fbf1e5ec24e4116d4eab46f4`.
- `docs/sources/physics-2026-27/coverage.json` — SHA256 `018e320595808d61f8982ccbfef93565e47486e576dd8d850c749a330587c13e`.
- `docs/sources/physics-2026-27/editorial/units.json` — SHA256 `5e9f6c350b7bf3f1bdf86a988028c392ab0e4fefe906d7fe3f67da4925587245`.
- `docs/sources/physics-2026-27/editorial/courses.json` — SHA256 `7527c62544a8d92da376a166ad951a58ae4bc95056c603718c52c7980cd7d341`.
- `docs/sources/physics-2026-27/source-registry.json` — SHA256 `4cd13cba2663b8972f7ebea8172b47b9230442307c142e379477fe565ceb1e6a`.
- `/tmp/ardesia-exam-candidate-selection-2026-11-13.json` — SHA256 `bc180ca01c9d4f14cdab533384f60f5065cbc263256a1e4ad1f52de0dae0b04a`.

Artefatto strutturato: `/tmp/ardesia-exam-feedback-proposal-2026-11-13.json`.
