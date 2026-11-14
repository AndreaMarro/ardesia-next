# Completamento dell’audit teorico — 14 novembre 2026

**Esito: una precisazione di ambito da correggere nell’ottica; nessun altro errore numerico o scientifico concreto identificato nel perimetro letto.** La correzione è stata segnalata e accettata dall’integratore; resta da integrare. Questa revisione AI non costituisce approvazione scientifica umana o certificazione di conformità ufficiale.

Sono state lette le **31 lezioni non comprese nelle sette del precedente audit**, completando la copertura dei contenuti teorici sostanziali delle 38 lezioni quando i due audit sono considerati insieme. Il file sorgente è `docs/sources/physics-2026-27/editorial/courses.json`, congelato con SHA-256 `e8d7544619576d352c774cc5ec68653fa8095a05e039ccb1b53be8958c59ab2a`.

Per ciascuna lezione sono stati letti titolo, obiettivo, prerequisiti, spiegazione, previsione, attività, feedback di riferimento, recupero e trasferimento. Non sono stati nuovamente auditati i 79 originali o i 200 assessment: le ripetizioni finali delle domande/risposte per obiettivo sono escluse dal conteggio di nuova lettura, così come gli elenchi finali di codici obiettivo. Gli scenari originali richiamati dentro le lezioni sono stati letti per coerenza del percorso, senza attribuire loro una nuova verifica indipendente del banco. Le precise regioni dei campi, esclusioni e hash sono registrate per ogni unità in `completed-reading.json`; non si presenta quindi ogni campo composito come integralmente riletto.

## TC-01 — restringere l’ipotesi di lente sottile alle relazioni della lente

Unità: `sf-2026-u7-07`, campo `explanation`.

Testo originale:
> Tutte queste leggi richiedono il modello geometrico, lente sottile e raggi vicini all’asse.

La frase si riferisce anche alle leggi di riflessione e rifrazione appena presentate. Snell e la riflessione non richiedono una lente sottile o raggi paraassiali; sono le relazioni della lente e dell’ingrandimento qui usate a richiedere quelle approssimazioni.

Correzione minima proposta:
> Le relazioni della lente e dell’ingrandimento qui usate richiedono il modello di lente sottile e raggi vicini all’asse; riflessione e rifrazione sono trattate nel modello dell’ottica geometrica.

Controprova già presente nella stessa lezione: un’interfaccia piana acqua–aria, senza alcuna lente, con n₁=4/3 e sin θ₁=0,90 richiede sin θ₂=1,20 secondo Snell e rivela riflessione totale interna. L’angolo incidente è circa 64,16°, quindi non paraassiale. I calcoli della lezione sono corretti; è l’ambito della frase introduttiva a essere troppo ampio. Evidenza strutturata e formulazione esatta: `finding-TC-01.json`.

## Controprove e controlli

`verify.py` registra **80 gruppi di ricalcoli, tutti passati, distribuiti su tutte le 31 unità**. Ogni gruppo è collegato a un passaggio testuale del sorgente congelato e specifica derivazione, unità e tolleranza. Le piccole energie e cariche sono confrontate con tolleranze relative, senza una grande tolleranza assoluta che possa accettare erroneamente zero.

Tra le verifiche: densità microscopica e conversione ng/µm³; moti a tratti e inversione; attrito con trazione obliqua; impulso triangolare e lavoro con segni diversi; momenti dell’avambraccio rispetto a due poli; riferimenti di pressione; Bernoulli e potenza idraulica; fusione completa/parziale e bilancio termico; lavoro e primo principio; campo e forza su cariche negative; energia del dielettrico con Q o V fissata; circuito misto con bilanci di corrente/potenza; orbita dell’elettrone; fase dell’onda e velocità locale; intensità/dB; tempi Doppler ricavati geometricamente; transito ottico e ampiezze di picco; fotoni per impulso; attenuazione e logaritmi; attività e conteggi su emivite frazionarie; immagini virtuali/reali e dominio di Snell.

Le note concettuali per ciascuna lezione sono in `completed-reading.json`; i risultati numerici completi sono in `numerical-checks.json`. L’audit non sostituisce una lettura umana né garantisce l’assenza di ogni difetto. Video e risorse esterne non sono stati riprodotti o revisionati integralmente. Nessun file del repository condiviso è stato modificato, nessun server avviato e nessun dato di produzione utilizzato.
