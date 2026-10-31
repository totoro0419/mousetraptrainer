"""Read-only PDF/bundle comparison. Requires Poppler pdftotext for --pdf input."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = r'VOICE ON THE RADIO|MRS\. BOYLE|MAJOR METCALF|MISS CASEWELL|CHRISTOPHER|PARAVICINI|TROTTER|MOLLIE|GILES'
LABEL = rf'^({NAMES})(?:\s*\[[^\]]{{0,200}}\]\s*:?|\s*:)'
EXPECTED_PDF_SHA256 = '94d46d2afe7504d2010c10b3ef4f1017bc3adfe0c09ab86bfd837167357c397b'
# Unbracketed scene descriptions included between speech labels by this extraction method.
SCENE_TEXT = {
    'act1-scene1-speech-0001': 'The LIGHTS come up, revealing the Hall at Monkswell Manor. It is late afternoon, and almost dark. Snow can be seen falling heavily through the windows up Centre. There is a fire burning. A freshly painted signboard is standing on its side on the stairs against the archway Left; it has on it in large letters: MONKWELL MANOR GUEST HOUSE.',
    'act1-scene1-speech-0190': 'CURTAIN Scene II SCENE: The same. The following afternoon. When Curtain rises it is not snowing, but snow can be seen banked high against the window. MAJOR METCALF is seated on the sofa reading a book, and MRS. BOYLE is sitting in the large armchair Right in front of the fire, writing on a pad on her knee.',
    'act1-scene2-speech-0336': 'CURTAIN ACT TWO SCENE: The same. Ten minutes later. When the Curtain rises, MRS. BOYLE\'s body has been removed and EVERYONE is assembled in the room. TROTTER is in charge and is sitting on the up stage side of the refectory table. MOLLIE is standing at the Right end of the refectory table. The others are all sitting, MAJOR METCALF in the large armchair Right, CHRISTOPHER in the dark chair, GILES on the stairs Left, MISS CASEWELL at the Right end of the sofa, and PARAVICINI at the Left end.',
    'act2-speech-0638': 'QUICK CURTAIN',
}

def normalize(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())

def compare(text, bundle):
    text = text.replace('\f', '\n')
    labels = list(re.finditer(LABEL, text, re.M))
    lines = [line for scene in bundle['script'].values() for line in scene['speeches']]
    report = {'comparison': 'Speaker order plus lowercase ASCII letters/digits; punctuation and whitespace are not compared.',
              'pdfSpeechLabels': len(labels), 'sourceSpeeches': len(lines), 'speakerOrderMatches': False,
              'exactBlocksBeforeSceneRemoval': 0, 'sceneDescriptionsSeparated': [],
              'normalizedSpeechMatches': 0, 'errors': []}
    if len(labels) != len(lines):
        report['errors'].append('Speech label count differs')
        return report
    report['speakerOrderMatches'] = all(label.group(1) == line['speaker'] for label, line in zip(labels, lines))
    if not report['speakerOrderMatches']:
        report['errors'].append('Speaker sequence differs')
    for index, (label, line) in enumerate(zip(labels, lines)):
        body = text[label.end():labels[index + 1].start() if index + 1 < len(labels) else len(text)]
        body = re.sub(r'\[[^\]]*\]', ' ', body, flags=re.S)
        body = re.sub(r'\[[^\n]*', ' ', body)  # The supplied PDF has an unclosed inline bracket at A60.
        body = re.sub(r'-\s*\d+\s*-', '', body)
        actual, expected = normalize(body), normalize(line['text'])
        if actual == expected:
            report['exactBlocksBeforeSceneRemoval'] += 1
        elif line['id'] in SCENE_TEXT:
            scene_text = normalize(SCENE_TEXT[line['id']])
            if actual.count(scene_text) == 1:
                actual = actual.replace(scene_text, '', 1)
                report['sceneDescriptionsSeparated'].append(line['id'])
        if actual == expected:
            report['normalizedSpeechMatches'] += 1
        else:
            report['errors'].append(line['id'] + ': normalized text differs')
    return report

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=pathlib.Path, required=True)
    parser.add_argument('--bundle', type=pathlib.Path, default=ROOT / 'dist/data/mousetrap.json')
    parser.add_argument('--report', type=pathlib.Path)
    args = parser.parse_args()
    text = subprocess.check_output(['pdftotext', '-layout', str(args.pdf), '-'], text=True)
    bundle = json.loads(args.bundle.read_text(encoding='utf-8'))
    report = compare(text, bundle)
    report['pdfSha256'] = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    report['sourceSha256'] = hashlib.sha256(args.bundle.read_bytes()).hexdigest()
    if report['pdfSha256'] != EXPECTED_PDF_SHA256:
        report['errors'].append('PDF edition/hash differs from the audited attachment')
    payload = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    print(payload, end='')
    if args.report:
        args.report.write_text(payload, encoding='utf-8')
    raise SystemExit(1 if report['errors'] else 0)

if __name__ == '__main__':
    main()
