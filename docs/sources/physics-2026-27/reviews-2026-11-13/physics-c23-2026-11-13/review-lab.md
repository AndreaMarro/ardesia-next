# Revisione indipendente del laboratorio macchina termica — 13 novembre 2026

Esito sul candidato finale: nessun difetto scientifico o tecnico P1/P2 concreto rilevato nel perimetro esaminato. Revisione di agente distinto dall’autore del laboratorio; non è approvazione umana, esecuzione browser o certificazione globale della piattaforma. Stato DRAFT preservato.

## Fonte esatta

- Candidato `/tmp/ardesia-c23-lab-candidate.json`: SHA-256 `64a1ef7eae68128025fa4563ee31d811e9b3b277c3528bf79a828e89badf6093`.
- Oggetto `physics-heat-engine` in `docs/sources/physics-2026-27/editorial/lab-definitions.json`: strutturalmente identico al candidato; hash dell’intero file `daca7553da2463ca56791f5f1b2c45dc05940fea7fdaae89bbfdf0ac7ec1832f`.
- Unit test `apps/web/src/courses/physics/heat-engine.test.ts`: `cfaaddb083657a4129c598dbe45f7deefec150808551bf873a67293b89f8f06f`.
- E2E `e2e/physics-courses.spec.ts`: `5af434cd98d24040cc2c3c1f73357b00c660dd9cf37324ef34dd3b3f58f88c67`.

Sono stati riletti anche gli ultimi cambi testuali: etichette, tre diagnosi, consegna e spiegazione distinguono ora esplicitamente la **variazione** ΔS dall’entropia S. Le leggi numeriche rimangono quelle già esaminate; i controlli sono stati comunque rieseguiti sul candidato finale.

## Verifiche fisiche e numeriche effettivamente eseguite

Lo script `/tmp/ardesia-c23-review-lab.mjs` carica il candidato, ne verifica l’identità con l’oggetto canonico, applica `CompositionBodySchema` e valuta le espressioni tramite la API pubblica `@ardesia/plugin-host/composition`. Produce `/tmp/ardesia-c23-review-lab.json`. Eseguito dalla radice del repository con `node --input-type=module < /tmp/ardesia-c23-review-lab.mjs`.

288 stati: Th∈{400,500,650,800} K, Tc∈{250,300,350} K, Qh∈{100,900,2000} J; per ogni terna η∈{0,30,40,60,100,ηCarnot,ηCarnot−10⁻⁶,ηCarnot+10⁻⁶} punti percentuali. Controllati i bilanci e, indipendentemente dalla forma usata nel modello, ΔStot=(Qh/Tc)[(Th−Tc)/Th−η/100].

- 129 proposte compatibili, 42 sul limite reversibile, 117 rifiutate: diagnosi concordanti col secondo principio.
- Scarto massimo per l’arrotondamento di ΔStot: 4,3956044·10⁻⁷ J/K, inferiore a metà dell’ultima cifra visualizzata.
- Bilancio energetico Qh=Qc+W rispettato; Qc e W non negativi nell’intervallo previsto.
- Tutte le barre usano la stessa scala fissa, Qh/4 pixel, con larghezze non negative, somme coerenti e limite grafico x=550. Nessuna normalizzazione separata che nasconda la chiusura del bilancio.
- Stato iniziale: W=270 J, Qc=630 J, residuo=0, ηCarnot=40%, ΔSh=−1,8 J/K, ΔSc=2,1 J/K, ΔStot=0,3 J/K.

## Ipotesi, segni, unità e limiti del modello

Le temperature sono assolute, e tutti i valori consentiti rispettano Th>Tc>0. L’ingresso η è espresso in percentuale e convertito in rapporto nelle espressioni; le energie sono per ciclo, non potenze. Qc è dichiarato come modulo del calore ceduto; W è il lavoro netto fornito. I serbatoi hanno temperatura costante. Il fluido ciclico ha ΔU=ΔS=0; l’accumulatore ideale di lavoro chiude il complesso isolato senza trasporto di entropia col lavoro. Ne segue correttamente η≤1−Tc/Th.

Proporre η fino al 100% è didatticamente coerente perché gli stati impossibili sono presentati esplicitamente come ipotesi rifiutate dal secondo principio. Il testo non trasforma una proposta compatibile in prova costruttiva, non attribuisce al modello un percorso p–V o una potenza e chiarisce che η=0 non rappresenta un motore utile. Il confronto diagnostico usa i valori prima dell’arrotondamento, con una tolleranza numerica dichiarata nel codice; le etichette finali non confondono ΔS negativa con entropia assoluta negativa.

## Mapping critico

Il collegamento a U5-05.04 (lavoro e rendimento) e .05 (limite di Carnot) è diretto. .02 è sostenuto dal confronto tra ΔStot positiva e nulla; .06 dal bilancio ciclico e dalle variazioni dei serbatoi; .08 dal rifiuto delle proposte con ΔStot negativa. Sono collegamenti per esercitazione: il laboratorio non rappresenta le quattro trasformazioni di Carnot, non dimostra una legge cinetica o il tempo di evoluzione e non esaurisce ciascun obiettivo. Non vi è mapping alla statistica dei microstati .07.

## Lettura dei test e limiti dell’evidenza

Letti integralmente i quattro unit test: schema e digest, limiti degli input e stato DRAFT, bilanci energetici/entropici con casi ammessi e impossibili, scala grafica comune. Le attese numeriche sono coerenti e includono il caso η=100%, che conserva energia ma viola Kelvin–Planck nelle ipotesi date. Questo revisore ha eseguito il proprio probe; l’esecuzione Vitest dell’intera suite appartiene alla sessione root.

Letto il nuovo E2E: importazione del corso reale, avvio di un’edizione, manipolazione da tastiera e spinbutton, bilanci a 40/60/100%, barre, reset, isolamento dello stato temporaneo del laboratorio, assenza di overflow/errori attesa; poi risposta al nuovo problema COP, persistenza nel Core con riferimento all’oggetto, soluzione solo su richiesta e recupero dopo reload. Queste sono proprietà richieste dal test, non esiti browser attestati da questa revisione.

Nessun codice condiviso è stato modificato. La verifica di questi stati non è una prova esaustiva di tutte le possibili interazioni UI né sostituisce Verify/E2E sullo stesso candidato. Contenuti ancora DRAFT, humanApproval=false, nessuna pubblicazione.
