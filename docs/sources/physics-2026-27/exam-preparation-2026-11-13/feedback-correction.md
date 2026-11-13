# Correzione del separatore nei feedback — 13 novembre 2026

Difetto confermato nella proposta iniziale: in `u1-scalar-product-03`, opzione D, il separatore `||` collideva con i moduli adiacenti della formula `|A||B|`, separando male feedback e indicazione di ripasso. La precedente proposta è conservata integralmente nei due file `.initial` elencati sotto.

**Correzione:** moltiplicazione esplicita `|A|·|B|`; il generatore locale ora richiede esattamente un separatore per riga e rifiuta residui nei campi prodotti. Nessuna sorgente condivisa o operazione Git/servizio.

## Differenze reali

- Opzione A del medesimo quesito: soltanto notazione, da `|A||B|cosθ` a `|A|·|B|cosθ`.
- Opzione D: ripristinato il confine fra feedback e ripasso. Il feedback termina con `cos90°=0.`; l’indicazione completa è `Ricostruisci la formula A·B=|A|·|B|cosθ e controlla il ruolo dell’angolo.`
- Aggiornato il timestamp di generazione. Nessun altro campo JSON cambiato; i dieci record di completamento sono integralmente identici.

Controllati 302 campi testuali: 105 feedback distinti e 105 indicazioni di ripasso, tutti i passaggi dei 10 svolgimenti, 10 controlli dimensionali e 20 ipotesi educative. **Zero residui del separatore** nei testi finali. Le due formule del prodotto scalare sono complete. ID, prompt, alternative, chiavi, provenance e stato DRAFT/humanApproval false preservati.

## Hash degli artefatti

- `/tmp/ardesia-exam-feedback-proposal-2026-11-13.initial.json` — SHA256 `c13aeac34d5be3a10650c0c4a01476f25e247e5a66653ea30f5993e0629ef30c`.
- `/tmp/ardesia-exam-feedback-proposal-2026-11-13.initial.md` — SHA256 `aa014ab1d985dd58942eec0026783ab8d4ab54c5156d2a84aa1e13688d549f0f`.
- `/tmp/ardesia-exam-feedback-proposal-2026-11-13.json` — SHA256 `c01dcc770ac4b895147256ecf6e4b665c2d84c1c0f6a3424be72ce2990de6d5c`.
- `/tmp/ardesia-exam-feedback-proposal-2026-11-13.md` — SHA256 `18d0df0e8d97896f89e9ce7bdef7f084baea04e49288d427c5efec2b26d3aa2d`.
- `/tmp/ardesia-exam-feedback-authoring-2026-11-13.py` — SHA256 `271648826e8de8cbf8b88884460ad2cfaa24d9da9c752d2982276fd288481ff1`.

È la correzione di un artefatto del medesimo autore, non revisione indipendente o approvazione umana. La successiva review indipendente rimane pendente.
