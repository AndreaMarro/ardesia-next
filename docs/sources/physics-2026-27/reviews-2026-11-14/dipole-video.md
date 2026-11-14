# Independent C4 dipole video review

Result: PASS, with no scientific or visual blocker found in the reviewed frames.

The actual MP4 was sampled at 6, 14, 22 and 36 seconds. Each full 1920×1080 frame was inspected: labels remain legible, charge locations fixed, and the final resultant vector begins at the midpoint P and points right. The reveal animation does not assert a trajectory or a changing physical state. Contributions in the legend are distinguished from the resultant drawn at P.

Independent calculation for +1 nC on the left, −1 nC on the right, P at 0.80 m from each charge in vacuum (V∞ = 0): V+ = 11.234439740375 V, V− = −11.234439740375 V, total V = 0 V; each field contribution is +14.043049675469 N/C along x, total Ex = +28.086099350937 N/C and Ey = 0. Displayed three-decimal approximations are correct. Numerical evidence and hashes: `physics.json`.

Media independently probed: 38.000 seconds, 1920×1080, 30 fps, 1140 frames, H.264, 1,637,771 bytes, no audio stream. Full ffmpeg decode completed with no error. The supplied poster has identical decoded pixels to the frame at 36 seconds (raw framemd5 3b70b507f0813fe6e9ca1aa0ca065e05). MP4 SHA-256: cf005a76e024de23dabe506ed57fb49917d2f07f91ee4063150288d666ed2134. Poster SHA-256: cba13342e207a411dc555845242f566f4cb2c265698d491836fa792f5b01746b.

Integrated page describes the video accurately as silent with Italian text. Full transcript is readable in the page; VTT is downloadable, not wired as a native subtitle track. No Hyperframes or GSAP runtime is shipped to learners. Actual ZIP extraction was tested in installed Google Chrome headless with browser networking offline over file://: playback, 38-second metadata, seeking to 36 seconds, transcript expansion and 320px layout all passed without page errors or HTTP requests. See `../exam-ab-independent-review/media-results.json` and reproducer `media.mjs`. Playwright's bundled Chromium headless shell lacks H.264 support; its decoder limitation is not represented as a product failure or a successful playback check.

This is automated/AI-assisted scientific and visual review, not human editorial approval. Existing DRAFT and humanApproval=false status is preserved.
