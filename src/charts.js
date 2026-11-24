import { project, capsuleIntersectsDisk } from './geometry.js';
import { feasibleOffsets, segmentOnLine } from './solver.js';

const $ = id => document.getElementById(id);
const fmt = x => Number(x.toFixed(3)).toString();
function element(root, tag, attrs, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  root.append(node);
  return node;
}
function label(root, x, y, text, attrs = {}) {
  return element(root, 'text', { x, y, fill: '#475866', 'font-size': 14, ...attrs }, text);
}
function axes(root, maxY, lowX, highX, unit) {
  element(root, 'path', { d: 'M 55 20 V 190 H 540', fill: 'none', stroke: '#aab5bc' });
  label(root, 8, 28, fmt(maxY)); label(root, 35, 193, '0');
  label(root, 55, 215, fmt(lowX)); label(root, 540, 215, `${fmt(highX)} ${unit}`, { 'text-anchor': 'end' });
}
function empty(root, message) { root.replaceChildren(); label(root, 25, 105, message); }

export function renderOrientationChart(result, angle) {
  const root = $('orientation-chart'); root.replaceChildren();
  if (!result?.trace.length) {
    empty(root, result?.status === 'point' ? 'A point solution is valid for every direction.' : 'No orientation profile for this input.');
    return;
  }
  const samples = result.trace, max = Math.max(1, ...samples.map(p => p.length ?? 0)) * 1.05;
  const x = a => 55 + a / Math.PI * 485, y = length => 190 - length / max * 170;
  for (const [a, b] of result.eventData.feasibleIntervals) {
    element(root, 'rect', { x: x(a), y: 20, width: Math.max(1, x(b) - x(a)), height: 170, fill: '#e7f2ef' });
  }
  for (const event of result.eventData.events) {
    element(root, 'line', { x1: x(event.angle), x2: x(event.angle), y1: 20, y2: 190,
      stroke: event.types.includes('feasibility') ? '#b77a18' : '#bcc5cb', 'stroke-dasharray': '3 4' });
  }
  let path = '', previous = null;
  for (const p of samples) {
    if (p.length === null) { previous = null; continue; }
    const connected = previous && result.eventData.feasibleIntervals.some(([a, b]) => previous.angle >= a - 1e-12 && p.angle <= b + 1e-12);
    path += `${connected ? 'L' : 'M'}${x(p.angle)},${y(p.length)} `;
    element(root, 'circle', { cx: x(p.angle), cy: y(p.length), r: 2, fill: '#176c6b' });
    previous = p;
  }
  element(root, 'path', { d: path, fill: 'none', stroke: '#176c6b', 'stroke-width': 1.5 });
  element(root, 'line', { x1: x(angle), x2: x(angle), y1: 20, y2: 190, stroke: '#244f9b', 'stroke-width': 2 });
  axes(root, max, 0, 180, '°');
}

