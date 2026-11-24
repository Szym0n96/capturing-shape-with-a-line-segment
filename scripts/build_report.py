"""Build HTML and PDF from one Markdown source and recorded measurements.

Optional tools: markdown-it-py, matplotlib, pdfLaTeX. No network access.
"""
import csv
import html
import json
import os
from pathlib import Path
import re
import statistics
import subprocess

os.environ.setdefault('MPLCONFIGDIR', '/tmp/capturing-shape-matplotlib')
from markdown_it import MarkdownIt
from matplotlib.mathtext import math_to_image

root = Path(__file__).resolve().parents[1]
data = root / 'docs' / 'experiments'
build = root / '.build'
build.mkdir(exist_ok=True)

def rows(name):
    with (data / (name + '.csv')).open() as stream:
        return list(csv.DictReader(stream))

def number(value, places=6):
    return f'{float(value):.{places}f}'.rstrip('0').rstrip('.') if value != '' else '—'

quality = rows('quality')
metadata = json.loads((data / 'metadata.json').read_text())
values = {'environment': f"Recorded on {metadata['generated'][:10]} with Node.js {metadata['node']}, {metadata['os']}, on a {metadata['cpu']} ({metadata['logical_cpus']} logical CPUs)."}
table = ['| Instance | Grid length | Hull length | Events length | Dense reference |', '| --- | --- | --- | --- | --- |']
for name in ['elongated', 'collinear', 'narrow', 'triangle', 'pointBoundary', 'random-100-seed1', 'random-100-seed5']:
    group = [r for r in quality if r['instance'] == name]
    lengths = [number(r['length']) if r['length'] else r['status'] for r in group]
    table.append('| ' + ' | '.join([name, *lengths, number(group[0]['reference_length'])]) + ' |')
values['quality_table'] = '\n'.join(table)
maxima = [max(float(r['difference_to_reference']) for r in quality if r['method'] == m and r['difference_to_reference']) for m in ['grid', 'optimized', 'events']]
values['quality_findings'] = ('Across the 21 quality instances, the largest positive length differences to the dense reference are '
    f'{number(maxima[0])} units for the grid, {number(maxima[1])} for hull + offset, and {number(maxima[2])} for events + refinement. '
    'These are observed differences on this dataset, not upper bounds on true optimality gaps. '
    'The event method still leaves a visible gap on random-100-seed5, illustrating the limits of six local refinement rounds. '
    'Small negative differences also occur, including on the narrow case; they reflect the numerical nature of the reference.')
ablation = [r for r in rows('hull-ablation') if r['n'] == '1000']
count = lambda flag, key: statistics.median(float(r[key]) for r in ablation if r['use_hull'] == flag)
values['ablation_findings'] = (f"At n = 1,000 on elongated random sets, the hull has 17–19 vertices. Median disk–line counts fall from {count('false', 'disk_tests'):,.0f} to {count('true', 'disk_tests'):,.0f} when the same optimized-offset solver switches from all points to hull vertices. "
    f"The corresponding median runtimes across three seeds are {count('false', 'median_ms'):.3f} ms and {count('true', 'median_ms'):.3f} ms. Hull construction and common preprocessing are included in both.")
width = {r['algorithm']: r for r in rows('width') if r['n'] == '1000'}
values['width_findings'] = (f"On the regular 1,000-gon, the calipers scan performs {int(width['calipers']['tests']):,} area evaluations and {int(width['calipers']['advances']):,} pointer advances, versus 1,000,000 projection evaluations for the quadratic reference. "
    f"The measured times are {float(width['calipers']['median_ms']):.3f} ms and {float(width['brute']['median_ms']):.3f} ms respectively. Both return width {float(width['calipers']['width']):.9f} to roundoff. "
    'The counted primitives differ, so their ratio is not a direct machine-instruction ratio; their growth still exposes the linear versus quadratic scans.')
