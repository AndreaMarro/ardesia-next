# Selezione preparatoria di 31 quesiti legacy — 13 novembre 2026

Stato **DRAFT**, `humanApproval: false`. HEAD `8fbebc1e9e40ffd3e0c9210323a036560cf5b9d1`. Selezionati **21 quesiti a cinque alternative e 10 completamenti numerici**: tutti già presenti nel patrimonio legacy, nessun quesito nuovo. Coprono C1–C5 e U1–U7 con distribuzione editoriale, non pesi ministeriali.

Controllo AI di prompt, cinque alternative/chiave ove presenti e ragionamento fisico di tutti i 31 candidati; **38 ricalcoli aritmetici esatti** mediante AST limitato a costanti e operatori, tutti concordi. Una soluzione legacy richiede la correzione di un rinvio all’ordine delle opzioni. Non è approvazione scientifica umana o equivalenza psicometrica a un esame.

La ricevuta istituzionale già ottenuta da Sapienza conferma per il 2026/27 31 quesiti, 21 a scelta con cinque alternative, 10 completamenti, 50 minuti, +1/−0,10/0. È stata letta la ricevuta locale: nessun nuovo accesso web. Essa descrive i completamenti come una parola mancante e non documenta normalizzazione di numeri/frazioni/unità: **i dieci numerici qui scelti sono allenamento editoriale**, non un correttore ufficiale. I decreti citati dalla guida non sono stati direttamente letti.

## Distribuzione editoriale

| Corso | Scelta | Completamento | Totale |
|---|---:|---:|---:|
| C1 | 6 | 2 | 8 |
| C2 | 3 | 2 | 5 |
| C3 | 4 | 2 | 6 |
| C4 | 3 | 2 | 5 |
| C5 | 5 | 2 | 7 |

| Unità syllabus | Scelta | Completamento | Totale |
|---|---:|---:|---:|
| U1 | 2 | 1 | 3 |
| U2 | 4 | 1 | 5 |
| U3 | 3 | 2 | 5 |
| U4 | 2 | 1 | 3 |
| U5 | 4 | 2 | 6 |
| U6 | 3 | 2 | 5 |
| U7 | 3 | 1 | 4 |

Rappresentate 26/38 lezioni; non si dichiara verifica di tutti i 200 obiettivi. Mapping completo e hash dei record nel JSON. Le collocazioni ripetute vengono contate una sola volta.

## Candidati e controllo ragionato

### 1. `u1-scalar-product-03` — C1, sf-2026-u1-04

**Tipo:** multiple_choice. **Chiave:** A — Zero.

**Ipotesi:** Due vettori non nulli, perpendicolari; prodotto scalare euclideo.

**Ricontrollo:** A·B=|A||B|cos90°=0. Gli altri tre scalari proposti non sono nulli per moduli positivi; E è un vettore e risponde a un’altra operazione. Unità: prodotto delle unità dei vettori; lo zero non richiede una loro scelta.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 2. `u1-scientific-scale-03` — C1, sf-2026-u1-01

**Tipo:** multiple_choice. **Chiave:** B — 20.

**Ipotesi:** Rapporto primo tempo/secondo; entrambi in secondi.

**Ricontrollo:** (4/2)·10^(−3+4)=20; verifica inversa: 20·0,0002 s=0,004 s. Le alternative 2 e 200 sbagliano l’esponente, 1/20 inverte il rapporto. Adimensionale, s/s.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 3. `u2-center-mass-weighted-03` — C1, sf-2026-u2-05

**Tipo:** multiple_choice. **Chiave:** C — Con velocità costante, eventualmente nulla.

**Ipotesi:** Sistema dei due corpi e interazione interna elastica; risultante esterna orizzontale nulla. Riferimento inerziale della meccanica ordinaria.

**Ricontrollo:** M a_CM,x=F_ext,x=0: velocità orizzontale costante, anche non nulla. Le oscillazioni relative non obbligano il centro di massa a oscillare. Velocità in m/s; accelerazione in m/s².

**Limite/ambiguità:** Il riferimento inerziale è implicito nel contesto della lezione, non esplicitato nel prompt.

### 4. `u2-static-threshold-03` — C1, sf-2026-u2-02

**Tipo:** multiple_choice. **Chiave:** E — 4 N.

**Ipotesi:** Blocco fermo; solo spinta e attrito in orizzontale; massimo statico 10 N.

