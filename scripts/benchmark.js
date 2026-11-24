import { solve } from '../src/solver.js';
import { examples, randomPoints } from '../src/examples.js';

// Output is CSV; redirect it to a file to retain a particular run.
const instances = [
  ...Object.entries(examples).map(([name, example]) => ({ name, ...example })),
  ...[30, 100].map(n => ({ name: `random-${n}-seed42`, points: randomPoints(42, n), radius: 65 })),
];
console.log('instance,n,h,radius,method,angles,offsets,status,length,max_distance,median_ms,disk_tests');
for (const instance of instances) {
  for (const method of ['grid', 'optimized', 'events']) {
    // One warm-up, then five timed runs. Time includes preprocessing/validation.
    solve(instance.points, instance.radius, { method });
    const runs = Array.from({ length: 5 }, () => solve(instance.points, instance.radius, { method }));
    const result = runs[0], median = runs.map(r => r.elapsedMs).sort((a, b) => a - b)[2];
    if (result.verification && !result.verification.valid) throw new Error(`Invalid result: ${instance.name}`);
    console.log([instance.name, instance.points.length, result.hull.length, instance.radius, method,
      180, method === 'grid' ? 25 : '', result.status, result.segment?.length.toFixed(6) ?? '',
      result.verification?.maxDistance.toFixed(6) ?? '', median.toFixed(3), result.stats.diskTests].join(','));
  }
}
