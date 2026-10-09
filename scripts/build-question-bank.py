"""Build the geography bank from the supplied Word file, preserving original media."""
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'doc/2026年10月08日地理作业.docx'
OUT = ROOT / 'public/question-bank'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(SOURCE) as archive:
    rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(archive.read('word/_rels/document.xml.rels'))}
    paragraphs = []
    for p in ET.fromstring(archive.read('word/document.xml')).findall('.//w:p', NS):
        text = ''.join(t.text or '' for t in p.findall('.//w:t', NS)).strip()
        images = []
        for blip in p.findall('.//a:blip', NS):
            rid = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
            target = rels.get(rid, '')
            if target.startswith('media/') and not target.endswith('.wmf'):
                name = Path(target).name
                OUT.mkdir(parents=True, exist_ok=True)
                (OUT / name).write_bytes(archive.read('word/' + target))
                images.append('/question-bank/' + name)
        paragraphs.append((text, images))

split = next(i for i, (t, _) in enumerate(paragraphs) if '参考答案' in t)
questions, context, group_images, current = [], [], [], None
for text, images in paragraphs[1:split]:
    if re.match(r'^[一二三]、', text):
        current = None; context = []; group_images = []; continue
    start = re.match(r'^(\d+)．(.*)', text)
    if start:
        n = int(start[1])
        if n in (12, 21):
            context = []; group_images = []
        current = {'id': f'geo-{n}', 'number': n, 'question': start[2], 'context': '\n'.join(context), 'images': list(group_images), 'options': [], 'type': 'single' if n <= 24 else 'fill' if n == 25 else 'comprehensive'}
        questions.append(current)
        current['images'].extend(images)
    elif current and current['number'] <= 24 and current['options'] and images and not text:
        group_images.extend(images)
    elif current and re.match(r'^[A-D]．', text):
        current['options'].extend(s.strip() for s in re.findall(r'[A-D]．.*?(?=[A-D]．|$)', text))
    elif current and current['number'] <= 24 and current['options'] and text and not text.startswith(('①', '②', '③', '④')):
        # A new shared stimulus starts after the previous question's options.
        context = [text]; group_images = list(images); current = None
    elif current:
        if text: current['question'] += '\n' + text
        current['images'].extend(images)
    else:
        if text: context.append(text)
        group_images.extend(images)

answers = '\n'.join(t for t, _ in paragraphs[split:])
blocks = re.split(r'(?m)^(?=\d+．(?:[A-D](?:\s|$)|\(1\)))', answers)
for block in blocks:
    difficulty = re.search(r'【难度】([\d.]+)', block)
    if not difficulty: continue
    coefficient = float(difficulty[1])
    explanation = block.split('【详解】', 1)[-1].strip()
    knowledge = re.search(r'【知识点】([^\n]+)', block)
    header = block.split('【难度】')[0].strip()
    selections = re.findall(r'(\d+)．([A-D])(?:\s|$)', header)
    numbers = [int(n) for n, _ in selections] or [int(re.match(r'(\d+)．', header)[1])]
    for number in numbers:
        q = next(q for q in questions if q['number'] == number)
        q.update(difficultyCoefficient=coefficient, difficulty='easy' if coefficient >= .75 else 'medium' if coefficient >= .55 else 'hard', explanation=explanation, knowledgePoints=knowledge[1] if knowledge else '')
        letter = dict(selections).get(str(number))
        q['answer'] = next((o for o in q['options'] if o.startswith(letter + '．')), '') if letter else re.sub(r'^\d+．', '', header)
        q['images'] = list(dict.fromkeys(q['images']))
assert len(questions) == 38 and all(q.get('answer') and q.get('difficulty') for q in questions)
(OUT / 'geography.json').write_text(json.dumps({'id': 'geo-20261008', 'name': SOURCE.stem, 'source': SOURCE.name, 'questions': questions}, ensure_ascii=False, indent=2))
print(f'Built {len(questions)} questions; {sum(bool(q["images"]) for q in questions)} with original images')
