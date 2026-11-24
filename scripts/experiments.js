// Full, deterministic experiment suite. Node >= 18; no dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, arch, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { solve, solveFixedOrientation } from '../src/solver.js';
import { convexHull, minimumWidth, minimumWidthBrute, verifySegment } from '../src/geometry.js';
import { examples, randomPoints } from '../src/examples.js';

const directory = fileURLToPath(new URL('../docs/experiments/', import.meta.url));
mkdirSync(directory, { recursive: true });
const methods = ['grid', 'optimized', 'events'];
const defaults = { angles: 180, offsets: 25, refinements: 6, offsetTolerance: 1e-4 };
const referenceOptions = { method: 'events', angles: 4096, refinements: 12, offsetTolerance: 1e-7 };
const repetitions = 5, records = {};
function csv(name, rows) {
  records[name] = rows.length;
  const keys = Object.keys(rows[0]);
  const cell = v => v === null || v === undefined ? '' : String(v);
  writeFileSync(directory + name + '.csv', [keys.join(','), ...rows.map(row => keys.map(k => cell(row[k])).join(','))].join('\n') + '\n');
  console.log(`${name}: ${rows.length} rows`);
}
function measure(instance, options = {}) {
  const args = { ...defaults, ...options };
  solve(instance.points, instance.radius, args); // warm-up, excluded
  const runs = Array.from({ length: repetitions }, () => solve(instance.points, instance.radius, args));
  const result = runs[0];
  if (result.status === 'numerical-failure' || result.verification && !result.verification.valid) {
    throw new Error(`Invalid candidate: ${instance.name}`);
  }
  return { instance: instance.name, n: instance.points.length, h: result.hull.length,
    radius: instance.radius, method: args.method, angles: args.angles, offsets: args.offsets,
    refinements: args.refinements, tolerance: args.offsetTolerance, status: result.status,
    length: result.segment?.length ?? null, lower_bound: result.lowerBound,
    max_distance: result.verification?.maxDistance ?? null, excess: result.verification?.excess ?? null,
    median_ms: runs.map(r => r.elapsedMs).sort((a, b) => a - b)[2],
    disk_tests: result.stats.diskTests, orientations: result.stats.orientations,
    feasible_orientations: result.stats.feasibleOrientations, circle_checks: result.stats.circleChecks };
}
const regular = n => Array.from({ length: n }, (_, i) => ({ x: 450 + 200 * Math.cos(2 * Math.PI * i / n), y: 280 + 200 * Math.sin(2 * Math.PI * i / n) }));
const designed = Object.entries(examples).map(([name, e]) => ({ name, ...e }));
const random = [30, 100].flatMap(n => [1, 2, 3, 4, 5].map(seed => ({
  name: `random-${n}-seed${seed}`, points: randomPoints(seed, n), radius: 65 })));
const boundary = [-1e-4, 0, 1e-4].map(delta => ({ name: `width-boundary-${delta}`, points: regular(4), radius: Math.SQRT2 * 100 + delta }));
const instances = [...designed, ...random, ...boundary];
writeFileSync(directory + 'instances.json', JSON.stringify(instances, null, 2) + '\n');

// A denser search is a reference candidate, not an exact oracle or error bound.
const quality = [];
for (const instance of instances) {
  const reference = solve(instance.points, instance.radius, referenceOptions);
  if (reference.status === 'numerical-failure') throw new Error(`Reference failed: ${instance.name}`);
  for (const method of methods) {
    const row = measure(instance, { method });
    quality.push({ ...row, reference_status: reference.status, reference_length: reference.segment?.length ?? null,
      difference_to_reference: row.length !== null && reference.segment ? row.length - reference.segment.length : null });
  }
}
csv('quality', quality);

