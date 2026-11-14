# Dipolo: potenziale nullo, campo non nullo

## Style Prompt
Una tavola di fisica continua, calma e leggibile, coerente con Ardesia. Il foglio avorio e Georgia richiamano un quaderno scientifico; il sans di sistema rende leggibili cifre e istruzioni. Le cariche restano ferme e P non cambia posizione: il movimento serve a introdurre prima la somma di scalari e poi i contributi vettoriali. Nessun taglio promozionale, nessuna telecamera o simulazione di moto delle cariche.

## Colors
- `#f6f3ea`: fondo e interno dei simboli di carica.
- `#203c35`: testo, geometria neutra e campo risultante.
- `#b54829`: carica positiva e relativo contributo.
- `#376784`: carica negativa e relativo contributo.
I separatori derivano dal verde principale mediante alpha; nessun altro colore informativo.

## Typography
- Georgia per il titolo didattico e le formule simboliche: registro concettuale.
- `-apple-system, BlinkMacSystemFont, system-ui, sans-serif` per istruzioni e numeri: registro operativo. Cifre tabulari.
Titolo 76px; risultati 52–64px; formule e dati 32–42px; note 22–24px. Peso Georgia 400, risultati sans 800. Font di sistema deliberatamente scelti per coerenza con il prodotto; nessun font web scaricato o redistribuito.

## Layout
1920×1080, 38 secondi, 30fps. Margini 88px orizzontali. Una sola composizione: testata; domanda; assunzioni; diagramma simmetrico +q / P / −q; due colonne di calcoli; conclusione e invito al laboratorio. Le colonne sono regioni didattiche con una riga di separazione, non schede decorative. Il campo risultante nasce esattamente in P. I contributi di campo sono in legenda: non vengono disegnati con origini traslate nel diagramma fisico.

## Timing and motion
0–6s: contesto e distanze; 6–16s: somma scalare; 16–25s: contributi di campo diretti entrambi a destra; 25–30s: risultante; 30–38s: regola generale e invito al laboratorio. Entrate brevi, con ease diverse e spostamenti contenuti. La freccia risultante si estende da P. I lunghi fermi sono intenzionali per la lettura, non ambient motion. Sfondo e geometria restano fermi per non suggerire fenomeni fisici inesistenti.

## What NOT to Do
- Non spostare P, non suggerire che le cariche o le frecce siano traiettorie.
- Non disegnare frecce dei contributi in punti diversi fingendo che rappresentino il campo lì.
- Non usare neon, gradienti, transizioni commerciali, conteggi veloci o musica distraente.
- Non omettere V(∞)=0, mezzo ideale nel vuoto o arrotondamento dei valori.
- Non equiparare potenziale nullo a campo nullo; non sommare moduli con segni arbitrari.
- Non affermare che il video sia una simulazione interattiva o una revisione scientifica umana.

## Registry choice
Registro Hyperframes consultato il 14 novembre 2026: nessun blocco dipolo/fisica/equazione. Il componente `hw-arrow` è decorativo e non adatto alla precisione delle origini vettoriali. Diagramma SVG originale costruito per questa spiegazione; nessun asset del registro installato.
