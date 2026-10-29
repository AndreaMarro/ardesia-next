# M1 — Verifica circoscritta dell'esposizione M0

**Verificata il 29 ottobre 2026, ore 02:13 CET (01:13 UTC).**  
**Base esaminata:** `97d7476d7e0a0dd32b381a6cdd7527c3595fad9d`.  
**Esito:** nessuna credenziale operativa o chiave privata identificata nei contenuti esaminati; nessuna rotazione giustificata da un segreto effettivamente rilevato. **L'incidente di visibilità rimane aperto nella ricostruzione storica.**

Questo controllo riguarda soltanto il possibile contenuto esposto dalla nuova repository `AndreaMarro/ardesia-next`. Non modifica il giudizio di accettazione del prodotto e non costituisce un nuovo audit generale.

## Evidenza e perimetro

La [PR #3](https://github.com/AndreaMarro/ardesia-next/pull/3) registra la visibilità pubblica osservata, il ripristino della riservatezza e la conferma alle 00:56:01 UTC. Non determina causa, inizio della finestra pubblica o copie effettuate da terzi. Questi tre punti non vengono dedotti dall'attuale impostazione privata.

Sono stati letti i riferimenti Git visibili e tutte le versioni dei file raggiungibili entro la base M0:

- **8 commit**, dal primo `6b508b76b898ca8ce79eb0f0cb22fe92a942c645` alla base sopra indicata, incluse le teste delle PR #1–#3.
- **8 riferimenti visibili**: cinque branch e tre riferimenti PR; tutti risolti in questa storia. Nessun riferimento ulteriore restituito dall'enumerazione.
- **79 file nella base M0**, **87 blob unici nella storia**, per **322.469 byte**. Gli alberi Git restituiti non risultavano troncati.
- **7 run Actions** e **7 log del job verify**, per **364.311 byte**. Le sette run enumerate hanno un solo tentativo.
- **7 archivi di prove**, scaricati e confrontati con i digest SHA-256 restituiti da GitHub: **7/7 corrispondenti**.
- Gli archivi contengono **52 file**: **40 testi/JSON**, per **587.928 byte**, e **12 PNG**. I PNG rappresentano soltanto **due immagini diverse**, entrambe osservate; i file duplicati hanno la stessa impronta. Non contengono chunk PNG testuali o EXIF.

La lettura ha usato il connettore GitHub per contenuti e metadati e il download locale delle copie degli artefatti. Non sono stati modificati repository, impostazioni, credenziali o deployment. Le copie intermedie e gli URL temporanei di download non sono inclusi nel repository.

## Metodo e risultati

Sui blob, sui log e sui testi degli artefatti è stata eseguita una ricerca locale deterministica di:

- intestazioni di chiavi private;
- formati riconoscibili di token GitHub, AWS, Google, provider AI e Slack;
- JWT, URL con credenziali incorporate e intestazioni Authorization con valori non mascherati;
- assegnazioni letterali a campi di password, chiavi, token e client secret;
- indirizzi email, seguiti da verifica del contesto.

Sono stati inoltre esaminati l'inventario dei file, la configurazione CI, i dati dell'esempio applicativo, il contesto dei risultati e le due immagini distinte. Si tratta di un controllo mirato con pattern e revisione contestuale, **non di una prova matematica dell'assenza di ogni possibile segreto**.

| Riscontro | Valutazione |
| --- | --- |
| URL con nome utente/password di esempio in `tools/status.test.mjs` | Fixture negativa su `example.com`: verifica il rifiuto di una destinazione contenente credenziali. Nessuna credenziale operativa. |
| Stessa fixture nel campo `gitDiff` di un rapporto Playwright | Copia del test nel rapporto CI, classificata nello stesso modo. |
| Email nei metadati `gitCommit` dei rapporti Playwright | Indirizzo GitHub `users.noreply.github.com` del contributore e identità di commit GitHub; nessun elenco di studenti o indirizzo privato aggiuntivo identificato. I valori non sono riprodotti nel rapporto. |
| PNG desktop/mobile | Solo lezione di esempio su oscillazioni, formula, nota e fonte OpenStax; nessun dato di studente osservato. |
| Chiavi private, token utilizzabili, password operative | Nessun riscontro credibile nei contenuti ispezionati. |
| File di ambiente, archivi di credenziali o database di studenti tracciati | Non presenti negli inventari Git esaminati. |

La CI M0 usa `permissions: contents: read`, checkout con `persist-credentials: false`, e carica le directory di prove. Questi controlli riducono l'esposizione accidentale, ma **non vengono usati per sostituire la lettura dei log e degli archivi**, eseguita separatamente.

## Archivi verificati

Ogni digest nella tabella è stato ricalcolato sui byte ZIP scaricati, prima di leggerne i contenuti.

| Run CI | Artefatto | Commit | SHA-256 ZIP |
| --- | --- | --- | --- |
| [40796726378](https://github.com/AndreaMarro/ardesia-next/actions/runs/40796726378) | [12863808839](https://github.com/AndreaMarro/ardesia-next/actions/runs/40796726378/artifacts/12863808839) | `97d7476d7e0a` | `6c30d0ca6d152082f4369f0ad14c44150d7da7b39a4b19e161c86dda848ecb1b` |
| [40796597082](https://github.com/AndreaMarro/ardesia-next/actions/runs/40796597082) | [12863478634](https://github.com/AndreaMarro/ardesia-next/actions/runs/40796597082/artifacts/12863478634) | `da52478275a2` | `729f55fb10bf18657950d13ca992a3634ac131d8c04ace63436d4f020134783a` |
| [40795960387](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795960387) | [12862924299](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795960387/artifacts/12862924299) | `ce65e0f50cc4` | `16980f9cd30193967ac684a9100b532cb6dd5b286625ea47c44b6c70379db417` |
| [40795762379](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795762379) | [12862969599](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795762379/artifacts/12862969599) | `3a888bc5ee27` | `24d1786c49fe8c4c8c80601b9dba38674650b5a13c412c9180f99c8fd6e4081b` |
| [40795170230](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795170230) | [12862803641](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795170230/artifacts/12862803641) | `4e9377521f60` | `8b2af281be3665735a0cb6385d1695aedc98f0c5d640473634d05924f1ed9d2b` |
| [40795054966](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795054966) | [12862957943](https://github.com/AndreaMarro/ardesia-next/actions/runs/40795054966/artifacts/12862957943) | `d6484bb39c0f` | `e944e1489a360f8a8baf61201dc5b0e84fa3f9b0d70c1b39e1db62e74c80eb0b` |
| [40794628026](https://github.com/AndreaMarro/ardesia-next/actions/runs/40794628026) | [12863062512](https://github.com/AndreaMarro/ardesia-next/actions/runs/40794628026/artifacts/12863062512) | `680ea7bf53e8` | `e796ec6bf3c5801ae88ba1da6df21c41b3ca468c81b334d8bba4348f7055726a` |

I metadati GitHub registrano la scadenza degli archivi al 28 novembre 2026. Gli identificativi e i digest conservano l'identità dei file controllati anche quando il provider non li renderà più scaricabili.

## Decisione per M1 e limiti residui

**Questo controllo non identifica un blocco di sicurezza fondato su credenziali esposte per proseguire M1.** Non è stata eseguita alcuna revoca o rotazione: non è stato trovato un segreto operativo da revocare. L'esecuzione dei plugin resta subordinata ai suoi controlli crittografici e di autorizzazione.

Restano fuori dalla prova:

- oggetti Git eliminati/non raggiungibili, riferimenti non restituiti dal provider, artefatti rimossi o non più disponibili;
- segreti codificati o formati non riconosciuti dai controlli usati;
- sistemi esterni, la repository legacy, cache di terzi e copie eventualmente effettuate durante la finestra pubblica;
- causa e durata della visibilità pubblica, che richiedono evidenza storica del provider non presente in questa verifica.

Nessuna conclusione di riservatezza ininterrotta o di assenza di copie esterne viene formulata. Se emergerà una credenziale operativa nella finestra coinvolta, occorrerà trattare quel riscontro specifico e ruotarla presso il relativo provider; rendere privata la repository non sarebbe una revoca.

## Commit enumerati

```text
97d7476d7e0a0dd32b381a6cdd7527c3595fad9d
da52478275a2da91ecb4fd4fec7add91b614d09d
ce65e0f50cc4a1b4b4cbe1d9c3452bd49cecc126
3a888bc5ee27be0b25f681a36625aef65879c235
4e9377521f60936b43eb40e6f436b3d599549271
d6484bb39c0f623ef578a694e4b5964b14fa3626
680ea7bf53e8c2975fa13daf7464d50d9226bd8a
6b508b76b898ca8ce79eb0f0cb22fe92a942c645
```

