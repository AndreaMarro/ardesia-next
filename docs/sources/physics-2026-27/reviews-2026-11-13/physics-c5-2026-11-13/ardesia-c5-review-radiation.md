# Revisione scientifica indipendente C5: U7-02–U7-07

**Nessun P1/P2 individuato nel materiale esaminato.** I sei supplementi sono stati letti integralmente e confrontati con le verifiche finali e i problemi originali pertinenti. Il revisore non è autore di questi supplementi. Lo stato resta DRAFT: questa è una revisione tecnica mediante agente distinto, non un’approvazione scientifica umana o la certificazione del corso.

File: `/tmp/ardesia-c5-radiation/supplements.json`.
SHA-256: `70fe2450d66d69c8154fdfa2f59640f8c8fa8c490680f4b152e35fc2245fd4ae`.
Base per il controllo delle spiegazioni preservate: `18c6ad1f1d8b101f64f253d6915ec192587d39d1`.

| Unità | Caratteri aggiunta | Spiegazione con originale | Calcoli verificati |
| --- | ---: | ---: | ---: |
| U7-02 | 3292 | 5153 | 8 |
| U7-03 | 3440 | 4755 | 9 |
| U7-04 | 3560 | 4944 | 10 |
| U7-05 | 3701 | 5295 | 12 |
| U7-06 | 3804 | 5655 | 9 |
| U7-07 | 3745 | 5521 | 11 |

Totale: 21.542 caratteri nuovi; **59/59 controlli aritmetici passati** mediante AST limitato a costanti, operatori aritmetici e potenze, senza `eval`. Oltre a eseguire le espressioni consegnate, sono state ricalcolate quantità rappresentative con percorsi distinti e le funzioni matematiche effettive per logaritmi/esponenziali. Risultati integrali in `/tmp/ardesia-c5-review-radiation.json`; script `/tmp/ardesia-c5-review-radiation.py`.

## Verifiche scientifiche

- **U7-02:** conversioni GHz/µm/nm corrette. Le regioni spettrali si riferiscono a λ nel vuoto; 480 nm diventano 320 nm nel mezzo con n=1,5 senza cambiare frequenza o classificazione del canale. La distinzione fra raggi X e gamma non viene ridotta a una soglia energetica universale. La velocità nel mezzo è esplicitamente di fase.
- **U7-03:** distinti energia per fotone, energia dell’impulso, numero medio di fotoni, tasso e intensità. Il calcolo indipendente dà Eγ=3,0118·10⁻¹⁹ J e N≈3,9843·10¹²; il percorso energia per area × area restituisce lo stesso bilancio. Conteggio medio e precisione delle costanti sono dichiarati; energia incidente non equiparata automaticamente a energia assorbita.
- **U7-04:** μ=−ln(6/24)/0,8=1,73287 cm⁻¹, conversione in m⁻¹ corretta, x₁/₂=0,4 cm e I(1,2 cm)=3 W/m². Il cambio di base fra profondità ottica e assorbanza è corretto. I 7,2 mW assorbiti richiedono esplicitamente il caso aggiuntivo senza diffusione, riflessione o emissione: nessuna equivalenza indiscriminata fra attenuazione del fascio e deposito energetico.
- **U7-05:** legge statistica coerente per una specie iniziale senza produzione, con conteggi medi e attività separati. Ricalcolo con exp dà N(450)=16970,56275, A(450)=65,35054 Bq e 8485,28137 decadimenti nei successivi 180 s. L’approssimazione a tasso costante viene riconosciuta come sovrastima. Il successivo esempio ¹⁴C→¹⁴N+e⁻+antineutrino conserva numero di massa e carica ed è esplicitamente distinto dalla specie ipotetica con emivita di tre minuti.
- **U7-06:** confronto a un fotone riferito a specie/stati/canali espliciti; possibilità energetica distinta dalla probabilità di assorbimento. Energia cinetica 2,5 eV, velocità 9,376·10⁵ m/s e v/c≈0,003125 sono coerenti con rinculo trascurato e cinematica non relativistica. Le soglie in nm confermano il confronto; effetti multifotonici e successivi cambiamenti di stato sono esclusi dal modello, non negati in generale.
- **U7-07:** convenzione dei segni dichiarata e applicata correttamente: q=−36 cm, m=+3; dopo lo spostamento q=54 cm, m=−2. La descrizione dei raggi e dell’immagine virtuale è coerente. Da acqua ad aria sinθ₂=0,60; il caso 1,20 è correttamente riconosciuto fuori dal dominio del raggio propagante, oltre sinθc=0,75. Non viene negata l’esistenza del campo evanescente.

Gli esempi non riproducono letteralmente i prompt delle verifiche o dei problemi originali letti. I nuclei concettuali coincidono necessariamente con gli obiettivi insegnati: lo screening letterale e questa lettura non provano indipendenza semantica degli assessment, validità psicometrica o efficacia didattica misurata.

Non sono stati modificati file condivisi o pubblicati materiali. Nessuna conclusione su sicurezza clinica, dosi reali o prestazioni di apparati è stata inferita dai modelli didattici.
