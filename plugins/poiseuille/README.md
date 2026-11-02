# Flusso di Poiseuille — candidato M4 DRAFT

Prima unità isolata del secondo dominio, ID `ardesia.poiseuille`, versione/schema `1.0.0`. `src/index.ts` espone metadati e due stati iniziali; il modello eseguibile resta nel worker verificato dal medesimo Plugin Host. Nessun package workspace, catalogo web o trust distribuito è modificato.

Lo stato contiene R/L in m, μ in Pa·s, ρ in kg/m³ ed esattamente Δp in Pa **oppure** Q in m³/s. Pressione fissata e portata fissata producono attività distinte senza modificare SDK o Core. Il profilo parabolico usa la stessa soluzione di portata, velocità e pressione. `src/model.test.ts` controlla D10/D11/D12, integrazione su anelli, parete/asse, segni, zero, input invalidi e uscita dal dominio prudenziale Re ≥ 2000.

La release sotto `release/1.0.0` contiene worker, manifest firmato, trust **candidato** e notice. La chiave privata effimera non è persistita. Da root: `node tools/check-signed-plugins.mjs` ricostruisce/verifica e prova installazione, consenso, salvataggio, riapertura, revisione originale, rifiuto senza scrittura, isolamento e revoca tramite API pubbliche Host/Core. Il consumer è una fixture d'integrazione con `MemoryStorage` esistente; non è una nuova app né prova PostgreSQL/browser.

Ipotesi, unità, fonti/versioni, prerequisiti, attività, feedback, recupero, transfer, diritti e rollback sono in [fonti M4](../../docs/sources/m4-poiseuille.md). Contenuti DRAFT; nessuna approvazione scientifica/editoriale umana o accettazione M4. Il prossimo incremento deve collegare entrambe le condizioni al consumer reale della stessa web app e alla persistenza autorevole, entro uno scope canonico che comprenda quei file.
