# Capturing a Shape with a Line Segment

A dependency-free JavaScript implementation and interactive SVG demo of point-set representation with short line segments, based on two papers by van Beusekom et al. Explore the geometry, compare numerical methods, or use the solver modules in your own experiments.

Given planar points and a radius `r > 0`, find a short segment at distance at most `r` from every point. The application compares a sampled baseline with a convex-hull-based numerical improvement. It **does not implement the paper's exact global algorithm**.

## Run locally

From the `capturing-shape-with-a-line-segment` directory, with Python 3 installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000**. Serve the page over HTTP: opening `index.html` directly does not reliably load JavaScript modules. No installation, build step, external fonts or runtime dependencies are needed. A recent browser with JavaScript is sufficient. `npm start` runs the same server if Node.js is also installed.

## Try it

- Choose a prepared example, or click **Random set** (seeds start at 42).
- Click the drawing to add/select points, drag to move them, Shift-click to remove. Delete removes the selected point. When the drawing has focus, Enter adds a point, Tab cycles through points before leaving the drawing, and arrows move the selection (Shift for larger steps).
- Adjust the radius and toggle the disks or hull. The drawing is limited to 100 points.
- Compare both methods in the results table; select a method to display its capsule. Gold circles identify the two interval constraints defining the segment endpoints; these need not be the only tight constraints.
- Enable **Use a fixed direction**, move the angle slider, or play the rotation. The highlighted strip contains feasible offsets. The table retains the global-search results; the metrics describe the currently displayed segment.

Coordinates use SVG drawing units, with `y` increasing downwards, so positive angles turn clockwise. Edits are kept only in memory and are lost on reload.

## What is implemented

| Component | Implementation |
| --- | --- |
| Baseline | 180 uniform angles × 25 offsets in each feasible strip, using all points |
| Hull | Andrew's monotone chain, including duplicate/collinear cases |
| Feasibility | Minimum-width scan over hull edges, O(h²) |
| Improved search | Same angle grid, plus the minimum-width direction; golden-section offset search on hull vertices |
| Validation | Independent point-to-segment distance check on every original point |
| Demonstration | Editable SVG, five examples, seeded random points, fixed-direction inspection |

The offset search stops at a bracket width of `1e-4` drawing units. Distance comparisons allow `1e-7` units. These are numerical tolerances, not a bound on global length error. If the baseline misses every feasible direction, its result is inconclusive. Impossibility is reported only from the width check. See [the mathematical notes](docs/method.md) for details.

## Use the solver

The geometry and solver modules are independent of the interface. Import them from a JavaScript module in Node.js or the browser:

```js
import { solve } from './src/solver.js';

const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
const result = solve(points, 2, { method: 'optimized', angles: 180 });

if (result.segment) {
  console.log(result.segment.a, result.segment.b, result.segment.length);
  console.log(result.verification); // Distance check against every input point
}
```

Use `method: 'grid'` for the baseline, with an optional `offsets` count. The result also contains a status, hull, minimum width, timing and disk-test counts. `solveFixedOrientation(points, radius, angle)` optimizes the offset for one angle in radians and returns a segment or `null`.

## Tests and experiments

Node.js 18 or newer is needed; there is nothing to install.

```sh
npm test
npm run benchmark
# Save clean CSV output without npm's command banner:
node scripts/benchmark.js > results.csv
```

The 13 tests cover analytic examples, degenerate inputs, tangencies, a missed angular sample, rotation/translation, dense reference scans and seeded random instances. The benchmark uses shared presets and seeds, one warm-up and the median of five runs. [Recorded results](docs/benchmark.csv) are an initial local measurement, not a general speed claim.

## Repository layout

```text
index.html, styles.css    Static interface
src/geometry.js          Hull, projections, minimum width, distance checks
src/solver.js            Disk intervals and the two searches
src/app.js               SVG editor and controls
src/examples.js          Shared examples and seeded generator
tests/geometry.test.js   Geometry and solver tests
scripts/benchmark.js     Reproducible comparison, CSV output
docs/                    Mathematical notes and benchmark results
```

## GitHub

Use **the `capturing-shape-with-a-line-segment` directory as the repository root**. It contains everything needed to run the application and experiments. For GitHub Pages, choose **Settings → Pages → Deploy from a branch → main → / (root)** after pushing the repository. All application paths are relative, so project Pages URLs work without a build or a custom domain.

## Possible extensions

- Implement the exact circular-arc construction and rotating-calipers events described in the papers.
- Improve angular search and investigate numerical robustness near degenerate cases.
- Extend the benchmarks with more point distributions and dataset sizes.

The current implementation uses plain JavaScript and SVG. It is intended for small datasets and numerical experiments; exact global optimization remains an extension.

## References

- N. van Beusekom, M. van Kreveld, M. van Mulken, M. Roeloffzen, B. Speckmann and J. Wulms. **Capturing the Shape of a Point Set With a Line Segment.** *Computing in Geometry and Topology* 4(1), Article 10, pp. 10:1–10:35, 2025. [DOI](https://doi.org/10.57717/cgt.v4i1.74). Main basis: §2, Lemma 1 and §2.1.
- The same authors. **Capturing the Shape of a Point Set with a Line Segment.** EuroCG 2024 extended abstract, pp. 38:1–38:8. This earlier version gives an O(n log h + h²) algorithm; the journal version gives O(n log h + h log³ h). [Related full version on arXiv](https://arxiv.org/abs/2402.12285).
