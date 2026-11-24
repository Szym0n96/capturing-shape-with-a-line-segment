import test from 'node:test';
import assert from 'node:assert/strict';
import { convexHull, minimumWidth, minimumWidthBrute, project, unproject, verifySegment, capsuleIntersectsDisk } from '../src/geometry.js';
import { smallestEnclosingCircle } from '../src/circle.js';
import { orientationEvents } from '../src/events.js';
import { solve, solveFixedOrientation, solveAtOffset } from '../src/solver.js';
import { examples, randomPoints } from '../src/examples.js';
import { parseDataset, serializeDataset } from '../src/data.js';

const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const widthAt = (points, angle) => {
  const ys = project(points, angle).map(p => p.y);
  return Math.max(...ys) - Math.min(...ys);
};
function randomSquare(seed, n) {
  let state = seed;
  const next = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 2 ** 32; };
  return Array.from({ length: n }, () => ({ x: 10 * next(), y: 10 * next() }));
}

// Independent exhaustive oracle: enumerate all possible supports (≤ 3 points)
// and select the smallest candidate that contains the whole input.
function exhaustiveCircle(points) {
  const candidates = points.map(p => ({ x: p.x, y: p.y, r: 0 }));
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const a = points[i], b = points[j];
    candidates.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: Math.hypot(a.x - b.x, a.y - b.y) / 2 });
    for (let k = j + 1; k < points.length; k++) {
      const c = points[k];
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-12) continue;
      const aa = a.x * a.x + a.y * a.y, bb = b.x * b.x + b.y * b.y, cc = c.x * c.x + c.y * c.y;
      const x = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
      const y = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
      candidates.push({ x, y, r: Math.hypot(x - a.x, y - a.y) });
    }
  }
  return candidates.filter(c => points.every(p => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 1e-8))
    .sort((a, b) => a.r - b.r)[0];
}

test('calipers agree with the quadratic width oracle on random and convex sets', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const hull = convexHull(randomSquare(seed, 80));
    const result = minimumWidth(hull);
    close(result.width, minimumWidthBrute(hull).width);
    assert.ok(result.advances <= 2 * hull.length);
  }
  const polygon = Array.from({ length: 1000 }, (_, i) => ({ x: Math.cos(i * Math.PI / 500), y: Math.sin(i * Math.PI / 500) }));
  const result = minimumWidth(polygon);
  close(result.width, 2 * Math.cos(Math.PI / 1000));
  assert.ok(result.advances <= 2 * polygon.length);
  assert.ok(result.tests < 8 * polygon.length);
});

test('enclosing circle agrees with an exhaustive independent oracle', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const points = randomSquare(seed, 8), circle = smallestEnclosingCircle(points);
    close(circle.radius, exhaustiveCircle(points).r);
    assert.equal(verifySegment(points, { a: circle.center, b: circle.center }, circle.radius).valid, true);
  }
});

test('enclosing circle handles acute, obtuse, collinear, duplicate and translated inputs', () => {
  for (const points of [
    [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 1e-10 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 2, y: 1 }],
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) }],
  ]) {
    const expected = exhaustiveCircle(points).r;
    close(smallestEnclosingCircle(points).radius, expected);
    close(smallestEnclosingCircle(points.map(p => ({ x: p.x + 1e6, y: p.y - 2e6 }))).radius, expected);
  }
  assert.equal(smallestEnclosingCircle([]), null);
});

test('zero-length threshold is independent of the sampled directions', () => {
  const { points, radius } = examples.pointBoundary;
  for (const method of ['grid', 'optimized', 'events']) {
    assert.equal(solve(points, radius, { method, angles: 1 }).status, 'point');
    const above = solve(points, radius - .01, { method: 'events' });
    assert.ok(above.segment.length > 0);
    assert.ok(above.lowerBound > 0);
  }
  assert.notEqual(solve(examples.triangle.points, 100, { method: 'events' }).status, 'point');
});

test('analytic event intervals agree with direct width checks over the whole rotation', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const hull = convexHull(randomSquare(seed, 20));
    for (const radius of [2, 4, 6]) {
      const data = orientationEvents(hull, radius);
      for (let i = 0; i < 400; i++) {
        const angle = (i + .314) * Math.PI / 400;
        const predicted = data.feasibleIntervals.some(([a, b]) => angle >= a - 1e-12 && angle <= b + 1e-12);
        assert.equal(predicted, widthAt(hull, angle) <= 2 * radius, `seed ${seed}, radius ${radius}, angle ${angle}`);
      }
      for (const event of data.events.filter(e => e.types.includes('feasibility'))) {
        close(widthAt(hull, event.angle), 2 * radius);
      }
      assert.ok(data.advances <= 2 * hull.length);
    }
  }
});

