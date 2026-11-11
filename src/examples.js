const points = pairs => pairs.map(([x, y]) => ({ x, y }));

export const examples = {
  elongated: { label: 'Elongated group', radius: 62, points: points([
    [175, 350], [215, 315], [255, 365], [290, 290], [340, 335], [370, 270],
    [415, 315], [460, 245], [500, 290], [545, 225], [590, 270], [640, 205], [710, 225],
  ]) },
  cluster: { label: 'A single point is enough', radius: 90, points: points([
    [390, 260], [420, 220], [465, 225], [505, 265], [480, 320], [425, 330], [445, 275],
  ]) },
  collinear: { label: 'Collinear points', radius: 45, points: points([
    [190, 280], [300, 280], [450, 280], [555, 280], [710, 280],
  ]) },
  infeasible: { label: 'No feasible segment', radius: 60, points: points([
    [290, 120], [610, 120], [610, 440], [290, 440], [450, 280],
  ]) },
  tangent: { label: 'Boundary case: width = 2r', radius: 60, points: points([
    [220, 220], [680, 220], [680, 340], [220, 340],
  ]) },
};

// Deterministic instances shared by the demo and the benchmark.
export function randomPoints(seed = 42, count = 30) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  return Array.from({ length: count }, () => {
    const x = 160 + random() * 580;
    return { x, y: 280 + (x - 450) * 0.22 + (random() - 0.5) * 100 };
  });
}