export function renderFixedCharts(points, hull, radius, angle, segment) {
  const root = $('offset-chart'), intervalsRoot = $('interval-chart');
  root.replaceChildren(); intervalsRoot.replaceChildren();
  const projected = project(hull, angle), bounds = feasibleOffsets(projected, radius);
  if (!bounds) {
    empty(root, points.length ? 'No feasible line in this direction.' : 'Add points to explore line positions.');
    empty(intervalsRoot, 'No disk intervals to display.');
    $('fixed-description').textContent = 'The feasible strip is empty in this direction.';
    $('interval-description').textContent = '';
    return;
  }
  const samples = Array.from({ length: 81 }, (_, i) => {
    const offset = bounds.low + (bounds.high - bounds.low) * i / 80;
    return { offset, length: segmentOnLine(projected, radius, offset)?.length ?? 0 };
  });
  const max = Math.max(1, ...samples.map(s => s.length)) * 1.05;
  const x = offset => bounds.high === bounds.low ? 297 : 55 + (offset - bounds.low) / (bounds.high - bounds.low) * 485;
  const y = length => 190 - length / max * 170;
  element(root, 'path', { d: samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.offset)},${y(s.length)}`).join(' '),
    fill: 'none', stroke: '#176c6b', 'stroke-width': 2 });
  if (segment) element(root, 'circle', { cx: x(segment.offset), cy: y(segment.length), r: 5, fill: '#b77a18' });
  axes(root, max, bounds.low, bounds.high, '');
  $('fixed-description').textContent = `Direction ${fmt(angle * 180 / Math.PI)}°. Feasible offsets: [${fmt(bounds.low)}, ${fmt(bounds.high)}]. ` +
    (bounds.low === bounds.high ? 'The strip collapses to one line.' : 'The convex length function is sampled for this plot; the dot marks the displayed line.');
  if (!segment) { empty(intervalsRoot, 'Select a feasible line to inspect its intervals.'); return; }
  const intervals = projected.map(p => {
    const d = Math.abs(p.y - segment.offset), reach = Math.sqrt(Math.max(0, (radius - d) * (radius + d)));
    return { point: p.point, low: p.x - reach, high: p.x + reach };
  });
  const lo = Math.min(...intervals.map(p => p.low)), hi = Math.max(...intervals.map(p => p.high));
  const ix = value => 70 + (value - lo) / Math.max(1, hi - lo) * 800;
  const active = p => segment.active.includes(p.point);
  const visible = [...intervals].sort((a, b) => Number(active(b)) - Number(active(a))).slice(0, 12);
  const A = Math.max(...intervals.map(p => p.low)), B = Math.min(...intervals.map(p => p.high));
  element(intervalsRoot, 'rect', { x: ix(segment.start), y: 12, width: Math.max(2, ix(segment.end) - ix(segment.start)),
    height: visible.length * 17 + 10, fill: '#d9ede7' });
  visible.forEach((p, i) => {
    const row = 25 + i * 17, color = active(p) ? '#b77a18' : '#7f8996';
    label(intervalsRoot, 8, row + 4, `P${points.indexOf(p.point) + 1}`);
    element(intervalsRoot, 'line', { x1: ix(p.low), x2: ix(p.high), y1: row, y2: row, stroke: color, 'stroke-width': 2 });
    for (const end of [p.low, p.high]) element(intervalsRoot, 'circle', { cx: ix(end), cy: row, r: 3, fill: color });
  });
  label(intervalsRoot, 70, 245, `B = min(right) = ${fmt(B)}    A = max(left) = ${fmt(A)}    length = max(0, A − B) = ${fmt(segment.length)}`);
  $('interval-description').textContent = `${visible.length} of ${hull.length} hull intervals shown, with endpoint constraints first. ` +
    (A <= B ? 'The intervals share a common point: zero length is sufficient.' : 'The shaded interval [B, A] is the shortest segment meeting every disk interval.');
}

export function renderCollision(points, radius, segment) {
  const root = $('collision-chart'); root.replaceChildren();
  if (!segment) { empty(root, 'A feasible capsule is needed.'); $('collision-status').textContent = 'No displayed segment.'; return; }
  const a = segment.a, b = segment.b;
  if (segment.length === 0) element(root, 'circle', { cx: a.x, cy: a.y, r: radius, fill: '#d9ede7' });
  else element(root, 'line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#d9ede7', 'stroke-width': 2 * radius, 'stroke-linecap': 'round' });
  element(root, 'line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#176c6b', 'stroke-width': 3 });
  for (const p of points) element(root, 'circle', { cx: p.x, cy: p.y, r: 4, fill: '#263641' });
  const center = { x: Number($('probe-x').value), y: Number($('probe-y').value) }, probeRadius = Number($('probe-radius').value);
  const overlaps = capsuleIntersectsDisk(segment, radius, center, probeRadius);
  element(root, 'circle', { cx: center.x, cy: center.y, r: probeRadius, fill: overlaps ? '#f4d7cb' : '#e2eaf7',
    stroke: overlaps ? '#a44626' : '#244f9b', 'stroke-width': 3 });
  $('collision-status').textContent = `${overlaps ? 'Overlap' : 'Separated'} · probe (${center.x}, ${center.y}), radius ${probeRadius}.`;
}
