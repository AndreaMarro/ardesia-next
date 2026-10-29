# Design e verifica M0

Direzione adottata dal coordinatore: B03/B04 per la lavagna, A01 per gerarchie di lettura,
G01 per la continuità degli stessi oggetti. Tutte le 36 anteprime dell'atlante sono state
ispezionate; non sono schermate del prodotto distribuito. Il concept successivo è una guida,
non una funzionalità o un'approvazione dell'utente.

Token di produzione: superfici `#ffffff`, sfondo `#f5f7fa`, testo `#192a3e`, primario `#203e62`,
sage `#638575`, nota `#f2e9ce`. Font di sistema per i comandi e serif di sistema per il contenuto.
Nessun font remoto necessario, immagini decorative o bitmap usate al posto dei controlli.

## Confronto concept e rendering

Il concept 1536×1024 e il rendering Chromium alla stessa risoluzione sono stati aperti e
confrontati visivamente. Il browser collegato non può raggiungere il server locale; il fallback
locale è Playwright Chromium. La verifica del deployment nel browser autenticato è separata.

| Punto | Esito e decisione |
| --- | --- |
| Layout | Rail compatta, area lavagna prevalente, inspector chiudibile. Non tre colonne obbligatorie. |
| Colori | Token espliciti; nessun neon o gradiente aggiunto. Nota leggibile su fondo amber tenue. |
| Tipografia | Gerarchia editoriale per titolo e oggetti, controlli con dimensione esplicita. Le forme dei glifi possono variare con i font di sistema. |
| Contenuto | Titolo, domanda, formula, fonte e tabs ripresi dal concept; la bozza è esplicitamente personale. |
| Oggetti | Note, formule e fonti sono HTML/SVG/MathML reali; nessuna screenshot cliccabile. |
| Inspector | Aggiunti editor LaTeX e salvataggio esplicito per rendere il controllo effettivo. Provenienza e stato DRAFT reali. |
| Salvataggio | Messaggio device-only; stato dirty visibile e guard di navigazione. Nessun claim di sincronizzazione. |
| Fonti e oggetti | Corretto il ritorno a capo della testata; selezione riapre lo stesso ID. |
| Piccoli schermi | Lista compatta con ordine spaziale di lettura, toolbar e navigazione inferiori; nessun overflow orizzontale della pagina nei test. |

Deviazioni intenzionali dal concept: la UI spiega che la bozza resta nel browser; i controlli
LaTeX, storia ed export hanno azioni reali; la sezione Moduli mostra un limite esplicito;
la penna è disponibile nella lavagna ampia, mentre il layout mobile compatto mostra e modifica
gli oggetti ma non crea tratti. Il posizionamento delle annotazioni su una proiezione mobile
richiede un modello di ancoraggio dedicato prima di abilitarlo. Nessuna prova fisica con
Apple Pencil, touch o mouse dell'utente è dichiarata.

La selezione in mobile usa un inspector sovrapposto chiudibile. L'editor e il reader condividono
gli oggetti e non ricreano documenti. I test desktop/mobile conservano screenshot fra le prove CI.

## Limiti dell'accettazione

Il confronto tecnico ha verificato layout, copy, palette, tipografia, componenti, fonti e
interazioni. Non equivale all'accettazione UX/pedagogica umana M5. Restano da verificare
contrasto con audit automatico dedicato, screen reader reali, penna e touch fisici, Safari,
prestazioni e carichi reali. I criteri D01–D68 non vengono promossi a PASS per analogia.
