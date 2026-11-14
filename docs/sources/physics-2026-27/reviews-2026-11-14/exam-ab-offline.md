# Independent A/B exam and offline media review

Result: PASS after correction of one reproduced numeric sign-toggle defect.

## A/B engine

The integrated generator emits two edition pages using the shared engine, isolated page sessions, precise canonical lesson recovery links, and both edition source hashes. Metadata records 2 editions and 62 total questions while retaining legacy A fields. A source comparison found only 31 added unitId values, with no changes to scientific questions or keys. B source SHA-256 remains e427742505d5c2e3ffb82348f6dd90293db59f758aec10b13c5d298b04d7830f, independently reviewed in `../exam-b-independent-review/review.md`.

Browser checks from file:// with network offline passed: A→B selection and aria-current, B question 24 sign toggle 2→−2, focus restoration, 320px viewport without overflow, final export exam ID/source SHA/score/answer, and exact recovery link `./sf-2026-u2-01.html`. A sign click at the exact timed deadline cannot mutate the stored answer. No page errors. Reproducer and results: `check.mjs`, `results.json`.

The original 80-character numeric input exposed display/session divergence: toggling a positive 80-character string added a sign beyond maxLength; the screen showed −2 but the accepted answer remained +2. Evidence is retained in `sign-limit-failure.json`. The reviewed fix checks length before mutation, leaves input and session coherent, announces the limit, and focuses the input. The rerun confirms both remain the same 80-character positive value. This correctly grades wrong for the negative expected answer instead of silently disagreeing with the display.

## Actual offline archive

The audited ZIP contains 59 entries, 47 HTML pages, and 934 resolved local href/src/poster/fragment references. Paths are safe and unique, CRC checks pass, no root-relative reference remains, both exam edition source hashes match, and all four media files are byte-identical to root public assets (video also matches the reviewed original). ZIP size: 3,264,492 bytes. ZIP SHA-256: ef2a165ee871e94dab89330f96f3c712916a52473e532d594462f06fd1294c8e. Evidence: `archive.json` and `extracted/`.

The archive builder's existing count, depth, single-file and total-size caps remain in force. Its whitelist explicitly admits MP4, PNG, VTT and TXT in addition to existing assets. Native video has controls, playsinline and preload=none, without autoplay. Transcript output is escaped, wraps on narrow screens, and requires no remote service.

Actual extracted archive playback passed in installed Google Chrome headless, with browser networking offline over file://: duration 38 seconds, decoded dimensions 1920×1080, successful seek to 36 seconds, expanded transcript, no 320px overflow, no HTTP requests or page errors. Video width at 320px viewport is about 294.4px. Evidence: `media.mjs`, `media-results.json`. Bundled Playwright Chromium does not support this H.264 codec; installed Chrome does. VTT is offered as a download, not as a native subtitle track.

No scientific publication/human-approval status was changed by these checks. Assessment breadth is 31 questions per edition, not exhaustive assessment of all 38 lessons.
