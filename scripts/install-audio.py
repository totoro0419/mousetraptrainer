"""Prepare verified GitHub-hosted audio for GitHub Pages, without committing unpacked MP3s."""
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
import json
import re
import sys

PACK_DIR = Path("audio-packs")
PACKS = [PACK_DIR / "mousetrap-audio-act1.zip", PACK_DIR / "mousetrap-audio-act2.zip"]
present = [p.is_file() for p in PACKS]
if not any(present):
    print("No GitHub audio packs: publishing script-only app.")
    sys.exit(0)
if not all(present):
    raise SystemExit("Both ZIP files are required in audio-packs/. Refusing partial audio deployment.")

pattern = re.compile(r"app/src/audio/lines/(act1-scene1|act1-scene2|act2)/((?:act1-scene1|act1-scene2|act2)-speech-\d{4})\.mp3")
counts = {"act1-scene1": 190, "act1-scene2": 336, "act2": 638}
destination = Path("dist/audio")
mapping = {}
total_size = 0
for pack in PACKS:
    with ZipFile(pack) as archive:
        broken = archive.testzip()
        if broken:
            raise SystemExit(f"Corrupt ZIP entry: {pack.name}: {broken}")
        for info in archive.infolist():
            matched = pattern.fullmatch(info.filename)
            if not matched:
                raise SystemExit(f"Unexpected archive entry: {pack.name}: {info.filename}")
            scene, line_id = matched.groups()
            if not line_id.startswith(f"{scene}-speech-"):
                raise SystemExit(f"Scene / speech mismatch: {line_id}")
            if line_id in mapping:
                raise SystemExit(f"Duplicate audio ID: {line_id}")
            if not 100 <= info.file_size <= 2_000_000:
                raise SystemExit(f"Unexpected MP3 size: {line_id}")
            total_size += info.file_size
            if total_size > 100_000_000:
                raise SystemExit("Unpacked audio exceeds safety limit.")
            payload = archive.read(info)
            if not (payload.startswith(b"ID3") or payload[:1] == b"\xff"):
                raise SystemExit(f"Unexpected MP3 header: {line_id}")
            output = destination / "lines" / scene / f"{line_id}.mp3"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(payload)
            mapping[line_id] = f"lines/{scene}/{line_id}.mp3"

actual = Counter(line_id.rsplit("-speech-", 1)[0] for line_id in mapping)
if actual != counts:
    raise SystemExit(f"Audio scene counts inconsistent: {dict(actual)}")
for scene, count in counts.items():
    expected = {f"{scene}-speech-{i:04d}" for i in range(1, count + 1)}
    if {id for id in mapping if id.startswith(f"{scene}-speech-")} != expected:
        raise SystemExit(f"Missing or unexpected audio IDs in {scene}")

(destination / "index.json").write_text(
    json.dumps({"version": 1, "clips": mapping}, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print(f"Prepared {len(mapping)} checked MP3 files ({total_size} bytes) for GitHub Pages.")