test('isolated feasible directions and the 0/π seam are retained', () => {
  for (const angle of [0, .001, .347, Math.PI - .001]) {
    const points = [{ x: -10, y: -1 }, { x: 10, y: -1 }, { x: 10, y: 1 }, { x: -10, y: 1 }]
      .map(p => unproject(p.x, p.y, angle));
    const hull = convexHull(points), data = orientationEvents(hull, 1);
    assert.ok(data.feasibleIntervals.length > 0);
    for (const [a, b] of data.feasibleIntervals) close(widthAt(hull, (a + b) / 2), 2);
    const result = solve(points, 1, { method: 'events', angles: 1 });
    assert.equal(result.verification.valid, true);
    close(result.segment.length, 20, 1e-5);
  }
});

test('event search improves or retains the shared angular candidates', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const points = randomPoints(seed, 40);
    const optimized = solve(points, 65, { angles: 36 });
    let previous = optimized.segment.length;
    for (const refinements of [0, 2, 6]) {
      const result = solve(points, 65, { method: 'events', angles: 36, refinements, trace: true });
      assert.equal(result.verification.valid, true);
      assert.ok(result.segment.length <= previous + 1e-7);
      assert.ok(result.lowerBound <= result.segment.length + 1e-7);
      assert.equal(result.trace.length, result.stats.orientations);
      previous = result.segment.length;
    }
  }
});

test('a very narrow angular interval remains searchable', () => {
  const { points, radius } = examples.narrow;
  assert.equal(solve(points, radius, { method: 'grid', angles: 36 }).status, 'sample-miss');
  const result = solve(points, radius, { method: 'events', angles: 36 });
  assert.equal(result.verification.valid, true);
  assert.ok(result.eventData.events.some(e => e.types.includes('feasibility')));
});

test('hull ablation keeps the same solution at the same orientations', () => {
  const points = randomPoints(42, 100);
  const all = solve(points, 65, { useHull: false });
  const hull = solve(points, 65, { useHull: true });
  close(all.segment.length, hull.segment.length);
  assert.ok(hull.stats.diskTests < all.stats.diskTests);
});

test('manual offset and numerical offset solutions use the same line geometry', () => {
  const { points, radius } = examples.elongated;
  const angle = minimumWidth(convexHull(points)).angle;
  const fixed = solveFixedOrientation(points, radius, angle);
  const manual = solveAtOffset(points, radius, angle, fixed.offset);
  close(manual.length, fixed.length);
  assert.equal(verifySegment(points, manual, radius).valid, true);
  assert.equal(solveAtOffset(points, radius, 0, 10000), null);
  assert.throws(() => solveAtOffset(points, radius, NaN, 0), RangeError);
});

test('circle lower bound is exact for two-point and collinear instances', () => {
  for (const method of ['grid', 'optimized', 'events']) {
    const result = solve(examples.collinear.points, 45, { method });
    close(result.lowerBound, 430);
    close(result.gapToLowerBound, 0);
  }
});

test('capsule collision includes tangent contacts and handles a point capsule', () => {
  const segment = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
  assert.equal(capsuleIntersectsDisk(segment, 2, { x: 5, y: 3 }, 1), true);
  assert.equal(capsuleIntersectsDisk(segment, 2, { x: 5, y: 3.01 }, 1), false);
  assert.equal(capsuleIntersectsDisk(segment, 2, { x: 13, y: 0 }, 1), true);
  assert.equal(capsuleIntersectsDisk({ a: segment.a, b: segment.a }, 2, { x: 0, y: 3 }, 1), true);
});

test('datasets round-trip and reject malformed or oversized input', () => {
  const { points, radius } = examples.elongated, options = { angles: 180, offsets: 25, refinements: 6 };
  assert.deepEqual(parseDataset(serializeDataset(points, radius, options)), { points, radius, options });
  for (const data of [{}, { schemaVersion: 1, points: [null], radius: 2 },
    { schemaVersion: 1, points: [{ x: -1, y: 0 }], radius: 2 },
    { schemaVersion: 1, points: Array(101).fill({ x: 0, y: 0 }), radius: 2 },
    { schemaVersion: 1, points: [], radius: 2, options: { angles: 0 } }]) {
    assert.throws(() => parseDataset(JSON.stringify(data)));
  }
  assert.throws(() => parseDataset('invalid JSON'));
});

test('new numeric options are validated', () => {
  assert.throws(() => solve([], 1, { refinements: -1 }), RangeError);
  assert.throws(() => solve([], 1, { refinements: 21 }), RangeError);
  assert.throws(() => solve([], 1, { offsetTolerance: 0 }), RangeError);
  assert.throws(() => solve([null], 1), TypeError);
});