excess = max(float(r['excess']) for r in quality if r['excess'])
tolerance_error = max(abs(float(r['difference_to_reference'])) for r in rows('offset-tolerance') if float(r['tolerance']) == .0001)
dense = rows('dense-grid')
values['precision_findings'] = (f"The largest recorded constraint excess in the quality suite is {excess:.3g} units, well below the 10⁻⁷ allowance. "
    f"At τ = 10⁻⁴, the three fixed-direction tolerance cases differ from a τ = 10⁻¹⁰ reference by at most {tolerance_error:.3g} length units. This empirical agreement is not a general length-error guarantee. "
    f"The dense 1,440 × 401 grid is longer than the default event result by {number(dense[0]['grid_minus_events'], 9)} units on elongated, {number(dense[1]['grid_minus_events'], 9)} on random-30-seed1, and {number(dense[2]['grid_minus_events'], 9)} on triangle.")

source = (root / 'docs' / 'report.md').read_text()
for key, value in values.items():
    source = source.replace('{{' + key + '}}', value)
if re.search(r'\{\{\w+\}\}', source):
    raise ValueError('Unresolved report field')
md = MarkdownIt('commonmark', {'html': False}).enable('table')
tokens = md.parse(source)
for index, token in enumerate(tokens):
    if token.type == 'heading_open' and tokens[index + 1].content == '9. Contributions and AI use':
        token.attrSet('id', 'contributions-and-ai-use')
    for child in token.children or []:
        if child.type == 'image' and child.attrGet('src').startswith('figures/'):
            child.attrSet('src', 'docs/' + child.attrGet('src'))

# Keep formulas local and legible without a MathJax/CDN dependency.
equation_count = 0
default_fence = md.renderer.rules['fence']
def fence(tokens, idx, options, env):
    global equation_count
    token = tokens[idx]
    if token.info.strip() != 'math':
        return default_fence(tokens, idx, options, env)
    equation_count += 1
    relative = f'docs/figures/equation-{equation_count:02}.svg'
    math_to_image('$' + token.content.strip() + '$', root / relative, dpi=160, format='svg', color='#263641')
    return f'<div class="equation"><img src="{relative}" alt="{html.escape(token.content.strip(), quote=True)}"></div>\n'
