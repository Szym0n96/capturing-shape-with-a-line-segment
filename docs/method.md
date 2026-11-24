# Geometry and implementation notes

The full analysis, study of the exact algorithms, and measured results are in the [web report](../report.html) and [PDF](report.pdf). This page is a compact reference for the code. The geometric reductions follow van Beusekom et al., journal §2–2.2 and the earlier EuroCG paper; see the [bibliography](../README.md#references).

## Reductions

A radius-r capsule is convex. Containing the convex-hull vertices therefore contains all original points. `convexHull` uses a monotone chain in O(n log n).

A segment exists iff minimum width ≤ 2r: its supporting line requires a strip of this width; conversely the middle line of such a strip intersects all disks and a finite segment can meet all intersections. `minimumWidth` uses a monotone antipodal pointer in O(h). `minimumWidthBrute` is the O(h²) testing reference.

A point solution exists iff the smallest enclosing-circle radius R ≤ r. This is distinct from minimum width or diameter. `smallestEnclosingCircle` uses fixed-seed shuffled incremental boundary updates, with O(h³) worst-case work. All three searches share this check. The circle also gives the lower bound max(0, 2(R − r)): a length-L capsule fits inside a radius-(r + L/2) disk. The bound is evaluated numerically.

## Fixed direction and line

For `u = (cos θ, sin θ)` and `v = (−sin θ, cos θ)`, project point i to `(x_i, y_i)`. The line is `t u + b v`. Its feasible offsets and disk intersections are:

```text
max_i(y_i − r) ≤ b ≤ min_i(y_i + r)
l_i(b) = x_i − sqrt(r² − (y_i − b)²)
q_i(b) = x_i + sqrt(r² − (y_i − b)²)
A(b) = max_i l_i(b), B(b) = min_i q_i(b)
L(b) = max(0, A(b) − B(b))
```

If A > B, `[B, A]` is shortest: any feasible segment must start no later than B and end no earlier than A. Otherwise all intervals share `[A, B]`; return its midpoint. A line evaluation is O(h), or O(n) without hull reduction.

Each left endpoint is convex in b, each right endpoint concave. Hence L is convex. `solveFixedOrientation` uses golden-section search, evaluates the strip endpoints explicitly and returns the shortest evaluated segment. Its default tolerance `1e-4` bounds the final offset bracket, with a cap of 96 iterations. `offsetBracket` and `offsetConverged` expose the stopping result. It does not bound length error near tangency, or error from angular sampling.

The paper's exact O(h) fixed-direction solver builds circular-arc envelopes in hull order and locates equal-tangent or corner configurations. This implementation evaluates all intervals at each numerical step instead.

## Direction search and events

- `grid`: A uniform directions in `[0, π)`, B uniform offsets in each feasible strip, all input points.
- `optimized`: the same A directions plus the minimum-width witness, hull constraints and numerical offset optimization.
- `events`: every optimized direction, support-change directions, analytic roots of width = 2r, feasible-component endpoints/midpoints, then R local refinement rounds.

Hull-edge directions partition the angle domain into sectors with fixed opposing supports. Their displacement `(dx, dy)` gives `width(θ) = dy cos θ − dx sin θ`. The code solves this equation for width = 2r within each sector. Support pointers advance monotonically. Sorting costs O(h log h), followed by O(h) traversal. Closed feasible intervals retain isolated tangent directions and both sides of the periodic seam.

In each local refinement round, the four shortest sampled candidates contribute the midpoint directions to their current neighbours, with periodic wraparound. At most eight new directions are evaluated. Retaining all candidates makes refinement monotone, but this heuristic is not a globally exact search. These support/feasibility events correspond to journal types 4 and 3; the full type-1/type-2 event processing and balanced disk-intersection tree are studied only in the report.

## Actual cost

Let C(h) be the circle cost (worst-case O(h³)), K the numerical offset iteration count, and M = O(A + h + R) the total directions for the event method. Usually K = O(log(2r/τ)), capped at 96.

| Method | Time including preprocessing and verification |
| --- | --- |
| Uniform grid | O(n log n + C(h) + ABn) |
| Hull + optimized offset | O(n log n + C(h) + (A + 1)h(K + 1)) |
| Events + refinement | O(n log n + C(h) + h log h + Mh(K + 1) + RM log M) |

The last term accounts for sorting candidates each refinement round. Auxiliary memory is O(n + M). These are not the paper's bounds. Disk-test counters count disk–line interval evaluations only; timings include preprocessing and final verification.

## Numerical contract

`solve` independently verifies every returned segment against all original points, using clamped orthogonal projection. A failed check returns `numerical-failure` and hides the segment. The UI also checks fixed-direction candidates.

- Coordinates and radius must be finite, with r > 0. The UI/import bounds are 900 × 560 units, at most 100 points and radius 1–200.
- Distance/width comparisons allow `1e-7` units. Width above `2r + 1e-7` yields `infeasible`; an angular miss yields `sample-miss`.
- Tiny negative disk radicands are clamped only after checking the distance tolerance. Circle containment uses a scale-aware machine-precision allowance.
- Event angles within `1e-12` radians are merged. Near-threshold distinctions are numerical.
- Hull orientation uses the ordinary cross product; exact/adaptive predicates are not implemented. Extreme coordinate magnitudes and near-degeneracies remain limitations.
- No multiplicative approximation ratio or certified positive-length global optimum is claimed. Dense reference comparisons in the experiments are empirical, not error certificates.

See `tests/` for analytic, independent-reference, random and degenerate checks. Full measured data and settings are in [experiments/](experiments/).
