import { checkInput } from './geometry.js';

// Small, portable format for reproducing an experiment in the editor.
export function parseDataset(text) {
  const data = JSON.parse(text);
  if (!data || data.schemaVersion !== 1) throw new Error('Expected a dataset with schemaVersion: 1.');
  checkInput(data.points, data.radius);
  if (data.points.length > 100) throw new Error('The editor supports at most 100 points.');
  if (data.radius < 1 || data.radius > 200 ||
      data.points.some(p => p.x < 0 || p.x > 900 || p.y < 0 || p.y > 560)) {
    throw new Error('Use x in [0, 900], y in [0, 560] and radius in [1, 200].');
  }
  const options = { angles: 180, offsets: 25, refinements: 6, ...data.options };
  for (const [name, min, max] of [['angles', 1, 1440], ['offsets', 2, 1001], ['refinements', 0, 20]]) {
    if (!Number.isInteger(options[name]) || options[name] < min || options[name] > max) {
      throw new Error(`Invalid ${name}: expected an integer in [${min}, ${max}].`);
    }
  }
  return { points: data.points.map(({ x, y }) => ({ x, y })), radius: data.radius,
    options: { angles: options.angles, offsets: options.offsets, refinements: options.refinements } };
}

export function serializeDataset(points, radius, options) {
  return JSON.stringify({ schemaVersion: 1, points, radius, options }, null, 2) + '\n';
}