**Ricontrollo:** Equilibrio: F_attr=-4 N rispetto al verso della spinta; modulo 4 N, sotto la soglia di 10 N. L’uguaglianza al massimo non vale prima dello scorrimento. N.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 5. `u2-mean-velocity-03` — C1, sf-2026-u2-01

**Tipo:** multiple_choice. **Chiave:** B — 0 m/s e 3 m/s.

**Ipotesi:** Andata 6 m e ritorno 6 m sullo stesso asse; durata totale 4 s.

**Ricontrollo:** Spostamento nullo dà modulo della velocità media 0 m/s; distanza 12 m dà rapidità media 3 m/s. Solo B presenta entrambi nell’ordine richiesto. m/s per entrambe le grandezze.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 6. `u2-inelastic-rest-03` — C1, sf-2026-u2-04

**Tipo:** multiple_choice. **Chiave:** C — La quantità di moto totale.

**Ipotesi:** Sistema dei due corpi; impulso esterno trascurabile durante l’urto; corpi uniti dopo.

**Ricontrollo:** Δp_tot=J_ext≈0. La quantità di moto dei singoli cambia per gli impulsi interni; K_tot può diminuire. L’energia totale non figura tra le alternative e non va confusa con K. Quantità di moto in kg·m/s.

**Limite/ambiguità:** Conservazione esatta nel modello J_ext=0; nel testo il termine trascurabile indica questa approssimazione.

### 7. `u3-archimedes-force-03` — C2, sf-2026-u3-02

**Tipo:** multiple_choice. **Chiave:** D — Resta uguale se volume e densità del liquido non cambiano..

**Ipotesi:** Corpo rigido interamente immerso, densità del liquido e g costanti, nessun contatto.

**Ricontrollo:** F_A=ρgV resta costante. Spostarsi in profondità aggiunge pressioni maggiori su tutte le superfici senza variare il peso del volume spostato. Non si può dedurre F_A=mg del corpo. ρgV: kg/m³·m/s²·m³=N.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 8. `u3-poiseuille-flow-08` — C2, sf-2026-u3-04

**Tipo:** multiple_choice. **Chiave:** C — 1/4.

**Ipotesi:** Tubo rigido cilindrico, fluido newtoniano incomprimibile, laminare sviluppato; Q e η fissi; r raddoppia, L quadruplica.

**Ricontrollo:** Δp=8ηLQ/(πr⁴): rapporto 4/2⁴=1/4. Controllo: (r_n/r_i)^4·(Δp_n/Δp_i)/(L_n/L_i)=1 mantiene Q. Rapporto adimensionale; ηLQ/r⁴ ha unità Pa.

**Limite/ambiguità:** La soluzione legacy elenca cm, mPa·s e cm³/s: per valori assoluti occorrerebbe conversione coerente, mentre il rapporto qui richiesto cancella i fattori.

### 9. `u3-hydraulic-force-03` — C2, sf-2026-u3-02

**Tipo:** multiple_choice. **Chiave:** C — L’uscita percorre un decimo della corsa d’ingresso..

**Ipotesi:** Pressa ideale senza perdite, moto lento, liquido incomprimibile, pistoni alla stessa quota/riferimento di pressione.

**Ricontrollo:** F_o/F_i=A_o/A_i=10; A_i s_i=A_o s_o implica s_o/s_i=1/10. Verifica lavoro: (F_o/F_i)(s_o/s_i)=1. Rapporti adimensionali; F·s in J.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 10. `u4-wave-phase-time-03` — C5, sf-2026-u4-01

**Tipo:** multiple_choice. **Chiave:** B — 5/2 Hz.

**Ipotesi:** Periodo T=2/5 s, oscillazione periodica.

**Ricontrollo:** f=1/T=5/2 Hz. In 2 s avvengono 5 cicli: controllo indipendente rispetto all’inversione della frazione. Hz=s⁻¹.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 11. `u4-coherent-constructive-06` — C5, sf-2026-u4-02

**Tipo:** multiple_choice. **Chiave:** A — 1/49.

**Ipotesi:** Stessa frequenza e polarizzazione, mezzo lineare; ampiezze 3 e 4 mm; fase relativa da 0 a π; I proporzionale ad A² nel confronto.

**Ricontrollo:** A_i=7 mm e |A_f|=1 mm. I_f/I_i=(1/7)²=1/49; intensità non nulla perché ampiezze diverse. Le alternative 1/7 e 49 confondono quadrato o ordine. Rapporto d’intensità adimensionale.

**Limite/ambiguità:** L’intensità è definita esplicitamente proporzionale ad A²: non generalizzare questa formula a geometrie di interferenza non dichiarate.

