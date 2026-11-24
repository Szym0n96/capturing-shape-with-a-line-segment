import test from 'node:test';
import assert from 'node:assert/strict';
import { convexHull, minimumWidth, pointSegmentDistance, project, unproject, verifySegment } from '../src/geometry.js';
import { feasibleOffsets, segmentOnLine, solve, solveFixedOrientation, OFFSET_TOLERANCE } from '../src/solver.js';
import { examples, randomPoints } from '../src/examples.js';

const point = (x, y) => ({ x, y });
const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('hull removes duplicates and interior points without changing the input', () => {
  const points = [point(0, 0), point(2, 0), point(2, 2), point(0, 2), point(1, 1), point(0, 0)];
  const saved = structuredClone(points);
  assert.deepEqual(convexHull(points), points.slice(0, 4));
  assert.deepEqual(points, saved);
  assert.deepEqual(convexHull([]), []);
  assert.deepEqual(convexHull([point(1, 1), point(1, 1)]), [point(1, 1)]);
  assert.deepEqual(convexHull([point(0, 0), point(1, 1), point(2, 2)]), [point(0, 0), point(2, 2)]);
});

test('minimum width of a rotated rectangle is its short side', () => {
  const points = [point(0, 0), point(8, 0), point(8, 3), point(0, 3)];
  for (const angle of [0, .32, 1.48, 2.91]) {
    const rotated = points.map(p => unproject(p.x, p.y, angle));
    close(minimumWidth(convexHull(rotated)).width, 3);
  }
  close(minimumWidth([point(0, 0), point(4, 7)]).width, 0);
});

test('distance verification handles interior projections, endpoints and zero length', () => {
  const a = point(0, 0), b = point(10, 0);
  close(pointSegmentDistance(point(4, 3), a, b), 3);
  close(pointSegmentDistance(point(13, 4), a, b), 5);
  close(pointSegmentDistance(point(-3, 4), a, b), 5);
  close(pointSegmentDistance(point(3, 4), a, a), 5);
  assert.equal(verifySegment([point(4, 3)], { a, b }, 2).valid, false);
});

test('disk intervals produce the analytic two-point solution', () => {
  const points = [point(0, 0), point(10, 0)], projected = project(points, 0);
  assert.deepEqual(feasibleOffsets(projected, 2), { low: -2, high: 2 });
  const segment = segmentOnLine(projected, 2, 0);
  close(segment.start, 2); close(segment.end, 8); close(segment.length, 6);
  assert.equal(segmentOnLine(projected, 2, 2.01), null);
  assert.equal(feasibleOffsets(project([point(0, 0), point(0, 5)], 0), 2), null);
});

test('both solvers handle empty, single-point, duplicate and two-point inputs', () => {
  for (const method of ['grid', 'optimized']) {
    assert.equal(solve([], 2, { method }).status, 'empty');
    assert.equal(solve([point(3, 4)], 2, { method }).status, 'point');
    assert.equal(solve([point(3, 4), point(3, 4)], 2, { method }).status, 'point');
    close(solve([point(0, 0), point(10, 0)], 2, { method }).segment.length, 6);
    assert.equal(solve([point(0, 0), point(2, 0)], 2, { method }).status, 'point');
  }
});

test('width rejects an impossible square, including just above the threshold', () => {
  const square = [point(0, 0), point(4, 0), point(4, 4), point(0, 4)];
  for (const method of ['grid', 'optimized']) {
    assert.equal(solve(square, 1, { method }).status, 'infeasible');
    assert.equal(solve(square, 2 - 1e-5, { method }).status, 'infeasible');
    const tangent = solve(square, 2, { method });
    assert.equal(tangent.verification.valid, true);
    close(tangent.segment.length, 4);
  }
});

