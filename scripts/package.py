"""Package the runnable source and recorded deliverables; exclude local state."""
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
destination = root.parent / 'releases'
destination.mkdir(exist_ok=True)
archive = destination / f'{root.name}-{version}.zip'
top_files = ['.gitignore', '.nojekyll', 'README.md', 'package.json', 'index.html', 'styles.css', 'report.html']
files = [root / name for name in top_files]
for directory in ['src', 'tests', 'scripts', 'docs']:
    files.extend(path for path in (root / directory).rglob('*') if path.is_file()
                 and '__pycache__' not in path.parts and path.suffix != '.pyc')
for required in ['docs/report.pdf', 'docs/experiments/metadata.json']:
    if not (root / required).is_file():
        raise FileNotFoundError(f'Build the report/experiments first: {required}')
with ZipFile(archive, 'w', ZIP_DEFLATED) as package:
    for path in sorted(files):
        package.write(path, str(Path(root.name) / path.relative_to(root)))
digest = sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive}\n{len(files)} files; {archive.stat().st_size:,} bytes\nSHA-256: {digest}')
