# Cortex: follow-up accenti

La correzione integrata in `tools/cortex/cortex.py` normalizza NFD/casefold soltanto per individuare l'evidenza, senza riscrivere il testo sorgente restituito. SHA256 esaminato: `aa5c1d5fbd152506fe912641698be0ec426c06b261a41c68350327934a6fb92f`.

`python3 -m unittest discover -s tools/cortex -p 'test*.py'`: **25 test PASS**, esecuzione 1.555s. Incluso il nuovo caso `test_accent_insensitive_query_focus_keeps_original_source_bytes`: query `quantita`, riga originale con `quantità`, budget 300, confronto della slice sorgente originale.

La segnalazione non bloccante della prima review è risolta sul caso riproducibile. Non cambia le precedenti limitazioni della valutazione di Cortex: nessuna misura di risparmio token, velocità o qualità di patch da questi test.