md.renderer.rules['fence'] = fence
body = md.renderer.render(tokens, md.options, {})
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Geometry, algorithms, validation and reproducible experiments for line-segment shape capture.">
<title>Technical report · Capturing a Shape with a Line Segment</title><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="docs/report.css"></head>
<body class="report"><nav aria-label="Report navigation"><a href="index.html">← Interactive demo</a><a href="docs/report.pdf">Download PDF</a><a href="docs/experiments/metadata.json">Experiment metadata</a><a href="docs/report.md">Report source</a><a href="https://github.com/Szym0n96/capturing-shape-with-a-line-segment">Source code — GitHub</a><a href="#contributions-and-ai-use">Contributions & AI use</a></nav>
<main>{body}</main><footer>Szymon Januszewski · Capturing a Shape with a Line Segment</footer></body></html>'''
(root / 'report.html').write_text(page)

# A small token renderer keeps the report source shared by both formats.
unicode_map = {'θ': r'\ensuremath{\theta}', 'τ': r'\ensuremath{\tau}', 'ε': r'\ensuremath{\varepsilon}',
    'ρ': r'\ensuremath{\rho}', 'π': r'\ensuremath{\pi}', 'ℓ': r'\ensuremath{\ell}',
    'ᵢ': r'\ensuremath{{}_i}', '≤': r'\ensuremath{\leq}', '≥': r'\ensuremath{\geq}',
    '×': r'\ensuremath{\times}', '−': r'\ensuremath{-}', '√': r'\ensuremath{\surd}',
    '²': r'\textsuperscript{2}', '³': r'\textsuperscript{3}', '⁻': r'\textsuperscript{-}',
    '¹': r'\textsuperscript{1}', '⁰': r'\textsuperscript{0}', '⁴': r'\textsuperscript{4}',
    '⁷': r'\textsuperscript{7}', '·': r'\ensuremath{\cdot}', '°': r'\ensuremath{^\circ}',
    '–': '--', '—': '---', '’': "'", '“': '``', '”': "''"}
latex_map = {'&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
             '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}', '\\': r'\textbackslash{}'}
def escape(text):
    return ''.join(unicode_map.get(c, latex_map.get(c, c)) for c in text)

def inline(children):
    parts = []
    for token in children or []:
        kind = token.type
        if kind == 'text': parts.append(escape(token.content))
        elif kind == 'code_inline': parts.append(r'\texttt{' + escape(token.content) + '}')
        elif kind == 'strong_open': parts.append(r'\textbf{')
        elif kind == 'em_open': parts.append(r'\emph{')
        elif kind in ['strong_close', 'em_close', 'link_close']: parts.append('}')
        elif kind == 'link_open': parts.append(r'\href{' + token.attrGet('href').replace('%', r'\%') + '}{')
        elif kind in ['softbreak', 'hardbreak']: parts.append(' ')
        elif kind == 'image':
            path = token.attrGet('src').replace('.svg', '.pdf')
            parts.append('\n\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=\\linewidth]{' + path + '}\n\\caption{' + escape(token.content) + '}\n\\end{figure}\n')
    return ''.join(parts)

parts = []
i = 0
while i < len(tokens):
    token = tokens[i]
    kind = token.type
    if kind == 'heading_open':
        level = int(token.tag[1:]); title = inline(tokens[i + 1].children)
        if level == 1:
            parts.append('\\begin{center}\\LARGE\\bfseries ' + title + '\\end{center}\n')
        else:
            command = 'section' if level == 2 else 'subsection'
            parts.append('\\' + command + '*{' + title + '}\n')
        i += 3; continue
    if kind == 'table_open':
        table_rows, current = [], []
        i += 1
        while tokens[i].type != 'table_close':
            if tokens[i].type == 'tr_open': current = []
            elif tokens[i].type == 'inline': current.append(inline(tokens[i].children))
            elif tokens[i].type == 'tr_close': table_rows.append(current)
            i += 1
        cols = len(table_rows[0])
        parts.append('\n{\\footnotesize\\renewcommand{\\arraystretch}{1.3}\n\\begin{tabularx}{\\linewidth}{' + '*{' + str(cols) + r'}{>{\raggedright\arraybackslash}X}' + '}\n\\toprule\n')
        for j, row in enumerate(table_rows):
            parts.append(' & '.join(row) + ' \\\\\n')
            if j == 0: parts.append('\\midrule\n')
        parts.append('\\bottomrule\n\\end{tabularx}}\n\n')
    elif kind == 'inline': parts.append(inline(token.children))
    elif kind in ['paragraph_close', 'list_item_close']: parts.append('\n\n')
    elif kind == 'fence':
        if token.info.strip() == 'math': parts.append('\\[\n' + token.content + '\\]\n')
        else: parts.append('\n{\\small\\begin{verbatim}\n' + token.content + '\\end{verbatim}}\n')
    elif kind == 'bullet_list_open': parts.append('\\begin{itemize}\n')
    elif kind == 'bullet_list_close': parts.append('\\end{itemize}\n')
    elif kind == 'ordered_list_open': parts.append('\\begin{enumerate}\n')
    elif kind == 'ordered_list_close': parts.append('\\end{enumerate}\n')
    elif kind == 'list_item_open': parts.append('\\item ')
    i += 1

preamble = r'''\documentclass[10pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern,amsmath,amssymb,graphicx,booktabs,tabularx,microtype}
\usepackage[margin=23mm]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\titleformat{\section}{\large\bfseries}{}{0pt}{}
\titleformat{\subsection}{\normalsize\bfseries}{}{0pt}{}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}
\setlength{\emergencystretch}{3em}
\hypersetup{pdftitle={Capturing a Shape with a Line Segment},pdfauthor={Szymon Januszewski}}
\begin{document}
'''
tex = build / 'report.tex'
tex.write_text(preamble + ''.join(parts) + '\n\\end{document}\n')
for _ in range(2):
    run = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', '-output-directory', str(build), str(tex)], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if run.returncode:
        raise RuntimeError(run.stdout[-5000:])
(root / 'docs' / 'report.pdf').write_bytes((build / 'report.pdf').read_bytes())
print('Built report.html and docs/report.pdf from docs/report.md and recorded CSV data.')
