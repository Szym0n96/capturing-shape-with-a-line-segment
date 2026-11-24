import { EPSILON, normalizeAngle } from './geometry.js';

const ANGLE_EPS = 1e-12;
const unique = values => values.sort((a, b) => a - b)
  .filter((x, i, all) => i === 0 || x - all[i - 1] > ANGLE_EPS);

// Journal §2.2: support changes (type 4) and strip collapse (type 3).
// Sorting edge directions costs O(h log h); support indices then advance
// monotonically. This does not maintain the circular-arc envelopes.
export function orientationEvents(hull, radius) {
  if (!hull.length) return { events: [], feasibleIntervals: [], sectors: [], advances: 0 };
  const supportAngles = hull.length < 2 ? [] : hull.map((p, i) => {
    const q = hull[(i + 1) % hull.length];
    return normalizeAngle(Math.atan2(q.y - p.y, q.x - p.x));
  });
  const cuts = unique([0, ...supportAngles.filter(a => a > ANGLE_EPS && a < Math.PI - ANGLE_EPS), Math.PI]);
  const records = supportAngles.map(angle => ({ angle, type: 'support' }));
  const sectors = [], intervals = [];
  let minIndex = 0, maxIndex = 0, advances = 0;
  const origin = hull[0];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1], middle = (start + end) / 2;
    const projection = index => {
      const p = hull[index % hull.length];
      return -(p.x - origin.x) * Math.sin(middle) + (p.y - origin.y) * Math.cos(middle);
    };
    if (i === 0) {
      for (let j = 1; j < hull.length; j++) {
        if (projection(j) < projection(minIndex)) minIndex = j;
        if (projection(j) > projection(maxIndex)) maxIndex = j;
      }
    } else {
      while (projection(minIndex + 1) < projection(minIndex)) { minIndex++; advances++; }
      while (projection(maxIndex + 1) > projection(maxIndex)) { maxIndex++; advances++; }
    }
    const a = hull[minIndex % hull.length], b = hull[maxIndex % hull.length];
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    const width = angle => dy * Math.cos(angle) - dx * Math.sin(angle);
    const roots = [];
    if (distance >= 2 * radius) {
      const phase = Math.atan2(-dx, dy), delta = Math.acos(Math.min(1, 2 * radius / distance));
      for (const sign of [-1, 1]) for (const turn of [-1, 0, 1]) {
        const root = phase + sign * delta + turn * 2 * Math.PI;
        if (root >= start - ANGLE_EPS && root <= end + ANGLE_EPS) {
          const angle = Math.max(start, Math.min(end, root));
          roots.push(angle); records.push({ angle: normalizeAngle(angle), type: 'feasibility' });
        }
      }
    }
    const bounds = unique([start, ...roots, end]);
    for (let j = 0; j < bounds.length; j++) {
      // Keep isolated feasible directions, especially at minimum width = 2r.
      if (width(bounds[j]) <= 2 * radius + EPSILON) intervals.push([bounds[j], bounds[j]]);
      if (j + 1 < bounds.length && width((bounds[j] + bounds[j + 1]) / 2) <= 2 * radius + EPSILON) {
        intervals.push([bounds[j], bounds[j + 1]]);
      }
    }
    sectors.push({ start, end, minIndex: minIndex % hull.length, maxIndex: maxIndex % hull.length });
  }
  const feasibleIntervals = [];
  for (const interval of intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = feasibleIntervals.at(-1);
    if (last && interval[0] <= last[1] + ANGLE_EPS) last[1] = Math.max(last[1], interval[1]);
    else feasibleIntervals.push([...interval]);
  }
  const events = [];
  for (const record of records.sort((a, b) => a.angle - b.angle)) {
    const last = events.at(-1);
    if (last && record.angle - last.angle < ANGLE_EPS) {
      if (!last.types.includes(record.type)) last.types.push(record.type);
    } else events.push({ angle: record.angle, types: [record.type] });
  }
  return { events, feasibleIntervals, sectors, advances };
}