test('a missed sampled direction is not a proof of impossibility', () => {
  const rectangle = [point(-5, -1), point(5, -1), point(5, 1), point(-5, 1)]
    .map(p => unproject(p.x, p.y, .123));
  assert.equal(solve(rectangle, 1, { method: 'grid', angles: 1 }).status, 'sample-miss');
  const improved = solve(rectangle, 1, { angles: 1 });
  assert.ok(improved.segment);
  assert.equal(improved.verification.valid, true);
  close(improved.segment.length, 10);
});

test('fixed direction supports vertical lines, tangency and overlapping intervals', () => {
  close(solveFixedOrientation([point(0, 0), point(0, 10)], 2, Math.PI / 2).length, 6);
  const tangent = solveFixedOrientation([point(0, 0), point(10, 4)], 2, 0);
  close(tangent.length, 10); close(tangent.offset, 2);
  close(solveFixedOrientation([point(0, 0), point(2, 0)], 2, 0).length, 0);
  assert.equal(solveFixedOrientation([point(0, 0), point(0, 10)], 2, 0), null);
  assert.equal(solveFixedOrientation([], 2, 0), null);
});

test('fixed solver agrees with a dense reference scan and with hull reduction', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const points = randomPoints(seed, 30), hull = convexHull(points);
    const angle = minimumWidth(hull).angle, radius = 65;
    const solution = solveFixedOrientation(points, radius, angle);
    const reduced = solveFixedOrientation(hull, radius, angle);
    const projected = project(points, angle), bounds = feasibleOffsets(projected, radius);
    let reference = Infinity;
    for (let j = 0; j <= 2000; j++) {
      reference = Math.min(reference, segmentOnLine(projected, radius,
        bounds.low + (bounds.high - bounds.low) * j / 2000).length);
    }
    assert.ok(solution.length <= reference + 1e-5);
    close(solution.length, reduced.length, 1e-5);
    assert.ok(solution.offsetBracket <= OFFSET_TOLERANCE);
    assert.equal(verifySegment(points, reduced, radius).valid, true);
  }
});

test('random feasible instances satisfy every original point constraint', () => {
  for (let seed = 20; seed < 40; seed++) {
    const points = randomPoints(seed, 50);
    const baseline = solve(points, 65, { method: 'grid', angles: 90 });
    const improved = solve(points, 65, { angles: 90 });
    for (const result of [baseline, improved]) {
      assert.ok(result.segment);
      assert.equal(verifySegment(points, result.segment, 65).valid, true);
      assert.ok(result.stats.diskTests > 0);
    }
    assert.ok(improved.segment.length <= baseline.segment.length + 1e-4);
  }
});

test('analytical two-point length survives rotations and translations', () => {
  for (const angle of [.17, .7, 1.9, 2.8]) {
    const points = [point(0, 0), point(20, 0)].map(p => {
      const q = unproject(p.x, p.y, angle);
      return point(q.x + 250, q.y - 160);
    });
    const result = solve(points, 3, { angles: 12 });
    close(result.segment.length, 14);
    assert.equal(result.verification.valid, true);
  }
});

test('all prepared examples behave as labelled', () => {
  for (const [name, example] of Object.entries(examples)) {
    const result = solve(example.points, example.radius);
    if (name === 'infeasible') assert.equal(result.status, 'infeasible');
    else {
      assert.equal(result.verification.valid, true);
      assert.equal(result.status, ['cluster', 'pointBoundary'].includes(name) ? 'point' : 'candidate');
    }
  }
});

test('invalid solver parameters are rejected', () => {
  for (const radius of [0, -1, NaN, Infinity]) assert.throws(() => solve([], radius), RangeError);
  assert.throws(() => solve([point(NaN, 0)], 1), TypeError);
  assert.throws(() => solve([], 1, { angles: 0 }), RangeError);
  assert.throws(() => solve([], 1, { offsets: 1 }), RangeError);
  assert.throws(() => solve([], 1, { method: 'exact' }), RangeError);
  assert.throws(() => solveFixedOrientation([], 1, NaN), RangeError);
  assert.throws(() => solveFixedOrientation([], 1, 0, 0), RangeError);
});
