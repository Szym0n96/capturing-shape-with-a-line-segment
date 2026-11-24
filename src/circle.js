// Smallest enclosing circle by shuffled incremental boundary updates.
// Fixed seed makes experiments reproducible. Worst-case work is O(h³).
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const contains = (circle, p) => circle && distance(circle.center, p) <= circle.radius +
  64 * Number.EPSILON * Math.max(1, Math.abs(circle.center.x), Math.abs(circle.center.y), circle.radius);

function diameter(a, b) {
  const center = { x: a.x + (b.x - a.x) / 2, y: a.y + (b.y - a.y) / 2 };
  return { center, radius: distance(a, b) / 2, support: [a, b] };
}

function throughThree(a, b, c) {
  // Translate first; the usual formula with squared absolute coordinates
  // loses much more precision when a small set is far from the origin.
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
  const determinant = 2 * (bx * cy - by * cx);
  if (determinant === 0) {
    return [diameter(a, b), diameter(a, c), diameter(b, c)]
      .sort((u, v) => u.radius - v.radius).find(d => [a, b, c].every(p => contains(d, p)));
  }
  const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const center = { x: a.x + (cy * b2 - by * c2) / determinant,
    y: a.y + (bx * c2 - cx * b2) / determinant };
  return { center, radius: distance(center, a), support: [a, b, c] };
}

export function smallestEnclosingCircle(points) {
  if (!points.length) return null;
  const shuffled = [...points];
  let seed = 0x420;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const j = Math.floor((seed / 2 ** 32) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let circle = null;
  let checks = 0;
  const inside = p => { checks++; return contains(circle, p); };
  for (let i = 0; i < shuffled.length; i++) {
    const a = shuffled[i];
    if (inside(a)) continue;
    circle = { center: { ...a }, radius: 0, support: [a] };
    for (let j = 0; j < i; j++) {
      const b = shuffled[j];
      if (inside(b)) continue;
      circle = diameter(a, b);
      for (let k = 0; k < j; k++) {
        if (!inside(shuffled[k])) circle = throughThree(a, b, shuffled[k]);
      }
    }
  }
  // Report the actual enclosing radius, including accumulated roundoff.
  circle.radius = 0;
  for (const p of points) circle.radius = Math.max(circle.radius, distance(p, circle.center));
  return { ...circle, checks };
}