### 12. `u5-latent-heat-03` — C3, sf-2026-u5-02

**Tipo:** multiple_choice. **Chiave:** A — Il calore fornito cambia la frazione liquida mentre la temperatura resta costante..

**Ipotesi:** Sostanza pura in equilibrio solido-liquido, pressione fissata, temperatura di fusione, nessuna reazione.

**Ricontrollo:** Finché coesistono le fasi, il calore trasforma massa solida in liquida mantenendo T costante. Q=m_fusa L non è mcΔT; energia può essere trasferita con ΔT=0. Q in J, L in J/kg se massa in kg.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 13. `u5-ideal-gas-pressure-03` — C3, sf-2026-u5-01

**Tipo:** multiple_choice. **Chiave:** E — No: il calore dipende anche dal percorso e dal lavoro scambiato..

**Ipotesi:** Gas ideale chiuso, stati estremi di equilibrio; lavoro del gas positivo; variazioni cinetiche/potenziali macroscopiche nulle.

**Ricontrollo:** Q=ΔU+W. Gli estremi fissano ΔU per il campione ideale, ma W dipende dal percorso. Una isoterma reversibile e una libera espansione isolata possono collegare gli stessi T e volumi con Q diversi. Q, ΔU, W in J; pV ha unità di energia ma non identifica Q.

**Limite/ambiguità:** La composizione/quantità del campione resta quella del sistema chiuso nel modello ordinario.

### 14. `u5-entropy-hot-cold-03` — C3, sf-2026-u5-05

**Tipo:** multiple_choice. **Chiave:** E — Perché ogni joule trasferito produce una variazione di entropia maggiore alla temperatura più bassa..

**Ipotesi:** Due sorgenti ideali a T_h>T_c>0 costanti; Q=600 J dal caldo al freddo; nessun altro scambio.

**Ricontrollo:** ΔS_tot=600(1/T_c−1/T_h)>0, mentre ΔE_tot=−600+600=0. Il freddo guadagna più entropia in modulo di quanta ne perda il caldo. Entropia in J/K, non J; temperature assolute.

**Limite/ambiguità:** Il verbo produce nell’alternativa E va letto come variazione per la singola sorgente: la produzione irreversibile è il totale positivo.

### 15. `u5-net-blackbody-exchange-03` — C3, sf-2026-u5-03

**Tipo:** multiple_choice. **Chiave:** D — Entrambi emettono e assorbono, ma la potenza netta scambiata è zero..

**Ipotesi:** Superficie nera piccola circondata da grande ambiente nero; stessa T assoluta positiva; assorbività/emissività 1.

**Ricontrollo:** P_em=σAT⁴>0; nel modello P_ass=P_em, dunque P_net=0. Equilibrio non significa cessazione dell’emissione. P in W; σAT⁴ ha unità W.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 16. `u6-lorentz-force-03` — C4, sf-2026-u6-06

**Tipo:** multiple_choice. **Chiave:** D — Il modulo della velocità e quindi l’energia cinetica.

**Ipotesi:** Particella soggetta soltanto alla forza di un campo magnetico uniforme e statico nel modello classico della lezione.

**Ricontrollo:** F=q v×B è perpendicolare a v, quindi P=F·v=0 e K non cambia; resta costante il modulo di v, non necessariamente il vettore. Solo D vale in generale anche per moto obliquo. Potenza in W; energia cinetica in J.

**Limite/ambiguità:** La soluzione legacy termina richiamando erroneamente la seconda opzione come errore velocità vettoriale: quella frase è imprecisa rispetto all’ordine A–E. Chiave D e ragionamento fisico sono corretti; correggere il rinvio editoriale prima di mostrare integralmente la soluzione. Radiazione/reazione di radiazione fuori dal modello dichiarato.

### 17. `u6-plane-capacitance-03` — C4, sf-2026-u6-03

**Tipo:** multiple_choice. **Chiave:** A — Il campo elettrico è nullo.

**Ipotesi:** Interno del materiale di un conduttore in equilibrio elettrostatico, non una cavità o il dielettrico fra armature.

**Ricontrollo:** Un campo interno non nullo muoverebbe le cariche libere, contraddicendo l’equilibrio. E=0; V è costante ma non obbligatoriamente zero. Campo in N/C oppure V/m; potenziale in V.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 18. `u6-faraday-average-emf-03` — C4, sf-2026-u6-07

