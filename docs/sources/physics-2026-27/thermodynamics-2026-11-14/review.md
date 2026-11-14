# Independent C3 thermodynamics laboratory review

**PASS for integration of the frozen candidate; no blocking defect found.** Review completed 14 November 2026, approximately 03:47 UTC. Sources remained read-only. This is an independent AI review, not human scientific approval.

## Scientific result

The model correctly represents a closed classical monatomic ideal gas with constant molar heat capacity 3R/2. Initial state is 1 mol, 300 K, 100 kPa. A follows the initial-pressure isobar and then the final-volume isochore; B follows the initial-volume isochore and then the final-pressure isobar. Both connect identical endpoints and are not a cycle.

Independent path quadrature computed temperature, internal-energy change, heat and signed boundary work over 100 subsegments per leg. All **961 available slider pairs plus 3 off-grid pairs** agree with both readable and minified runtime outputs. This used dU=Cv dT and dQ=Cv dT+p dV along the paths, not a call to the author's tests. Eighteen invalid-input cases reject nonfinite, out-of-range and nonnumeric values. HTML generation independently reproduces the frozen public HTML byte-for-byte.

The sign convention ΔU=Q−W is consistently stated and implemented. Expansion gives positive work, compression negative work; Q=ΔU+W. Isocoric legs do no boundary work. The assumptions make use of path pressure in the work integral appropriate: mechanical quasistatic behavior, pressure approximating external boundary pressure, and only p–V work. The text does not falsely equate quasistatic behavior with full thermodynamic reversibility and does not model free expansion. Temperature remains positive throughout the bounded model (75–1200 K at endpoints); the classical ideal-gas assumption is explicit rather than a claim about a specific real gas.

Counterexamples independently verified:

- V_f/V_i=0.5, p_f/p_i=2: T_f=300 K and ΔU=0, yet Q_A=W_A≈−1247.17 J and Q_B=W_B≈−2494.34 J. A has the greater signed work.
- V_f/V_i=0.5, p_f/p_i=0.5: both works remain negative, but B has the greater signed work (≈−623.58 J). Compression alone does not determine the ordering.
- V_f/V_i=2, p_f/p_i=0.5: unchanged endpoint temperature with positive heat and work, complementing the compression counterexample.
- Equal volume, equal pressure and identical endpoints correctly yield coincident paths or zero results as applicable.
- Transfer problem: pV is unchanged; W_B=200000×(0.010−0.020)=−2000 J and Q_B=−2000 J. The default worked example's published rounding is correct.

## Interaction and presentation

Independent Chromium checks ran directly from `file://` at **320×900 and 1280×900**, plus a separate JavaScript-disabled 320-pixel context. No horizontal overflow, page errors, remote requests or stored keys were observed. Screenshots of the compression graph, balance cards and no-JavaScript example were visually inspected: readable, correct arrows and signs, no clipped values. Solid/dashed paths supplement color, while text supplies geometry and numeric state information for the aria-hidden plot.

Home/End keys move native ranges to their exact bounds. Changing either endpoint hides the old result and clears predictions. Tab/Enter submits, results receive focus, wrong and correct transfer choices show appropriate feedback. With JavaScript disabled, controls stay disabled and the worked example remains readable.

**Keyboard limitation:** this Mac Chromium automation did not commit native select-menu options with key presses alone (also reproduced in a headed run). Select values were therefore supplied through Playwright for the remaining tests. Full native-select keyboard selection and real screen-reader use are not certified; labels, required fields, tab order and result focus were inspected/tested. This is not established as a product defect.

## Size, identity and integration limits

The candidate patch matches the assigned SHA. Source/public hashes are recorded below and in `results.json`. This machine's Node v25.9.0 measures runtime gzip at **1741 bytes**; the supplied Node 24 manifest records **1747 bytes** for identical JS bytes. Both are below the 2300-byte candidate cap. The conservative addition to supplied Core 341157 is **342904 / 344064**, leaving 1160 bytes. This arithmetic projection is not an integrated bundle measurement. Root must still run the normal integrated build, verify the unchanged 344064-byte Core cap, regenerate asset/ZIP manifests and check landing/C3 links. No integrated-release or Safari/Firefox result is claimed here.

Evidence: `check.mjs`, `results.json`, `compression-graph-{320,1280}.png`, `compression-result-{320,1280}.png`, `no-js-320.png`.

## Exact SHA-256

- `candidate.patch`: `8b7b36a7c063e5d68b5d8ec6e4fb8b755ce08121a8a30d7c0804a65c92e55948`
- `tools/build-physics-thermodynamics.mjs`: `c0ba7b762078aacda852532bae0a8b3ca185da71db1b637ebec9e6fbd6bc582a`
- `tools/physics-runtime/termodinamica.js`: `586cf23027208db22d2ecd179198fbd3ecb0cdd6a0d80541debd8c1cbeb1da03`
- `apps/web/public/fisica/termodinamica.html`: `2e768bb0250a8306819bbbed34be7b1400f2db1caa70394d0d4231fbca843d1a`
- `apps/web/public/fisica/termodinamica.js`: `86183391e8deac4f9bdfbf6dc96d613198bf0faffad0e2fd683a8a9e492362bb`
- `apps/web/public/fisica/termodinamica-manifest.json`: `4b44a192e6d4a1fe9865561bf3ba442144551dca583895dbae399901a38608f1`
