# Independent workbook review — C1–C5

**PASS: no blocking scientific, numeric, reference or visual defect found.** Reviewed all seven pages, all prompts and solutions, original source and final font-licensed PDF. This is an independent AI check, not human scientific approval or commercial certification.

## Scientific coverage

All displayed numeric results and signs were independently checked; `check.py` records **38 passing numerical checks**. C1 uses momentum conservation and reversal of relative velocity for the elastic case; C2 uses the fourth-power radius law under the stated fixed-pressure, viscosity, length and laminar-flow assumptions. C3 was checked using separate isobaric/isocoric calorimetry. C4 was checked by charge superposition, including the off-axis point. C5 distinguishes instantaneous displacement from resultant amplitude and avoids interpreting local cancellation as disappearance of total energy.

- C1: initial p=3 kg m/s and K=4.5 J; sticking v=0.75 m/s, K=1.125 J, loss=3.375 J. Elastic velocities −1.5 and +1.5 m/s conserve both p and K. Transfer gives v=1 m/s and loss=3 J.
- C2: Q/Q₀=0.0625, 1, 5.0625; half radius gives 6.25% flow. Half flow requires radius ratio 0.840896…, a 15.9104% reduction. Model limitations are accurately stated.
- C3 (v=1.5, p=2): T_f=900 K; ΔU=7483.02 J; W_A=1247.17 J; W_B=2494.34 J; Q_A=8730.19 J; Q_B=9977.36 J. The sign convention is consistent. Transfer gives unchanged pV and ΔU=0 with W_B=Q_B=−2000 J.
- C4: dipole midpoint V=0 and |E|=28.086 N/C rightward. Positive pair midpoint E=0, V=22.469 V. At (0,1 m), the dipole retains V=0, E_y=0 and E_x>0. The plot saturation ±60 V and 0.18 m excluded region match the current laboratory.
- C5 at 0.125 s: in-phase displacement/amplitude 2/2 cm; 120° gives 0.5/1 cm; equal opposite waves give 0/0 cm. Unequal opposite waves retain amplitude |A₁−A₂|.

`lab-parity.mjs` additionally evaluates the current C1/C3/C4 runtimes and inspects C2 slider limits and C5 static configurations. All five laboratory paths and five canonical lesson files exist and match the assignments. The worksheet's C1 transfer is a valid selectable new case, not a claim to repeat the laboratory's separate transfer exercise.

## PDF, layout and use

Seven A4 pages, ordinary unencrypted PDF without JavaScript or fillable form fields. All author renders were inspected at full page size. The final PDF was independently rendered with the same **PDF.js 6.5.438 legacy decoder** used by the web app, with `disableFontFace:true`; all seven final renders were also visually inspected. No clipping, missing glyphs, overlap or unreadable superscripts/subscripts found. Δ, π, φ, √, ±, ≈, ≠, arrows and minus signs are visible and extract correctly. Writing lines and table cells provide usable annotation space; five worksheets precede two solution pages. The p–V sketch is qualitative, with no numerical axis ticks.

DejaVu Sans, Sans Bold and Serif subsets are embedded with Unicode maps. Final `FONT-LICENSE.txt` is retrievable through both Poppler and PDF.js and exactly matches its sidecar. Text extracted by both Poppler and PDF.js is unchanged from the reviewed pre-attachment version. The final source's explicit font-directory/output arguments do not change the scientific content.

The wording correctly distinguishes PDF annotation/web-material import from the native companion: native exports its own notebooks and does not import this PDF as background. Current web source (`inspectMaterial`, `MaterialImport`, `MaterialView`) preserves original bytes, accepts PDF pages and displays separate anchored ink. Actual decoder inspection/rendering succeeds for this 7-page, 88,064-byte document, comfortably within the importer limits. **No end-to-end import/save/reload or third-party PDF annotation application was exercised in this review.** PDF markup suitability is not an AcroForm or native-import claim. The PDF is untagged; screen-reader accessibility is not certified.

## Exact final identity

- `work/lab-workbook/Quaderno-degli-esperimenti-C1-C5.pdf`: `7d91231930f53ade5ac7b2661bece8605e81b295d68f217c6881d6cd4cc70043`
- `work/lab-workbook/build.py`: `ee911225467adea5c8a7633fc687e34c8318dfbf5276a2a66aa7260edbc3f698`

Evidence: `numeric-and-hashes.json`, `lab-parity.json`, `pdfjs-final.json`, `pdfjs-page-1.png` through `pdfjs-page-7.png`, extracted text and the three reviewer scripts. Reviewer changed no source or deliverable. Root retains integration/offline archive/distribution ownership.