**Tipo:** multiple_choice. **Chiave:** C — È diretto dalla spira lontano dall’osservatore, per opporsi all’aumento del flusso.

**Ipotesi:** Spira conduttrice; flusso verso l’osservatore crescente. Si intende il contributo del campo indotto attraverso la superficie della spira.

**Ricontrollo:** Per Lenz il flusso indotto si oppone all’aumento: contributo lontano dall’osservatore. Mano destra: corrente oraria vista dall’osservatore. Se il flusso diminuisse, il verso sarebbe opposto. Flusso in Wb; dΦ/dt in V.

**Limite/ambiguità:** Il verso si riferisce al campo attraverso la spira, non a ogni punto dello spazio esterno: una precisazione utile nella futura presentazione.

### 19. `u7-photon-rate-power-03` — C5, sf-2026-u7-06

**Tipo:** multiple_choice. **Chiave:** A — La sua energia hf, quindi la frequenza, confrontata con l’energia richiesta dal processo.

**Ipotesi:** Assorbimento a un solo fotone; confronto del requisito energetico per togliere un elettrone, senza pretesa di probabilità unitaria di assorbimento.

**Ricontrollo:** Eγ=hf deve almeno raggiungere la soglia energetica. Più fotoni alla stessa frequenza non aumentano l’energia del singolo; processi multifotonici sono esclusi dal prompt. h in J·s e f in s⁻¹ danno J.

**Limite/ambiguità:** Condizione energetica necessaria nel modello, non garanzia di un evento per ogni fotone.

### 20. `u7-thin-lens-real-image-03` — C5, sf-2026-u7-07

**Tipo:** multiple_choice. **Chiave:** E — Virtuale, diritta e ingrandita, sullo stesso lato dell’oggetto.

**Ipotesi:** Lente sottile convergente, oggetto reale con 0<p<f, modello parassiale.

**Ricontrollo:** 1/q=1/f−1/p<0: immagine virtuale sul lato dell’oggetto. m=−q/p=f/(f−p)>1: diritta e ingrandita. Controllo p=f/2 dà q=−f e m=2. p,q,f in una stessa unità di lunghezza; ingrandimento adimensionale.

**Limite/ambiguità:** La convenzione di segno è esplicitata qui nel controllo; il prompt descrive la posizione geometricamente senza dipendere da una notazione.

### 21. `u7-beta-minus-atomic-number-03` — C5, sf-2026-u7-05

**Tipo:** multiple_choice. **Chiave:** D — Un neutrone si trasforma in protone e vengono emessi un elettrone e un antineutrino elettronico.

**Ipotesi:** Decadimento nucleare β⁻.

**Ricontrollo:** n→p+e⁻+antineutrino elettronico: carica 0=+1−1+0 in unità e; A invariato e Z aumenta di 1. Non è rimozione di un elettrone orbitale né emissione alfa. A,Z conteggi adimensionali; carica in multipli di e.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 22. `u1-area-conversion-01` — C1, sf-2026-u1-02

**Tipo:** completion. **Chiave:** 8 1.

**Ipotesi:** A=2 valore numerico dell’area; una vecchia unità lineare contiene c=2 nuove unità lineari.

**Ricontrollo:** Ogni vecchia cella quadrata contiene 2²=4 nuove celle: B=2·4=8. Controllo inverso: B/c²=2. La chiave unit=1 riguarda il valore numerico B, non afferma che l’area fisica sia adimensionale.

**Limite/ambiguità:** La formulazione «in 1» è poco naturale ma il prompt distingue esplicitamente valore numerico e area fisica.

### 23. `u2-gravitational-energy-01` — C1, sf-2026-u2-03

**Tipo:** completion. **Chiave:** 40 J.

**Ipotesi:** m=2 kg, aumento di quota h=2 m, g=10 m/s² uniforme; incremento di energia potenziale rispetto all’inizio.

**Ricontrollo:** ΔU=mgh=40 J. La gravità compie −40 J durante la salita, non +40 J; verifica ΔU/h=mg=20 N. kg·m²/s²=J.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 24. `u3-bernoulli-height-speed-01` — C2, sf-2026-u3-03

**Tipo:** completion. **Chiave:** 12 kPa.

**Ipotesi:** Grande serbatoio, v iniziale trascurabile, fluido ideale senza perdite; getto h=1 m sopra la superficie, v=2 m/s; ρ=1000 kg/m³ e g=10 m/s².

