# Kit finale, da fissare sulla versione pubblicata

`finalize-kit.py` prepara tre testi (messaggio, istruzioni studente, note del titolare), la ricevuta del download e il contatto canonico. Non invia messaggi e non pubblica nulla. Richiede la SHA completa e confronta il download GitHub anonimo con lo ZIP locale prima di scrivere. La cartella di uscita deve essere nuova o vuota.

Dopo il push e i controlli finali del coordinatore:

```sh
python3 work/launch-final-audit/kit/finalize-kit.py \
  --sha SHA_COMPLETA_PUBBLICATA \
  --zip work/ardesia-next/apps/web/public/fisica/ardesia-prova-fisica-offline.zip \
  --contact work/ardesia-next/docs/sources/launch-2026-11-13/contact.json \
  --output work/launch-kit-final
```

Il programma verifica 38 lezioni, conta i problemi nelle lezioni e controlla A/B DRAFT, comandi di salvataggio/ripresa/ripasso, risorse e controlli dei cinque laboratori. Il PDF deve coincidere con il quaderno di sette pagine già revisionato: una nuova versione richiede aggiornamento della verifica e della sua identità. Questi controlli non deducono correttezza scientifica, comportamento completo del browser, CI, deploy o disponibilità commerciale.

Il testo propone solo anteprima gratuita e richiesta informativa. Le istruzioni distinguono JSON del tentativo, JSON del risultato e ripasso HTML; spiegano stessa prova/edizione, assenza di autosalvataggio e scadenza originale. Non promettono app native, import PDF macOS, accesso Core o sincronizzazione.

## Verifica dell’incremento 708f5a9

- Originale preservato: `finalize-kit.before-708.py`.
- ZIP e contatti congelati dalla SHA completa: `708-source.zip`, `708-contact.json`.
- Preview non inviata: `work/launch-kit-708-preview`.
- GET anonimo reale, identità ZIP e inventario: `work/launch-kit-708-preview/public-download-evidence.json`.
- Trenta controlli del generatore: `check-708.py`, `checks-708.json`.
- Percorsi browser offline dei cinque laboratori: `journey-708.cjs`, `journey-708.json`.
- Cambiamenti e limiti: `review-708.md`.

La preview 708 non sostituisce il kit della SHA finale dopo CI: il coordinatore deve rigenerarlo con quel riferimento.
