# Geometry and implementation notes

This implementation explores the line-segment representation problem studied by van Beusekom et al. in their EuroCG 2024 extended abstract and their 2025 article in *Computing in Geometry and Topology*. The hull reduction and fixed-direction geometry come from §2–2.1 of the journal article, also discussed in §2 of the extended abstract. Full citations are in the [README](../README.md#references). The numerical search below is a simpler implementation choice, not the article's exact construction.

## 1. Hull reduction and feasibility

The radius-r neighbourhood of a segment is a capsule: the Minkowski sum of a segment and a disk. Both sets are convex, so the capsule is convex. If it contains every hull vertex, it contains their convex hull, hence all input points. It therefore suffices to solve the constraints on the hull (journal Lemma 1).

Any feasible segment lies on a line whose distance from every point is at most r. The points must fit in a strip of width 2r. Conversely, a line through the middle of such a strip intersects every radius-r disk. Since there are finitely many disks, a finite segment on that line can meet them all. Thus a segment exists if and only if the hull's minimum width is at most 2r.

For a convex polygon, a minimum-width strip has a support parallel to a hull edge. This implementation tries each edge and projects all h hull vertices onto its normal: O(h²), including a zero width for a point or a collinear hull. This is deliberately simpler than rotating calipers. Hull construction is O(n log n), not the output-sensitive hull construction in the paper.

Width is **not** a zero-length test. A zero-length answer requires a common intersection of all input disks. The numerical search detects such answers when its intervals overlap; it may return a small positive length when a zero-length solution is missed. For example, diameter at most 2r alone does not imply containment in a radius-r circle (consider an equilateral triangle of side 2r).

## 2. A fixed line

Let `u = (cos θ, sin θ)` and `v = (-sin θ, cos θ)`. Write each point in this basis as `(xᵢ, yᵢ)`. A candidate line has points `t u + b v`, with offset b.

All disks meet the line exactly when:

```text
maxᵢ(yᵢ − r) ≤ b ≤ minᵢ(yᵢ + r).
```

Each disk cuts out an interval `[lᵢ(b), qᵢ(b)]` on the line:

```text
lᵢ(b) = xᵢ − sqrt(r² − (yᵢ − b)²)
qᵢ(b) = xᵢ + sqrt(r² − (yᵢ − b)²)
A(b)  = maxᵢ lᵢ(b)
B(b)  = minᵢ qᵢ(b)
L(b)  = max(0, A(b) − B(b)).
```

If `A > B`, the segment `[B, A]` meets all intervals and is shortest: any solution must start no later than B and end no earlier than A. Otherwise every interval contains any point in `[A, B]`; the implementation returns its midpoint.

## 3. Optimizing the offset

On the feasible strip, each `lᵢ` is convex and each `qᵢ` is concave. Therefore `A − B`, and then `max(0, A − B)`, are convex. Golden-section search can minimize this function even at corners or on a flat minimum. Both strip endpoints are evaluated explicitly, so a tangent line is retained.

The stopping condition is a final bracket width at most `1e-4`, with a defensive cap of 96 iterations. The returned candidate is the shortest among the evaluated offsets. This positional tolerance does not certify a length error, especially near tangency where square-root derivatives are unbounded. It also does not bound the error from sampling angles.

The paper constructs and searches circular-arc envelopes exactly in O(h) for a fixed direction. This prototype evaluates the full collection of intervals at every numerical step instead.

## 4. Global sampling and actual cost

Let A be the number of angles, B the number of offset samples, and K the number of numerical offset iterations (normally O(log(2r/τ)) for tolerance τ).

| Method | Work including preprocessing |
| --- | --- |
| Uniform grid, all n points | O(n log n + h² + A B n) |
| Hull + optimized offset | O(n log n + h² + (A + 1) h (K + 1)) |

The baseline uses angles `iπ/A` and B equally spaced offsets within each feasible strip. The improved method uses the same uniform angles, plus the minimum-width direction to avoid missing all feasible orientations in a narrow interval. This extra direction and hull reduction are part of the comparison; it does not isolate offset optimization alone. Auxiliary memory is O(n + A).

Neither method implements the global event processing of the paper or its proven approximation scheme. No multiplicative approximation ratio is claimed. The rotation animation simply reruns the numerical fixed-direction solver.

## 5. Validation and limitations

Every global candidate is checked against **all original points**, using clamped orthogonal projection onto the segment. This distance routine is independent of the disk-interval calculation. The displayed fixed-direction candidate receives the same check.

- Radius must be positive and all coordinates finite. The UI uses at most 100 points in a 900 × 560 drawing.
- Calculations use JavaScript double precision. Distance comparisons allow `1e-7` units; near-tangent radicands are clamped to zero only after checking this tolerance.
- Hull orientation uses the ordinary cross product, without adaptive exact predicates. Extremely large coordinates or nearly collinear data are outside this prototype's robustness guarantees.
- Width above `2r + 1e-7` yields `infeasible`. A failed angular sample yields `sample-miss`, never a proof. Candidates failing distance validation are hidden and reported as numerical failures.
- No exact minimum enclosing circle routine is implemented. Detecting all zero-length cases remains future work.
- Data is kept in memory only; the page is not designed for large datasets or persistent editing.

## 6. Initial measurements

`benchmark.csv` was generated on 10 November 2026 with Node.js 18.19.1, Linux x64, by `node scripts/benchmark.js`. Each row reports the median of five runs after one warm-up, using 180 angles and 25 baseline offsets. Times include hull construction, width computation and validation. Disk-test counts measure just the interval evaluations.

The seeded instances show a substantial reduction in disk tests when n is larger than h, with similar or slightly shorter candidate lengths. Small cases may run slower with numerical offset search; timing differences below a millisecond should not be overinterpreted. These are preliminary examples, not a broad performance evaluation. Compare lengths and operation counts before drawing conclusions from timings.