**Ricontrollo:** p_serb−p_getto=ρgh+ρv²/2=10000+2000=12000 Pa=12 kPa. Entrambi i termini sono positivi perché il fluido sale e accelera. Ogni termine in Pa; divisione per 1000 per kPa.

**Limite/ambiguità:** Si usa Bernoulli lungo la linea di flusso nel modello ideale/quasi stazionario; la superficie del serbatoio può essere pressurizzata, non è obbligatoriamente aperta all’atmosfera.

### 25. `u3-apparent-weight-01` — C2, sf-2026-u3-02

**Tipo:** completion. **Chiave:** 20 N.

**Ipotesi:** Corpo di m=3 kg e volume esterno 1 L, interamente immerso in acqua 1 kg/L, fermo, filo verticale, g=10 m/s².

**Ricontrollo:** Spinta=1 kg·10 m/s²=10 N. T=mg−F_A=30−10=20 N. Controllo T+F_A=30 N; tensione positiva perché densità del corpo maggiore. 1 L=10⁻³ m³, 1 kg/L=1000 kg/m³; N.

**Limite/ambiguità:** Modello ordinario di corpo libero nel liquido sostenuto dal filo, senza ulteriori contatti: un contatto con il fondo introdurrebbe una forza non prevista.

### 26. `u4-wave-phase-space-01` — C5, sf-2026-u4-01

**Tipo:** completion. **Chiave:** 1/4 giri.

**Ipotesi:** Onda armonica, confronto simultaneo lungo la propagazione; Δs=1 m e λ=4 m; differenza prima del modulo di un giro.

**Ricontrollo:** ν=|Δφ|/(2π)=Δs/λ=1/4 giro. Una separazione di una λ deve dare 1 giro: il rapporto soddisfa questo controllo di scala. Giri, non radianti; lunghezze nella stessa unità.

**Limite/ambiguità:** Qui il simbolo ν indica numero di giri di fase, non frequenza: è definito esplicitamente nel testo.

### 27. `u5-calorimeter-capacity-01` — C3, sf-2026-u5-02

**Tipo:** completion. **Chiave:** 40 °C.

**Ipotesi:** Due porzioni da 2 g con c=1 J/(g K), inizialmente 80 e 20 °C; recipiente C=2 J/K a 20 °C, sistema isolato, nessun cambio di fase.

**Ricontrollo:** Capacità calda 2 J/K, fredda+recipiente 4 J/K. T_f=(2·80+4·20)/6=40 °C; caldo cede 80 J, freddo+recipiente assorbono 80 J. Differenze di °C equivalgono a K; C in J/K, T finale in °C.

**Limite/ambiguità:** Le capacità sono costanti nel modello del testo; non sommare masse e capacità senza prima moltiplicare per c.

### 28. `u5-first-law-expansion-01` — C3, sf-2026-u5-04

**Tipo:** completion. **Chiave:** 60 J.

**Ipotesi:** Sistema chiuso, Q=100 J entrante, W=40 J fatto dal sistema; variazioni di energia cinetica/potenziale macroscopica nulle.

**Ricontrollo:** ΔU=Q−W=60 J; controllo conservativo ΔU+W=Q=100 J. Scambiare lavoro sul sistema e lavoro fatto dal sistema cambierebbe il segno. J.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 29. `u6-current-charge-time-01` — C4, sf-2026-u6-04

**Tipo:** completion. **Chiave:** 3 A.

**Ipotesi:** Carica positiva trasferita Q=6 mC, intervallo 2 ms; corrente media e verso coerente con il trasferimento.

**Ricontrollo:** I_media=0,006 C/0,002 s=3 A. Non serve corrente istantanea costante. Controllo 3 A·2 ms=6 mC. C/s=A; milli si cancella nel rapporto.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 30. `u6-coulomb-force-01` — C4, sf-2026-u6-01

**Tipo:** completion. **Chiave:** 10 N.

**Ipotesi:** Cariche puntiformi positive entrambe 1 μC, distanza 3 cm; k=9·10⁹ N·m²/C², vuoto/aria come vuoto.

**Ricontrollo:** F=kQq/r²=(9·10⁹)(10⁻⁶)²/(0,03)²=10 N. Forza repulsiva; il prompt chiede soltanto il modulo. SI: coulomb e metri prima del quadrato; N.

**Limite/ambiguità:** Nessuna ambiguità decisiva identificata nel controllo circoscritto.

### 31. `u7-radioactive-activity-01` — C5, sf-2026-u7-05

**Tipo:** completion. **Chiave:** 7 Bq.

