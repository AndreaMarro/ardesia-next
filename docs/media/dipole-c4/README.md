# Ardesia C4 — Il centro di un dipolo

Bozza didattica originale: una tavola continua di 38 secondi, senza audio. Il video mostra perché al punto medio di due cariche opposte il potenziale si annulla ma il campo elettrico no. Materiale di revisione: nessuna pubblicazione effettuata.

## File da integrare

- `dipolo-c4.mp4`: Full HD 1920×1080, 30 fps, H.264 High, yuv420p, 38.000 s, 1140 fotogrammi, 1,637,771 byte.
- `poster.png`: fotogramma estratto dal video a 36 s, con l'intera dimostrazione.
- `trascrizione-it.vtt`: otto cue italiani per un player HTML; il video non contiene una traccia sottotitoli incorporata.
- `trascrizione-it.txt`: alternativa testuale completa, formule, direzioni e ipotesi.
- `review-dossier.md`: validazione scientifica, verifiche, limiti dichiarati.
- `final-manifest.json`: hash SHA-256 dei file e digest aggregato delle sorgenti.

## Sorgenti e riproduzione

`index.html` monta `compositions/dipole-board.html`; `assets/gsap.min.js` fornisce GSAP 3.14.2. `DESIGN.md` definisce palette, tipografia e movimento. CLI fissata a Hyperframes 0.9.43 in `package.json`.

Sul Mac di produzione con Georgia installato:

```sh
npm run check
npx --yes hyperframes@0.9.43 snapshot --at 4.8,10.5,14,22.5,27,36 --output snapshots-final
npm run render -- --output dipolo-c4.mp4 --fps 30 --quality high --workers 1
```

La durata deriva dai metadati della composizione. Le timeline sono sincrone, in pausa e ricercabili. Nessuna casualità o richiesta di rete è presente nel codice della composizione. La CLI può richiedere rete per il primo download e per i font supportati.

**Portabilità:** Georgia è referenziato mediante `src: local("Georgia")`, non incluso nel progetto. Il rendering è stato verificato su questo Mac; su altri host occorre installare legalmente Georgia o sostituirlo e ripetere check e ispezione. Non si promette identità binaria dei render tra host. Il log di compilazione riporta inoltre l'incorporamento di Inter dalla cache font della CLI.

## Attribuzioni

Disegno SVG, disposizione, animazioni, testo e dimostrazione sono originali per Ardesia; nessuna immagine, musica, voce o filmato di repertorio.

- GSAP **3.14.2**, ©2025 GreenSock, autore Jack Doyle. Sorgente vendorizzata: https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js . Header originale preservato. Licenza: https://gsap.com/standard-license . README upstream salvato in `assets/GSAP-README.md`.
- Georgia: font di sistema locale, non redistribuito.
- Inter: font caricato dal compilatore Hyperframes; progetto https://rsms.me/inter/ , licenza SIL Open Font License 1.1, https://github.com/rsms/inter/blob/master/LICENSE.txt . Non è presente un file font redistribuito nelle sorgenti.
- Hyperframes **0.9.43**: strumento di produzione; non aggiunto al runtime del prodotto Ardesia.

Il progetto include solo una bozza per revisione e integrazione. La presenza del marchio DRAFT è intenzionale; non va rimossa senza completare la revisione editoriale/scientifica prevista per la pubblicazione.
