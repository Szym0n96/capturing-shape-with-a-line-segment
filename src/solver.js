import { EPSILON, checkInput, convexHull, minimumWidth, project, unproject, verifySegment } from './geometry.js';

export const OFFSET_TOLERANCE = 1e-4;

export function feasibleOffsets(projected, radius) {
  let low = -Infinity, high = Infinity;
  for (const p of projected) {
    low = Math.max(low, p.y - radius);
    high = Math.min(high, p.y + radius);
  }
  if (low > high + EPSILON) return null;
  // At tangency, roundoff can reverse the bounds by a few ulps.
  return low > high ? { low: (low + high) / 2, high: (low + high) / 2 } : { low, high };
}

// The line is {t*u + offset*v}. Each disk cuts out [x-d, x+d].
// The shortest interval meeting them all is [min(right), max(left)],
// or a single point in their common intersection if these bounds overlap.
export function segmentOnLine(projected, radius, offset, stats = null) {
  if (!projected.length) return null;
  if (stats) stats.evaluations++;
  let maxLeft = -Infinity, minRight = Infinity;
  let leftConstraint, rightConstraint;
  for (const p of projected) {
    if (stats) stats.diskTests++;
    const distance = Math.abs(p.y - offset);
    if (distance > radius + EPSILON) return null;
    const reach = Math.sqrt(Math.max(0, (radius - distance) * (radius + distance)));
    if (p.x - reach > maxLeft) { maxLeft = p.x - reach; leftConstraint = p.point; }
    if (p.x + reach < minRight) { minRight = p.x + reach; rightConstraint = p.point; }
  }
  const start = maxLeft <= minRight ? (maxLeft + minRight) / 2 : minRight;
  const end = maxLeft <= minRight ? start : maxLeft;
  return { start, end, offset, length: end - start, active: [leftConstraint, rightConstraint] };
}

function toWorld(candidate, angle) {
  if (!candidate) return null;
  return { ...candidate, angle, a: unproject(candidate.start, candidate.offset, angle),
    b: unproject(candidate.end, candidate.offset, angle) };
}

function bestOf(a, b) {
  return b && (!a || b.length < a.length) ? b : a;
}

// The length is convex in the offset. Golden-section search also handles
// corners and flat zero-length minima, without differentiating circle arcs.
function optimizeOffset(projected, radius, bounds, tolerance, stats) {
  let { low, high } = bounds;
  const evaluate = offset => segmentOnLine(projected, radius, offset, stats);
  let best = bestOf(evaluate(low), evaluate(high));
  const ratio = (Math.sqrt(5) - 1) / 2;
  let c = high - ratio * (high - low), d = low + ratio * (high - low);
  let fc = evaluate(c), fd = evaluate(d);
  best = bestOf(bestOf(best, fc), fd);
  let iterations = 0;
  while (high - low > tolerance && iterations++ < 96) {
    if (fc.length <= fd.length) {
      high = d; d = c; fd = fc;
      c = high - ratio * (high - low); fc = evaluate(c);
      best = bestOf(best, fc);
    } else {
      low = c; c = d; fc = fd;
      d = low + ratio * (high - low); fd = evaluate(d);
      best = bestOf(best, fd);
    }
  }
  best = bestOf(best, evaluate((low + high) / 2));
  return { ...best, offsetBracket: high - low };
}

export function solveFixedOrientation(points, radius, angle, tolerance = OFFSET_TOLERANCE) {
  checkInput(points, radius);
  if (!Number.isFinite(angle) || !Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError('Use a finite angle and a positive finite offset tolerance.');
  }
  if (!points.length) return null;
  const projected = project(points, angle), bounds = feasibleOffsets(projected, radius);
  return bounds ? toWorld(optimizeOffset(projected, radius, bounds, tolerance, null), angle) : null;
}

export function solve(points, radius, { method = 'optimized', angles = 180, offsets = 25 } = {}) {
  checkInput(points, radius);
  if (!['grid', 'optimized'].includes(method)) throw new RangeError('Unknown method.');
  if (!Number.isInteger(angles) || angles < 1 || !Number.isInteger(offsets) || offsets < 2) {
    throw new RangeError('Use at least one orientation and two offset samples.');
  }
  const started = performance.now();
  const hull = convexHull(points), width = minimumWidth(hull);
  const stats = { evaluations: 0, diskTests: 0, orientations: 0 };
  const finish = (status, segment = null) => ({ status, segment, hull, width, stats,
    verification: segment ? verifySegment(points, segment, radius) : null,
    elapsedMs: performance.now() - started });
  if (!points.length) return finish('empty');
  if (width.width > 2 * radius + EPSILON) return finish('infeasible');

  // The baseline uses all points. The improved method uses hull vertices.
  const constraints = method === 'grid' ? points : hull;
  const directions = Array.from({ length: angles }, (_, i) => i * Math.PI / angles);
  // Include a feasibility witness, so a narrow feasible angular interval
  // cannot be missed just because it falls between uniform samples.
  if (method === 'optimized') directions.push(width.angle);
  let best = null;
  for (const angle of directions) {
    stats.orientations++;
    const projected = project(constraints, angle), bounds = feasibleOffsets(projected, radius);
    if (!bounds) continue;
    let candidate = null;
    if (method === 'grid') {
      for (let j = 0; j < offsets; j++) {
        const offset = bounds.low + (bounds.high - bounds.low) * j / (offsets - 1);
        candidate = bestOf(candidate, segmentOnLine(projected, radius, offset, stats));
      }
    } else {
      candidate = optimizeOffset(projected, radius, bounds, OFFSET_TOLERANCE, stats);
    }
    best = bestOf(best, toWorld(candidate, angle));
  }
  if (!best) return finish('sample-miss');
  const result = finish(best.length === 0 ? 'point' : 'candidate', best);
  // Never display an invalid candidate as a successful result.
  if (!result.verification.valid) { result.status = 'numerical-failure'; result.segment = null; }
  return result;
}
