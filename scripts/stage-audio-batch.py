"""Stage a bounded number of exact, SHA-256 verified original MP3s.

Usage:
  python3 scripts/stage-audio-batch.py --status
  python3 scripts/stage-audio-batch.py The_Mousetrap_Audio_For_App.zip --start 1 --count 10

This tool never downloads audio and never changes the manifest or script.
It is idempotent: valid existing files are left untouched, invalid files abort.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'dist/data/audio-manifest.json'
AUDIO_ROOT = ROOT / 'dist/audio'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def inspect_staged(clips):
    known = {Path('dist') / c['file']: c for c in clips}
    found = set((AUDIO_ROOT / 'lines').rglob('*.mp3')) if (AUDIO_ROOT / 'lines').exists() else set()
    unexpected = sorted(str(p.relative_to(ROOT)) for p in found if p.relative_to(ROOT) not in known)
    if unexpected:
        raise ValueError(f'Unexpected audio files: {unexpected[:3]}')
    verified = set()
    for path in sorted(found):
        entry = known[path.relative_to(ROOT)]
        actual = path.read_bytes()
        if len(actual) != entry['bytes'] or sha256(actual) != entry['sha256']:
            raise ValueError(f'Invalid existing audio: {entry["id"]}')
        verified.add(entry['id'])
    return verified


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path, nargs='?', help='Original supplied audio ZIP')
    parser.add_argument('--start', type=int, default=1, help='1-based first manifest item')
    parser.add_argument('--count', type=int, default=10, help='Maximum items in this batch')
    parser.add_argument('--status', action='store_true', help='Only inspect currently staged files')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    clips = manifest['clips']
    if manifest['total'] != 1164 or len(clips) != 1164:
        raise ValueError('Unexpected manifest coverage')
    if len(set(c['id'] for c in clips)) != len(clips) or len(set(c['file'] for c in clips)) != len(clips):
        raise ValueError('Duplicate IDs or filenames in manifest')
    for c in clips:
        expected = f"audio/lines/{c['scene']}/{c['id']}.mp3"
        if c['file'] != expected or not re.fullmatch(r'[a-z0-9-]+', c['scene']) or not re.fullmatch(r'[a-z0-9-]+', c['id']):
            raise ValueError(f'Unsafe manifest filename: {c["id"]}')
    before = inspect_staged(clips)
    added = []
    if not args.status:
        if not args.archive:
            parser.error('Provide the original ZIP, or use --status')
        if not (1 <= args.start <= len(clips) and 1 <= args.count <= 100):
            parser.error('--start must be 1..1164 and --count must be 1..100')
        if sha256(args.archive.read_bytes()) != manifest['archiveSha256']:
            raise ValueError('ZIP SHA-256 differs from the audited original')
        with zipfile.ZipFile(args.archive) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP CRC failure')
            names = archive.namelist()
            expected = {'app/src/' + c['file'] for c in clips}
            if len(names) != len(set(names)) or {n for n in names if n.endswith('.mp3')} != expected:
                raise ValueError('ZIP MP3 list differs from the audited manifest')
            for c in clips[args.start - 1:args.start - 1 + args.count]:
                if c['id'] in before:
                    continue
                data = archive.read('app/src/' + c['file'])
                if len(data) != c['bytes'] or sha256(data) != c['sha256']:
                    raise ValueError(f'ZIP content disagrees with manifest: {c["id"]}')
                path = ROOT / 'dist' / c['file']
                path.parent.mkdir(parents=True, exist_ok=True)
                fd, temp = tempfile.mkstemp(prefix='.audio-', suffix='.tmp', dir=path.parent)
                try:
                    with os.fdopen(fd, 'wb') as output:
                        output.write(data)
                    if path.exists():
                        raise ValueError(f'Audio appeared concurrently: {c["id"]}')
                    os.replace(temp, path)
                finally:
                    if os.path.exists(temp):
                        os.unlink(temp)
                added.append(c['id'])
    after = inspect_staged(clips)
    pending = [c['id'] for c in clips if c['id'] not in after]
    print(json.dumps({
        'total': len(clips), 'verified_on_disk': len(after), 'added': len(added),
        'remaining': len(pending), 'next_start': next((i + 1 for i, c in enumerate(clips) if c['id'] not in after), None),
        'first_missing_id': pending[0] if pending else None,
        'complete': len(after) == len(clips)
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
