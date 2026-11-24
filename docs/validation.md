# Validation record

Checked on 23 November 2026 with Node.js 18.19.1 and Firefox 159.0.1 on Linux.

## Automated geometry and data checks

`npm test` passes both test files: **27 tests** in total. The independent references include exhaustive small enclosing circles, a quadratic minimum-width scan, dense fixed-line offset samples and direct point-to-segment distances. The full experiment suite completed without a numerical-failure result; its settings and machine metadata are in [experiments/metadata.json](experiments/metadata.json).

## Browser checks

Checked through Firefox's Marionette interface against the locally served static site:

- All three result rows; infeasible, zero-length, point-threshold and narrow-feasibility examples.
- Manual line placement, restored offset minimization, infeasible directions, event selection, interval plots and rotation controls.
- Point addition, dragging and keyboard deletion; clearing the drawing.
- JSON import, rejected malformed input without data loss, JSON export with the expected points/radius, and an XML-parseable SVG export.
- Capsule–disk overlap and separation.
- Layout at 1,440 and 500 CSS-pixel window widths, without horizontal page overflow. Wide tables and the interval diagram scroll within their own containers.
- Web report and all equation/figure images load successfully. No uncaught page errors occurred during the completed interaction checks.

The PDF was built successfully with pdfLaTeX, with no overfull-box warnings, and visually inspected. Local HTML asset and document links were checked against the packaged files. Browser coverage is limited to the stated Firefox version; the geometry tests run independently of the browser.

## Final documentation and packaging checks — 24 November 2026

Codex performed these checks while preparing the final submission:

- Re-ran the two test files directly with Node.js: 14 + 13 tests passed. The earlier review on the same day also ran `npm test` and the short benchmark successfully.
- Rebuilt `report.html` and `docs/report.pdf` from the updated report source and existing recorded measurements. The PDF compiled without LaTeX warnings; the contribution statement and bibliography pages were visually inspected.
- Checked all 26 local HTML links and asset references, including the contribution-section anchors. No unresolved report placeholders remained.
- Regenerated the source ZIP, including the `.nojekyll` hosting marker, report, contribution/AI-use statement, source, tests and recorded experiments. Checked ZIP integrity, SHA-256 and agreement with the packaged source files; extracted the archive and ran its tests independently.

The final changes concern documentation, navigation and packaging. The solver and recorded experiment data were unchanged. The full browser interaction checks above were not repeated during this final pass. Submission to the course platform and posting to the forum remain actions for the author; prepared message text does not constitute a submission.
