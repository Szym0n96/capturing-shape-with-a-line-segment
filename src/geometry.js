// Coordinates are in drawing units. This is a floating-point prototype.
export const EPSILON = 1e-7;

export function checkInput(points, radius) {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('The radius must be positive and finite.');
  }
  if (!Array.isArray(points) || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new TypeError('Points must have finite x and y coordinates.');
  }
}

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// Andrew's monotone chain, O(n log n). Keep only the ends of collinear runs.
export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
  if (sorted.length <= 2) return sorted;
  const half = sequence => {
    const stack = [];
    for (const p of sequence) {
      while (stack.length >= 2 && cross(stack.at(-2), stack.at(-1), p) <= 0) stack.pop();
      stack.push(p);
    }
    return stack.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function normalizeAngle(angle) {
  return ((angle % Math.PI) + Math.PI) % Math.PI;
}

export function project(points, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return points.map(point => ({ x: point.x * c + point.y * s, y: -point.x * s + point.y * c, point }));
}

export function unproject(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

// A minimum-width strip has a supporting line parallel to a hull edge.
// Deliberately simple O(h²) scan; this is not rotating calipers.
export function minimumWidth(hull) {
  if (hull.length < 2) return { width: 0, angle: 0 };
  let best = { width: Infinity, angle: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const angle = normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x));
    let low = Infinity, high = -Infinity;
    for (const p of hull) {
      const y = -(p.x - a.x) * Math.sin(angle) + (p.y - a.y) * Math.cos(angle);
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    if (high - low < best.width) best = { width: high - low, angle };
  }
  return best;
}

// Independent of the disk/line intersection computation in solver.js.
export function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const squaredLength = dx * dx + dy * dy;
  const t = squaredLength === 0 ? 0 : Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / squaredLength));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function verifySegment(points, segment, radius) {
  const maxDistance = Math.max(0, ...points.map(p => pointSegmentDistance(p, segment.a, segment.b)));
  return { valid: maxDistance <= radius + EPSILON, maxDistance,
    excess: Math.max(0, maxDistance - radius) };
}
