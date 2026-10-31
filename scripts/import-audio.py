"""Validate the supplied archive against its generator source, decode every MP3,
and produce reproducible per-line evidence. No filename-only text assignment.
Usage: python3 scripts/import-audio.py AUDIO_ZIP GENERATOR_SOURCE_JSON
"""
import array
import concurrent.futures
import hashlib
import json
import math
import pathlib
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
digest = lambda b: hashlib.sha256(b).hexdigest()
archive, source = map(pathlib.Path, sys.argv[1:])
bundle = json.loads((ROOT / 'dist/data/mousetrap.json').read_text())
source_data = json.loads(source.read_text(encoding='utf-8-sig'))
assert source_data == bundle['script'], 'Generator text, speaker, order or IDs differ'
lines = [(scene, line) for scene, item in source_data.items() for line in item['speeches']]
assert len(lines) == 1164
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, 'ZIP CRC failure'
    assert len(z.namelist()) == len(set(z.namelist())), 'Duplicate ZIP paths'
    manifest = json.loads(z.read('audio_manifest.json'))
    index = z.read('app/src/pregenerated-audio-index.js').decode('utf-8-sig')
    index = json.loads(index.split(' = ', 1)[1].split(';', 1)[0])
    assert set(manifest['files']) == {line['id'] for _, line in lines}
    assert {k: './audio/' + v for k, v in manifest['files'].items()} == index
    assert len([n for n in z.namelist() if n.endswith('.mp3')]) == len(lines)
    target = ROOT / 'dist/audio'
    for scene, line in lines:
        rel = manifest['files'][line['id']]
        assert rel == f"lines/{scene}/{line['id']}.mp3"
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(z.read('app/src/audio/' + rel))

def inspect(pair):
    scene, line = pair
    rel = manifest['files'][line['id']]
    path = target / rel
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    stream = probe['streams'][0]
    assert stream['codec_name'] == 'mp3'
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True)
    samples = array.array('h', decoded.stdout)
    duration = len(samples) / 16000
    rms = math.sqrt(sum(x * x for x in samples) / max(1, len(samples)))
    assert duration > 0.1 and rms > 10, f"Empty or effectively silent: {line['id']}"
    return dict(id=line['id'], scene=scene, speaker=line['speaker'], ordinal=line['ordinal'],
        textSha256=digest(line['text'].encode()), file='audio/' + rel,
        sha256=digest(path.read_bytes()), bytes=path.stat().st_size,
        duration=round(float(probe['format']['duration']), 4), decodedSeconds=round(duration, 4),
        sampleRate=int(stream['sample_rate']), channels=stream['channels'], rmsDbFS=round(20 * math.log10(rms / 32768), 2))

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    clips = list(pool.map(inspect, lines))
by_hash = {}
for c in clips:
    previous = by_hash.setdefault(c['sha256'], c)
    assert previous['textSha256'] == c['textSha256'], f"Same audio assigned to different text: {c['id']}"
report = dict(version=1, datasetId=bundle['id'], archiveSha256=digest(archive.read_bytes()),
    sourceFingerprint=digest(json.dumps([[l['id'], l['speaker'], l['text']] for _,l in lines], ensure_ascii=False, separators=(',', ':')).encode()),
    generatorSourceSha256=digest(source.read_bytes()), sourceScriptSha256=digest(json.dumps(bundle['script'], ensure_ascii=False, separators=(',', ':')).encode()),
    evidence='Generator source JSON equals bundled script in full; generator checks ID/speaker/text/order; exported JSON and JS maps agree; every MP3 CRC/hash/decoder/RMS checked.',
    limitation='No independent speech-to-text or human listening audit of all 1164 recordings. Provenance confirms intended text/casting, not perfect pronunciation or delivery.',
    generationRate=manifest['rate'], total=len(clips), totalBytes=sum(c['bytes'] for c in clips),
    totalSeconds=round(sum(c['duration'] for c in clips), 3), missing=0, decodeFailures=0, silent=0,
    duplicateAudioCount=len(clips)-len(by_hash), clips=clips)
(ROOT / 'dist/data/audio-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k:v for k,v in report.items() if k != 'clips'}, ensure_ascii=False))
