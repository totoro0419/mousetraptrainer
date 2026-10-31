"""Verify and unpack the complete original audio ZIP into dist/audio/lines.

Usage: python3 scripts/import-full-audio.py /path/to/The_Mousetrap_Audio_For_App.zip
"""
import hashlib
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED_SHA256 = 'eeb77658464532962888fdbfcf4bd5d382c125a89210f37d716f5b712a238533'

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: import-full-audio.py SOURCE_ZIP')
    zip_path = pathlib.Path(sys.argv[1])
    if sha256(zip_path.read_bytes()) != EXPECTED_SHA256:
        raise ValueError('Original ZIP SHA-256 mismatch')
    m = json.loads((ROOT / 'dist/data/audio-manifest.json').read_text())
    clips = m['clips']
    if m['total'] != 1164 or len(clips) != 1164 or m['archiveSha256'] != EXPECTED_SHA256:
        raise ValueError('Manifest mismatch')
    ids = set()
    files = set()
    pending = {}
    total_bytes = 0
    with zipfile.ZipFile(zip_path) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP CRC error')
        names = z.namelist()
        source_paths = {'app/src/' + c['file'] for c in clips}
        if len(set(names)) != len(names) or {n for n in names if n.endswith('.mp3')} != source_paths:
            raise ValueError('MP3 list mismatch')
        index = json.loads(z.read('audio_manifest.json'))
        if index.get('totalGenerated') != 1164:
            raise ValueError('Source index mismatch')
        for clip in clips:
            ident, scene, rel = clip['id'], clip['scene'], clip['file']
            if not re.fullmatch(r'[a-z0-9-]+', ident) or not re.fullmatch(r'[a-z0-9-]+', scene):
                raise ValueError('Invalid ID')
            if rel != f'audio/lines/{scene}/{ident}.mp3' or ident in ids or rel in files:
                raise ValueError('Invalid file mapping')
            if index['files'].get(ident) != rel.removeprefix('audio/'):
                raise ValueError('Source map mismatch')
            ids.add(ident)
            files.add(rel)
            data = z.read('app/src/' + rel)
            if len(data) != clip['bytes'] or sha256(data) != clip['sha256']:
                raise ValueError(f'MP3 fingerprint mismatch: {ident}')
            path = ROOT / 'dist' / rel
            if path.exists():
                old = path.read_bytes()
                if old != data:
                    raise ValueError(f'Existing MP3 conflicts: {ident}')
            else:
                pending[path] = data
            total_bytes += len(data)
    if m.get('totalBytes') != total_bytes:
        raise ValueError('Total bytes mismatch')
    for path, content in pending.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    print(json.dumps({'verified': len(clips), 'added': len(pending), 'bytes': total_bytes}))

if __name__ == '__main__':
    main()
