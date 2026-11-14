# Quaderno degli esperimenti C1-C5

Sette pagine originali: cinque schede da annotare (previsione, osservazione, trasferimento) e due pagine di confronto. Il PDF pubblico è `apps/web/public/fisica/quaderno-esperimenti.pdf`; è incluso anche nello ZIP offline. Contenuti DRAFT, nessuna approvazione scientifica umana implicita.

La generazione è separata dalla build web: Python con reportlab e pypdf, font DejaVu. Dal repository:

```sh
python3 docs/media/physics-workbook/build.py --font-dir /percorso/ai/font/DejaVu --output apps/web/public/fisica/quaderno-esperimenti.pdf
```

Occorrono DejaVuSans.ttf, DejaVuSans-Bold.ttf e DejaVuSerif.ttf. La licenza dei caratteri è preservata in FONT-LICENSE.txt e come allegato nel PDF. Non vengono incorporati i font di sistema proprietari. Il generatore conserva in questa directory layout e identità dell'output; una rigenerazione richiede controllo visivo e aggiornamento della ricevuta, non un semplice trasferimento del PASS precedente.

`independent-review.md` descrive il controllo da un contesto non autore; `independent-checks.json` conserva ricalcoli e hash. Tutte le pagine sono state renderizzate con Poppler e PDF.js. Non si attribuisce al solo decoder una prova end-to-end di importazione/salvataggio nel Core. Il PDF non contiene script, URL di esecuzione o risposte personali.
