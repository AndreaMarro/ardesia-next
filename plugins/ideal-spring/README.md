# Molla ideale · primo plugin scientifico

Versione `1.0.0`, schema dello stato `1.0.0`, ID `ardesia.ideal-spring`.

Il modello rappresenta una massa su un piano orizzontale, collegata a una molla lineare senza massa e senza attrito. La soluzione analitica conserva entrambe le condizioni iniziali: posizione e velocità. Tutte le quantità sono espresse in SI.

Il punto di ingresso pubblico espone solo metadati di distribuzione e stato iniziale. Il worker eseguibile viene costruito, firmato e distribuito dal coordinatore; il Plugin Host verifica firma, identità, compatibilità e byte prima di avviarlo. L’applicazione non importa direttamente il modello.

## Stato

```json
{
  "schemaVersion": "1.0.0",
  "value": {
    "massKg": 1,
    "stiffnessNPerM": 20,
    "initialDisplacementM": 0.2,
    "initialVelocityMPerS": 0,
    "timeS": 0
  }
}
```

| Parametro | Intervallo incluso | Unità |
| --- | --- | --- |
| `massKg` | 0,1–10 | kg |
| `stiffnessNPerM` | 1–200 | N/m |
| `initialDisplacementM` | −0,5–0,5 | m |
| `initialVelocityMPerS` | −2–2 | m/s |
| `timeS` | 0–60 | s |

Questi intervalli delimitano l’attività numerica, non il limite elastico di una molla reale. Il modello rifiuta campi mancanti o aggiuntivi, stringhe numeriche, booleani, valori non finiti e versioni incompatibili; non corregge silenziosamente uno stato salvato.

## Equazioni e rappresentazione

`ω = √(k/m)`, `T = 2π/ω`, `f = 1/T`.

`x(t) = x₀ cos(ωt) + (v₀/ω) sin(ωt)`.

`v(t) = −ωx₀ sin(ωt) + v₀ cos(ωt)`.

`F(t) = −kx(t)`, `a(t) = F(t)/m`, `U = kx²/2`, `K = mv²/2`.

`E = U + K = kx₀²/2 + mv₀²/2`; `A = √(x₀² + (v₀/ω)²)`.

Il worker restituisce parametri, unità, valori, 257 punti su due periodi, quantità geometriche per il disegno e spiegazioni in italiano. Il renderer può mostrare questi dati senza ricalcolare le leggi fisiche. Disegno e grafico sono due viste dello stesso risultato. La scala del disegno si adatta all’ampiezza: non rappresenta la lunghezza fisica di una molla reale.

Il worker non legge né scrive file, DOM, storage, rete o Core. Restituisce uno stato validato al canale del suo Host; il salvataggio resta una responsabilità del Core.

## Verifica scientifica

Le prove coprono esempi SI indipendenti del legacy, punti a un quarto/mezzo/intero periodo, velocità iniziale non nulla, equilibrio fermo, dipendenza del periodo da massa e rigidità, derivate numeriche e seconda legge di Newton, conservazione dell’energia su 324 stati anche ai limiti, serializzazione esatta e controprove di dominio.

Le prove del protocollo controllano correlazione delle risposte, schema della vista, stato incompatibile e richieste malformate. Firma e ciclo Host/Core/browser appartengono ai test dell’integrazione, non sono inferiti dai soli test del modello.

Provenienza e recupero selettivo: [M1 — fonti del modello](../../docs/sources/m1-ideal-spring.md). Contenuto didattico DRAFT; i test numerici non costituiscono approvazione editoriale umana.
