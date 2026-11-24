"""Create the report figures from recorded CSV files. Requires matplotlib."""
import csv
import os
from pathlib import Path
from statistics import median

os.environ.setdefault('MPLCONFIGDIR', '/tmp/capturing-shape-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
data = root / 'docs' / 'experiments'
out = root / 'docs' / 'figures'
out.mkdir(exist_ok=True)
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False,
                     'svg.fonttype': 'none', 'figure.constrained_layout.use': True})
colors = {'grid': '#9d6b24', 'optimized': '#367ba5', 'events': '#176c6b'}
names = {'grid': 'Uniform grid', 'optimized': 'Hull + offset', 'events': 'Events + refinement'}

def read(name):
    with (data / (name + '.csv')).open() as stream:
        return list(csv.DictReader(stream))

def save(fig, name):
    for suffix in ['svg', 'pdf']:
        fig.savefig(out / f'{name}.{suffix}')
    plt.close(fig)

rows = read('scaling')
fig, axes = plt.subplots(1, 2, figsize=(9, 3.2))
for method, color in colors.items():
    selected = [r for r in rows if r['method'] == method and r['instance'].startswith('random')]
    ns = sorted({int(r['n']) for r in selected})
    for ax, key in zip(axes, ['disk_tests', 'median_ms']):
        ax.plot(ns, [median(float(r[key]) for r in selected if int(r['n']) == n) for n in ns], 'o-', color=color, label=names[method])
        ax.set(xscale='log', yscale='log', xlabel='Input points n')
        ax.grid(alpha=.2)
axes[0].set_ylabel('Disk–line tests (median of 3 seeds)')
axes[1].set_ylabel('Runtime, ms (median of 3 seed medians)')
axes[0].legend(fontsize=8)
save(fig, 'scaling')

rows = read('resolution')
fig, axes = plt.subplots(1, 2, figsize=(9, 3.2))
for ax, instance in zip(axes, ['elongated', 'random-30-seed1']):
    for method, color in colors.items():
        selected = [r for r in rows if r['instance'] == instance and r['method'] == method]
        ax.plot([int(r['angles']) for r in selected], [float(r['difference_to_reference']) for r in selected], 'o-', color=color, label=names[method])
    ax.set(xlabel='Uniform angle samples A', ylabel='Length − dense reference', title=instance, xscale='log')
    ax.axhline(0, color='#888', lw=.6); ax.grid(alpha=.2)
axes[0].legend(fontsize=8)
save(fig, 'resolution')

rows = read('width')
fig, axes = plt.subplots(1, 2, figsize=(9, 3.2))
for algorithm, color in [('brute', '#9d6b24'), ('calipers', '#176c6b')]:
    selected = [r for r in rows if r['algorithm'] == algorithm]
    for ax, key in zip(axes, ['tests', 'median_ms']):
        ax.plot([int(r['n']) for r in selected], [float(r[key]) for r in selected], 'o-', color=color, label=algorithm)
        ax.set(xscale='log', yscale='log', xlabel='Hull vertices h'); ax.grid(alpha=.2)
axes[0].set_ylabel('Area / projection evaluations')
axes[1].set_ylabel('Median runtime (ms)')
axes[0].legend()
save(fig, 'width')
print(f'Wrote three SVG/PDF figure pairs to {out}')