**Ipotesi:** Un solo radionuclide, N=20 nuclei, emivita 2 s; ln2 approssimato a 0,7 come esplicitamente prescritto.

**Ricontrollo:** λ≈0,7/2=0,35 s⁻¹ e A=λN≈7 Bq. Valore atteso istantaneo all’N assegnato, non numero certo di eventi in un successivo secondo. Il valore 7 è esatto solo nel modello numerico approssimato indicato. Bq=s⁻¹ per il tasso atteso di decadimento.

**Limite/ambiguità:** «Attività media» indica tasso atteso statistico, non media temporale sull’intervallo di emivita; campione piccolo implica fluttuazioni importanti.

## Esclusioni e cautele prima dell’implementazione

- `u3-capillary-rise-01`: scope sorgente `provided_law_extension`, escluso.
- `u3-capillary-rise-07`: scope sorgente `provided_law_extension`, escluso.
- `u3-droplet-fragmentation-01`: scope sorgente `provided_law_extension`, escluso.
- `u5-adiabatic-monatomic-01`: scope sorgente `provided_law_extension`, escluso.

Non selezionati dopo lettura: Doppler `u4-beats-envelope-03` (ipotesi cinematiche meno esplicite), dielettrico collegato `u6-dielectric-connected-charge-03` (tensione non nulla/effetto del dielettrico impliciti), conduzione `u5-plane-conduction-03` (la soluzione introduce una geometria non data). Le sostituzioni sono nella lista finale; nessuna sorgente è stata modificata.

Per `u6-lorentz-force-03` la chiave D e la fisica sono corrette; la frase finale della soluzione legacy richiama «la seconda opzione» per una confusione sul vettore velocità, ma la seconda alternativa riguarda la posizione. Prima di riusare integralmente quella soluzione va eliminato/corretto il rinvio. Nessun cambio effettuato ora.

Il futuro allenamento dovrà definire esplicitamente formato numerico, frazioni/decimali, unità, risposta omessa e input invalido. I valori `accepted` sono metadati legacy, non un algoritmo verificato. Alcuni contengono duplicati. Nessuna tolleranza, procedura di esame, punteggio, salvataggio o timer è implementato da questo incarico.

La lista non è nuova né segreta: i quesiti possono essere già incontrati nei minicorsi. Il rapporto contiene chiavi per preparazione tecnica e non è il documento da mostrare durante una prova cieca. La durata di svolgimento non è stata calibrata su studenti.

## Hash e riproduzione

- `docs/sources/physics-2026-27/editorial/bank-selection.json` — SHA256 `fdd548b9e404d40613560e150959198d4477fef8fbf1e5ec24e4116d4eab46f4` (2295231 byte).
- `docs/sources/physics-2026-27/coverage.json` — SHA256 `018e320595808d61f8982ccbfef93565e47486e576dd8d850c749a330587c13e` (189258 byte).
- `docs/sources/physics-2026-27/editorial/units.json` — SHA256 `5e9f6c350b7bf3f1bdf86a988028c392ab0e4fefe906d7fe3f67da4925587245` (41081 byte).
- `docs/sources/physics-2026-27/editorial/courses.json` — SHA256 `7527c62544a8d92da376a166ad951a58ae4bc95056c603718c52c7980cd7d341` (419571 byte).
- `docs/sources/physics-2026-27/source-registry.json` — SHA256 `4cd13cba2663b8972f7ebea8172b47b9230442307c142e379477fe565ceb1e6a` (4728 byte).
- `/tmp/ardesia-exam-rules-recheck-2026-11-13.md` — SHA256 `f3103d3f7437611c5547cb5841063d65f64dc7ecd0ebb836daf9733a338ee83f` (4057 byte).
- `/tmp/ardesia-exam-rules-recheck-2026-11-13.json` — SHA256 `de2c70a17bb3f007134cd3f9efe83b36dd27614abecc79338d44dace0361cf93` (7025 byte).
- `/tmp/ardesia-exam-inventory-2026-11-13.md` — SHA256 `d15fdddef2e7d8ae36100be84939e5396e44a8123a2706a6205667987ce57813` (10363 byte).

Ricevuta strutturata: `/tmp/ardesia-exam-candidate-selection-2026-11-13.json`. Riproduzione dei soli controlli locali: `python3 /tmp/ardesia-exam-candidate-selection-build-2026-11-13.py`. Lo script legge blob con `git show` alla HEAD fissata e scrive soltanto i due rapporti `/tmp`; non esegue espressioni provenienti dal repository.
