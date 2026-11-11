import { convexHull, project, unproject, verifySegment } from './geometry.js';
import { solve, solveFixedOrientation, feasibleOffsets } from './solver.js';
import { examples, randomPoints } from './examples.js';

const $ = id => document.getElementById(id);
const drawing = $('drawing'), scene = $('scene');
let points = [], radius = 62, results = {}, method = 'optimized';
let selected = -1, drag = null, timer = null, animation = null, seed = 42;
const format = value => value.toLocaleString('en', { maximumFractionDigits: 3 });

for (const [key, example] of Object.entries(examples)) {
  $('example').add(new Option(example.label, key));
}
$('example').add(new Option('Custom point set', 'custom'));

function svgElement(tag, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  scene.append(element);
  return element;
}

function line(a, b, attributes) {
  return svgElement('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...attributes });
}

function currentResult() {
  if (!$('inspect').checked) return results[method] ?? null;
  const segment = solveFixedOrientation(convexHull(points), radius, Number($('angle').value) * Math.PI / 180);
  const verification = segment ? verifySegment(points, segment, radius) : null;
  return { segment: verification?.valid ? segment : null, verification, width: results.optimized?.width,
    status: !points.length ? 'empty' : verification && !verification.valid ? 'numerical-failure' : segment ? 'fixed' : 'direction-infeasible' };
}

function render() {
  const result = currentResult(), segment = result?.segment;
  const hull = convexHull(points);
  scene.replaceChildren();
  $('point-count').textContent = `${points.length} points · ${hull.length} hull vertices`;
  if ($('inspect').checked && points.length) {
    const angle = Number($('angle').value) * Math.PI / 180;
    const bounds = feasibleOffsets(project(hull, angle), radius);
    if (bounds) {
      const corners = [[-1600, bounds.low], [1600, bounds.low], [1600, bounds.high], [-1600, bounds.high]]
        .map(([x, y]) => unproject(x, y, angle));
      svgElement('polygon', { points: corners.map(p => `${p.x},${p.y}`).join(' '), fill: '#eab950', opacity: .12 });
      for (const offset of [bounds.low, bounds.high]) {
        line(unproject(-1600, offset, angle), unproject(1600, offset, angle), { stroke: '#b77a18', 'stroke-width': 1, 'stroke-dasharray': '6 6' });
      }
    }
  }
  if ($('show-disks').checked) {
    for (const p of points) {
      svgElement('circle', { cx: p.x, cy: p.y, r: radius, fill: 'none', stroke: '#c6cfd4', 'stroke-width': 1 });
    }
    for (const p of new Set(segment?.active ?? [])) {
      svgElement('circle', { cx: p.x, cy: p.y, r: radius, fill: 'none', stroke: '#b77a18', 'stroke-width': 1.8 });
    }
  }
  if ($('show-hull').checked && hull.length > 1) {
    svgElement('polygon', { points: hull.map(p => `${p.x},${p.y}`).join(' '), fill: 'none',
      stroke: '#7f8996', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });
  }
  if (segment) {
    if (segment.length === 0) {
      svgElement('circle', { cx: segment.a.x, cy: segment.a.y, r: radius, fill: '#176c6b', opacity: .13 });
    } else {
      line(segment.a, segment.b, { stroke: '#176c6b', 'stroke-opacity': .13, 'stroke-width': 2 * radius, 'stroke-linecap': 'round' });
    }
    line(segment.a, segment.b, { stroke: '#176c6b', 'stroke-width': 3 });
    for (const p of [segment.a, segment.b]) {
      svgElement('circle', { cx: p.x, cy: p.y, r: 4, fill: '#fff', stroke: '#176c6b', 'stroke-width': 2 });
    }
  }
  points.forEach((p, i) => {
    svgElement('circle', { cx: p.x, cy: p.y, r: i === selected ? 8 : 5, fill: '#263641',
      stroke: i === selected ? '#b77a18' : '#fff', 'stroke-width': 2 });
  });
  const messages = {
    empty: 'Add points to start an experiment.',
    infeasible: 'No feasible segment: the minimum width exceeds 2r.',
    'sample-miss': 'No grid candidate found. This does not prove infeasibility.',
    'numerical-failure': 'Numerical check failed. The candidate has been hidden.',
    point: 'A zero-length segment covers the points (within numerical tolerance).',
    candidate: 'Feasible candidate found · global optimum not certified.',
    fixed: 'Fixed direction · offset optimized numerically.',
    'direction-infeasible': 'No feasible line in this direction. Other directions may work.',
  };
  $('status').textContent = result ? messages[result.status] : 'Updating the point set…';
  $('status').classList.toggle('warning', ['infeasible', 'sample-miss', 'direction-infeasible', 'numerical-failure'].includes(result?.status));
  $('metrics').replaceChildren();
  const metrics = [
    ['Displayed length', segment ? format(segment.length) : '—'],
    ['Max. distance / r', segment ? `${format(result.verification.maxDistance)} / ${radius}` : '—'],
    ['Min. width / 2r', result?.width && points.length ? `${format(result.width.width)} / ${2 * radius}` : '—'],
    ['Displayed angle', segment ? `${format(segment.angle * 180 / Math.PI)}°` : '—'],
  ];
  for (const [label, value] of metrics) {
    const div = document.createElement('div'), strong = document.createElement('strong');
    div.textContent = label; strong.textContent = value; div.append(strong); $('metrics').append(div);
  }
  for (const key of ['grid', 'optimized']) {
    const row = $(`${key}-row`), value = results[key];
    const cells = row.querySelectorAll('td');
    cells[0].textContent = value?.segment ? format(value.segment.length) : '—';
    cells[1].textContent = value ? value.elapsedMs.toFixed(2) : '—';
    cells[2].textContent = value ? format(value.stats.diskTests) : '—';
    row.classList.toggle('selected', key === method && !$('inspect').checked);
  }
}

function calculate() {
  clearTimeout(timer);
  const options = { angles: Number($('angles').value), offsets: Number($('offsets').value) };
  results = { grid: solve(points, radius, { ...options, method: 'grid' }),
    optimized: solve(points, radius, { ...options, method: 'optimized' }) };
  render();
}

function changed() {
  results = {};
  clearTimeout(timer);
  render();
  timer = setTimeout(calculate, 100);
}

function stopAnimation() {
  clearInterval(animation); animation = null; $('animate').textContent = 'Play rotation';
}

function markCustom() {
  $('example').value = 'custom'; $('dataset-note').textContent = 'Custom point set';
}

function loadExample(key) {
  const example = examples[key];
  if (!example) return;
  stopAnimation(); $('inspect').checked = false;
  points = example.points.map(p => ({ ...p })); radius = example.radius; selected = -1;
  $('radius').value = radius; $('radius-label').value = radius;
  $('dataset-note').textContent = 'Prepared example'; calculate();
}

$('example').addEventListener('change', event => loadExample(event.target.value));
$('random').addEventListener('click', () => {
  stopAnimation(); $('inspect').checked = false; selected = -1;
  points = randomPoints(seed); radius = 65;
  $('radius').value = radius; $('radius-label').value = radius; markCustom();
  $('dataset-note').textContent = `30 points · seed ${seed++}`; calculate();
});
$('clear').addEventListener('click', () => {
  stopAnimation(); points = []; selected = -1; markCustom(); calculate();
});
$('radius').addEventListener('input', event => {
  radius = Number(event.target.value); $('radius-label').value = radius; changed();
});
for (const id of ['angles', 'offsets']) $(id).addEventListener('change', calculate);
for (const id of ['show-disks', 'show-hull']) $(id).addEventListener('change', render);
$('inspect').addEventListener('change', () => { stopAnimation(); render(); });
$('angle').addEventListener('input', () => {
  stopAnimation(); $('inspect').checked = true;
  $('angle-label').value = `${$('angle').value}°`; render();
});
$('animate').addEventListener('click', () => {
  if (animation) { stopAnimation(); return; }
  $('inspect').checked = true; $('animate').textContent = 'Pause rotation';
  animation = setInterval(() => {
    $('angle').value = (Number($('angle').value) + 1) % 180;
    $('angle-label').value = `${$('angle').value}°`; render();
  }, 80);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAnimation(); });
document.querySelectorAll('input[name=method]').forEach(input => input.addEventListener('change', () => {
  method = input.value; $('inspect').checked = false; stopAnimation(); render();
}));

function pointerPosition(event) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(drawing.getScreenCTM().inverse());
  return { x: Math.max(10, Math.min(890, p.x)), y: Math.max(10, Math.min(550, p.y)) };
}

