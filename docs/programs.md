# Creare un programma Ardesia

In Creator scegli **Crea un programma**, modifica il codice e premi **Avvia questa versione**. L'anteprima usa una copia dei valori dell'oggetto. **Aggiungi alla lezione** o **Salva modifiche** conserva i valori nel Core; **Modifica struttura** produce una nuova versione. Import/export e MCP usano lo stesso formato. Il codice e i valori della lezione assegnata sono leggibili agli studenti: non inserirvi segreti o soluzioni riservate.

```js
function update({state, event}) {
  const count = Number(state.count || 0) + (event.action === 'add' ? 1 : 0);
  return {
    state: {count},
    view: {tag: 'section', children: [
      {tag: 'h3', children: ['Un contatore inventato da te']},
      {tag: 'output', children: [String(count)]},
      {tag: 'button', events: {click: 'add'}, children: ['Aggiungi']}
    ]}
  };
}
```

Il body è `{code, initialState: {count: 0}, intervalMs?}`; lo stato corrente dell'istanza va in `data.state`, distinto da `initialState`. Il codice è sincrono: ogni interazione riceve uno stato JSON e un evento, poi restituisce `{state, view}`. Non usare Promise, import, timer, DOM, rete, storage o API native. Le variabili globali non sopravvivono all'interazione: metti i dati da conservare nello stato. `intervalMs` opzionale, da50 a60000, produce `tick` se non ci sono elaborazioni pendenti.

Gli eventi sono `start`, `click`, `input`, `change`, `keydown`, `pointerdown`, `pointermove`, `pointerup`, `tick`, con `action` stringa identificatore. Input/change, ammessi su input/select/textarea, aggiungono `value` stringa o booleano checkbox; convertire esplicitamente i numeri. Keydown aggiunge `key`; i puntatori `x,y` relativi fra0e1. Ogni handler nella vista è un ID d'azione, non una funzione. Testo evento massimo8192caratteri; ID64.

Una vista ha `tag`, `key?`, `attrs?`, `style?`, `events?`, `children?`. I figli sono nodi o stringhe, mai HTML. Le key fra fratelli devono essere uniche. Massimo500nodi, profondità20, testo singolo8192caratteri. Stato/body/output restano soggetti anche ai budget byte/JSON dell'envelope.

Tag supportati: `div section article header footer main p span h1 h2 h3 h4 h5 h6 strong em small code pre blockquote ul ol li dl dt dd table caption thead tbody tfoot tr th td button label input select option textarea output progress meter details summary hr br svg g path circle ellipse rect line polyline polygon text title desc`. SVG solo elementi SVG, nessuna tabella o SVG annidati. Gli elementi void e textarea non accettano figli. Il pulsante è sempre type=button.

Attributi: `title aria-label placeholder value`, role fra `img group status note presentation`; booleani `checked disabled selected open multiple readOnly`; input type fra `text number range checkbox`. Coordinate SVG, `viewBox`, `d`, `points`, colori `fill/stroke`, `textAnchor`, `strokeLinecap` e valori numerici noti sono verificati. ViewBox ha quattro numeri, larghezza/altezza almeno1, modulo massimo10000; coordinate/valori numerici fino a10000, geometria path fino a1e6 e4096numeri totali. Span tabella1–24; rows1–30; cols1–120; maxLength0–8192; strokeWidth0–100. Nessun transform, filtro, trattino dinamico, href, URL o attributo sconosciuto.

Stili: colori `color/backgroundColor/borderColor` (hex, pochi colori nominati, none/currentColor/transparent); `display`, flex, allineamento, textAlign, fontWeight/fontStyle, whiteSpace, overflow, borderStyle e position (`static|relative`) da valori enumerati. Dimensioni `width/height/minWidth/maxWidth/minHeight/maxHeight/flexBasis` fino a2048px o100%; spazi, bordi e font fino a128px, font minimo8px. Accettati px/rem o numeri; percentuali solo dimensioni, niente em/vw/calc/url. LineHeight numerico0.8–3, flexGrow/flexShrink0–10, opacity0–1. GridTemplateColumns accetta fino a12colonne con valori1–99fr/px/%. Valori non ammessi fermano l'esecuzione: non vengono rimossi silenziosamente.

Questa ABI è un primo ambiente programmabile, non l'intero browser o un catalogo di oggetti. Consente algoritmi, strutture, grafici e interazioni originali; nuove capability si aggiungono con un renderer/versione e prove proprie. Il formato aperto conserva renderer e componenti futuri senza eseguirli.

MCP: leggi `ardesia://extension-format`, crea una definizione con `renderer: "ardesia.program/1"`, typeId originale, versione1, nome, descrizione, licenza e fallback. Calcola SHA-256 del JSON canonico a chiavi ordinate. Invia un `add-object` di tipo `extension` via preview/apply con revisione documento esatta. Non serve incollare il risultato nell'app; compare nella lezione autorizzata. Un aggiornamento di codice richiede versione successiva e nuovo digest; uno stato nuovo mantiene la versione. MCP non concede esecuzione né validazione scientifica.

Le prove restano DRAFT. Una simulazione scientifica richiede anche fonti, ipotesi, unità e controprove numeriche indipendenti: il fatto che il codice giri non ne dimostra la correttezza.