const scaling = [], ablation = [], widthRows = [];
for (const n of [10, 30, 100, 300, 1000]) {
  for (const seed of [1, 2, 3]) {
    const instance = { name: `random-${n}-seed${seed}`, points: randomPoints(seed, n), radius: 65 };
    for (const method of methods) scaling.push(measure(instance, { method }));
    for (const useHull of [false, true]) ablation.push({ ...measure(instance, { method: 'optimized', useHull }), use_hull: useHull });
  }
  // All vertices on the hull: no hull reduction, narrow feasible components.
  const poly = regular(n), width = minimumWidth(poly).width;
  const instance = { name: `regular-${n}`, points: poly, radius: (width / 2 + 200) / 2 };
  for (const method of methods) scaling.push(measure(instance, { method }));
  for (const algorithm of ['calipers', 'brute']) {
    const fn = algorithm === 'calipers' ? minimumWidth : minimumWidthBrute;
    fn(poly);
    const times = Array.from({ length: repetitions }, () => { const start = performance.now(); fn(poly); return performance.now() - start; });
    const answer = fn(poly);
    widthRows.push({ n, algorithm, width: answer.width, median_ms: times.sort((a, b) => a - b)[2], advances: answer.advances ?? null, tests: answer.tests ?? n * n });
  }
}
csv('scaling', scaling); csv('hull-ablation', ablation); csv('width', widthRows);

const resolution = [];
for (const instance of [designed[0], designed.find(e => e.name === 'narrow'), random[0]]) {
  const ref = solve(instance.points, instance.radius, referenceOptions);
  for (const angles of [36, 90, 180, 360, 720]) for (const method of methods) {
    const row = measure(instance, { method, angles });
    resolution.push({ ...row, reference_length: ref.segment.length,
      difference_to_reference: row.length === null ? null : row.length - ref.segment.length });
  }
}
csv('resolution', resolution);

const toleranceRows = [];
for (const instance of [designed[0], random[0], designed.find(e => e.name === 'triangle')]) {
  const hull = convexHull(instance.points), angle = minimumWidth(hull).angle;
  const reference = solveFixedOrientation(hull, instance.radius, angle, 1e-10);
  for (const tolerance of [1, .1, .01, .001, .0001, .000001]) {
    const result = solveFixedOrientation(hull, instance.radius, angle, tolerance);
    const check = verifySegment(instance.points, result, instance.radius);
    if (!check.valid) throw new Error('Fixed-direction verification failed');
    toleranceRows.push({ instance: instance.name, tolerance, angle, length: result.length,
      reference_length: reference.length, difference_to_reference: result.length - reference.length,
      bracket: result.offsetBracket, converged: result.offsetConverged, excess: check.excess });
  }
}
csv('offset-tolerance', toleranceRows);

// Separately sample offsets densely, avoiding golden-section minimization.
const denseRows = [];
for (const instance of [designed[0], random[0], designed.find(e => e.name === 'triangle')]) {
  const dense = measure(instance, { method: 'grid', angles: 1440, offsets: 401 });
  const event = measure(instance, { method: 'events' });
  denseRows.push({ instance: instance.name, grid_length: dense.length, events_length: event.length,
    grid_minus_events: dense.length - event.length, grid_ms: dense.median_ms, events_ms: event.median_ms });
}
csv('dense-grid', denseRows);
writeFileSync(directory + 'metadata.json', JSON.stringify({ generated: new Date().toISOString(),
  node: process.version, os: `${platform()} ${release()} ${arch()}`, cpu: cpus()[0]?.model,
  logical_cpus: cpus().length, defaults, referenceOptions, repetitions, warmups: 1,
  timer: 'performance.now; whole solve including preprocessing and verification',
  counts: 'disk_tests counts disk-line interval tests only; excludes preprocessing and verification',
  seeds: 'random quality: 1–5; scaling/ablation: 1–3; deterministic LCG in src/examples.js',
  reference_limit: 'Dense numerical candidate; not an exact optimum. Signed differences can be negative.', records }, null, 2) + '\n');