drawing.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  stopAnimation(); drawing.focus();
  const p = pointerPosition(event);
  const hitRadius = 12 * 900 / drawing.getBoundingClientRect().width;
  selected = points.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < hitRadius);
  if (event.shiftKey) {
    if (selected >= 0) { points.splice(selected, 1); selected = -1; markCustom(); calculate(); }
    return;
  }
  if (selected < 0) {
    if (points.length >= 100) return;
    points.push(p); selected = points.length - 1; markCustom(); changed();
  }
  drag = selected; drawing.setPointerCapture(event.pointerId); render();
});
drawing.addEventListener('pointermove', event => {
  if (drag === null) return;
  points[drag] = pointerPosition(event); results = {}; clearTimeout(timer); markCustom(); render();
});
function endDrag() { if (drag !== null) { drag = null; calculate(); } }
drawing.addEventListener('pointerup', endDrag);
drawing.addEventListener('pointercancel', endDrag);
drawing.addEventListener('lostpointercapture', endDrag);
drawing.addEventListener('keydown', event => {
  // Tab traverses the points, then leaves the drawing normally at either end.
  if (event.key === 'Tab' && points.length) {
    const next = selected + (event.shiftKey ? -1 : 1);
    if (next >= 0 && next < points.length) { event.preventDefault(); selected = next; render(); }
    return;
  }
  if (event.key === 'Enter' && points.length < 100) {
    event.preventDefault(); points.push({ x: 450, y: 280 }); selected = points.length - 1;
    markCustom(); changed(); return;
  }
  if (selected < 0 || selected >= points.length) return;
  const p = points[selected], step = event.shiftKey ? 10 : 2;
  if (event.key === 'Delete' || event.key === 'Backspace') { points.splice(selected, 1); selected = -1; }
  else if (event.key === 'ArrowLeft') p.x = Math.max(10, p.x - step);
  else if (event.key === 'ArrowRight') p.x = Math.min(890, p.x + step);
  else if (event.key === 'ArrowUp') p.y = Math.max(10, p.y - step);
  else if (event.key === 'ArrowDown') p.y = Math.min(550, p.y + step);
  else return;
  event.preventDefault(); stopAnimation(); markCustom(); changed();
});

loadExample('elongated');
