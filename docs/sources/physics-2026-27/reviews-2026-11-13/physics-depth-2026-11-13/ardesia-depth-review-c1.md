# Revisione scientifica indipendente C1 — 13 novembre 2026

**Esito finale: nessun P1/P2 aperto nel perimetro esaminato.**

Autore contenuti: `/root/curriculum`. Revisore: `/root/cortex`, riassegnato esclusivamente alla revisione C1; nessun lavoro su Cortex e nessuna approvazione del proprio C4. Root unico autore delle integrazioni nel repository. Questa è una revisione AI non autrice, non approvazione scientifica umana.

## Identità e perimetro

- Base precedente: `22e06d9`.
- Letti integralmente i nove approfondimenti C1, relativi esempi, ipotesi, errori tipici e controlli; confrontati con spiegazioni e verifiche finali.
- Prima revisione: `/tmp/ardesia-depth-c1/supplements.json`, SHA-256 `67f76e48cbb7728eeb37c30f0ccdbdfd362532e4504ae485e15e84c83c938c3a`.
- Revisione finale corretta: medesimo file, SHA-256 `8b0119251f903938706cec48ee58fa77e4b07cb4ac1dea320d360f779fe8837c`.
- Tutte le nove aggiunte finali sono presenti verbatim una sola volta nelle spiegazioni condivise. I prefissi di teoria ed esempi della base precedente restano conservati. Hash delle singole aggiunte e delle spiegazioni integrate: `/tmp/ardesia-depth-review-c1-final.json`.

## Rilievi risolti

1. **P2, U1-02: coordinate e grandezze scalari.** L'esempio «una coordinata» nel paragrafo sugli scalari poteva confondere una componente dipendente dagli assi con una grandezza scalare invariante rispetto alle rotazioni. Sostituito con «un’energia potenziale o una variazione di temperatura». Riletto nella copia finale e nel sorgente condiviso.
2. **P2, U2-03: ambiguità fra distanza e unità di tempo.** «1,0 N·s=1,00 J» intendeva s come spazio percorso, ma appariva come uguaglianza fra unità di impulso ed energia. Ora il testo usa `F_attr·d=1,00 J`, dichiara d distanza e scrive `K=(1,00 J)−(1,0 N)d`. Riletto nella copia finale e nel sorgente condiviso.
3. Uniformate anche le tuple di U1-04 con punto e virgola: `(6;−2)`, `(−1;5)`, `(5;3)`. Evitata l'ambiguità con la virgola decimale italiana. Nessun cambiamento ai risultati.

## Verifiche indipendenti

**56/56 controlli numerici superati**, ricalcolati con parser AST limitato a costanti e operazioni aritmetiche, senza eseguire codice del testo. Verifica ripetuta sulla revisione finale. Nessuna domanda finale riprodotta esattamente negli approfondimenti dopo normalizzazione Unicode/spazi.

Ricalcoli separati dai controlli dell'autore confermano:

| Argomento | Controllo fisico | Risultato |
|---|---|---|
| Notazione | Massa netta / massa del granulo; ricostruzione massa lorda | 5000 granuli |
| Unità e densità | Conversione indipendente dei tre lati in SI e massa in kg | 1100 kg/m³ |
| Trigonometria | Equilibrio delle componenti verticali delle due tensioni | 8,6603 N per fune |
| Vettori | Somma delle componenti, prodotto scalare e area orientata | √34 mm, −16 mm², +28 mm² |
| Cinematica | Aree di trapezio/rettangolo/triangolo in v(t); controllo frenata | 18 m, 7 s; lancio: quota massima 0,8 m |
| Dinamica | Normale ridotta dalla fune; soglia statica prima di attrito dinamico | N=30 N, a=2,4551 m/s² |
| Energia | Energia elastica meno lavoro d'attrito; controllo in due tratti | K=0,70 J, v=1,6733 m/s; arresto a 1 m |
| Impulso | Area triangolare e quantità di moto con segno | J=3,60 N·s, v finale +2 m/s |
| Corpi estesi | Momenti al gomito e controprova rispetto alla mano | T=540 N, R_y=−220 N, R_x=467,654 N |

I segni del lavoro e dell'impulso sono distinti correttamente. Il moto sotto forza positiva può avere lavoro netto negativo se la velocità iniziale è negativa e diminuisce il modulo finale. L'esempio di separazione dei carrelli conserva la quantità di moto e attinge all'energia elastica interna, senza imporre una falsa conservazione della sola energia cinetica. Il contatto unilaterale con la molla, la condizione d'avvio contro attrito statico, le accelerazioni valide soltanto per tratto, i bracci perpendicolari e il carattere ideale della leva anatomica sono dichiarati.

Le spiegazioni integrate misurano 4552–5588 caratteri, tutte sotto 10000. Non ho modificato repository, servizi o coda.

## Limiti

Il controllo riguarda questi nove approfondimenti e la loro conservazione nel sorgente editoriale. Non certifica l'intera banca quiz, l'efficacia didattica su studenti, una revisione umana, la resa browser o l'avvenuta rigenerazione/distribuzione dei pacchetti. La verifica dell'assenza di copie è lessicale; gli esempi insegnano intenzionalmente i concetti poi richiesti nelle verifiche. Non attesta indipendenza psicometrica o sicurezza di un esame.
