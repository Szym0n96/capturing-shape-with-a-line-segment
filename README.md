# Capturing a Shape with a Line Segment

An interactive JavaScript/SVG exploration of short line segments representing planar point sets, based on two papers by van Beusekom et al. Given a radius `r > 0`, find a short segment within distance `r` of every input point. Its neighbourhood forms a capsule.

**[Interactive demo](https://szym0n96.github.io/capturing-shape-with-a-line-segment/)** · **[Technical report](report.html)** · **[Report PDF](docs/report.pdf)**

The three methods are numerical searches. The full exact global algorithm from the journal article is explained in the report and remains an extension; positive-length results are feasible candidates, not certified global optima.

## Run locally

From this directory, with Python 3 installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000**. Serve over HTTP so JavaScript modules load correctly. The demo has no installation, build step, external fonts or runtime dependencies. `npm start` runs the same server when Node.js is installed.

## Explore

- Choose one of eight examples or a seeded random set. Click to add/select, drag to move, Shift-click or Delete to remove. With the drawing focused, Enter adds a point, Tab selects points and arrows move the selection (Shift for larger steps). Limit: 100 points.
- Adjust the radius and compare **Uniform grid**, **Hull + optimized offset**, and **Events + local refinement**. Select a table row's radio button to display its capsule.
- Inspect a fixed direction, jump to a support or feasibility event, or play a rotation. Blue shows the shortest segment encountered during that rotation. The table retains the global-search results; the metrics describe the displayed segment.
- Move the line within its feasible strip, inspect the convex offset-length curve and the disk intervals. Gold marks endpoint-defining constraints; other disks may also be tight.
- Import/export a point set as JSON or save the drawing as SVG. The optional collision panel tests a probe disk against the capsule.

Coordinates are SVG drawing units, with y increasing downwards and positive angles clockwise. Edits stay in memory until exported. Import accepts version-1 JSON with finite coordinates inside the drawing, radius 1–200 and at most 100 points. Exported files include the search settings.

## Implemented methods

| Component | Implementation |
| --- | --- |
| Hull reduction | Andrew's monotone chain, O(n log n), with duplicate/collinear handling |
| Feasibility | O(h) rotating-calipers minimum-width scan; feasible iff width ≤ 2r |
| Point solutions | Shared shuffled incremental smallest-enclosing-circle check |
| Uniform grid | A angles × B offsets, all input points; defaults A = 180, B = 25 |
| Hull + optimized offset | Same angles plus a minimum-width witness; golden-section offset search |
| Events + local refinement | Adds analytic support/feasibility events and feasible-component midpoints, then refines promising angular neighbourhoods |
| Validation | Independent point-to-segment distances for every original point |

The offset bracket tolerance is `1e-4` units and distance acceptance tolerance `1e-7`. Neither establishes a global length-error bound. A failed grid is inconclusive. Only the width check reports infeasibility. The enclosing circle also provides the numerically evaluated lower bound `max(0, 2(R − r))`.

See [implementation notes](docs/method.md) for formulas and actual complexity, and the [report source](docs/report.md) for the exact algorithm study, experiments and limitations.

## Solver API

The modules work in Node.js and the browser, independently of the interface:

```js
import { solve, solveFixedOrientation } from './src/solver.js';

const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
const result = solve(points, 2, {
  method: 'events', angles: 180, offsets: 25,
  refinements: 6, offsetTolerance: 1e-4, trace: true,
});
if (result.segment) {
  console.log(result.segment.a, result.segment.b, result.segment.length);
  console.log(result.verification); // checked against every original point
}
const horizontal = solveFixedOrientation(points, 2, 0); // angle in radians
```

`method` is `grid`, `optimized` or `events`. Status is `empty`, `infeasible`, `point`, `candidate`, `sample-miss` or `numerical-failure`. Results include the hull, width, enclosing circle, lower bound, operation counts and elapsed time. With `trace: true`, they also include sampled lengths and event/feasibility intervals. `solveAtOffset(points, radius, angle, offset)` evaluates one prescribed line. These two fixed-line helpers return a candidate or `null`; callers can check it with `verifySegment` from `src/geometry.js`.

For ablations, `useHull: false` disables hull constraints during search and `detectPoint: false` skips the circle precheck (the circle-based lower bound then defaults to zero). Geometry primitives assume finite, moderate-magnitude coordinates; their floating-point limitations are documented in the report.

## Tests and experiments

Node.js 18+ is sufficient; no npm packages are needed.

```sh
npm test                  # 27 tests in two files
npm run benchmark         # short CSV comparison of shared examples
npm run experiments       # regenerate the full recorded experiment suite
```

For CSV without npm's banner: `node scripts/benchmark.js > results.csv`.

The [validation record](docs/validation.md) also documents the browser interaction and report checks.

[Recorded experiments](docs/experiments/) include the input JSON, seven CSV tables and [environment/settings metadata](docs/experiments/metadata.json). They cover candidate quality, random/all-hull scaling, hull ablation, linear versus quadratic width scans, angle resolution, offset tolerance and a dense-grid comparison. Each timing uses a warm-up followed by the median of five runs. A denser numerical search is a reference candidate, not an exact oracle. The report discusses signed differences and timing noise.

## Rebuild figures and report

Generated figures, HTML and PDF are included. Rebuilding them additionally needs Python packages **matplotlib** and **markdown-it-py**, and **pdfLaTeX** with the standard packages listed in `scripts/build_report.py` (including `lmodern`, `booktabs`, `tabularx`, `microtype` and `titlesec`). These tools are not needed to run the demo or tests.

```sh
npm run figures
npm run report
```

The single prose source is `docs/report.md`. The build fills its measurement placeholders from the saved CSV files, renders local equation SVGs and produces both `report.html` and `docs/report.pdf`. Temporary LaTeX files go in ignored `.build/`. To refresh everything, run `npm run experiments` first.

## Repository and release

```text
index.html, styles.css   Static interactive page
report.html             Generated web report
src/                    Geometry, searches, examples, data and visualizations
tests/                  Geometry, numerical and data-format checks
scripts/                Benchmarks, plots, report and source packaging
docs/report.md          Shared report source
docs/report.pdf         Generated PDF
docs/experiments/       Inputs, measurements and metadata
docs/figures/           Generated local SVG/PDF figures
```

Create a source archive and SHA-256 checksum with:

```sh
npm run package
```

The files are written to `../releases/`, outside the repository. The archive includes execution instructions, source, tests, report and measurements; it excludes Git history, local environments and temporary build files. Unzip it and run the server command above from its top-level folder.

Use **this directory as the Git repository root**. The existing GitHub Pages deployment can continue serving the `main` branch's root: `index.html`, `report.html`, `docs/` and `src/` all use relative local paths. No publishing workflow or build service is required.

## References

- N. van Beusekom, M. van Kreveld, M. van Mulken, M. Roeloffzen, B. Speckmann and J. Wulms. **Capturing the Shape of a Point Set With a Line Segment.** *Computing in Geometry and Topology* 4(1), Article 10, pp. 10:1–10:35, 2025. [DOI](https://doi.org/10.57717/cgt.v4i1.74). Exact bound: O(n log h + h log³ h).
- The same authors. **Capturing the Shape of a Point Set with a Line Segment.** EuroCG 2024 extended abstract, pp. 38:1–38:8. Earlier bound: O(n log h + h²). [Related full version on arXiv](https://arxiv.org/abs/2402.12285).
