"""Audit downloaded immutable bank shards; jsonschema 4.25.1 is the sole extra dependency."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha1, sha256
import json
from pathlib import Path
import re
import unicodedata

from jsonschema import Draft202012Validator


def read(path):
    return json.loads(path.read_bytes())


def normalize(value):
    return ' '.join(unicodedata.normalize('NFC', value).casefold().split())


def audit(source, selected_path, units_path, lots, source_tree):
    manifest = read(source / 'manifest.json')
    prefix = 'packages/engine/lessonos/study/content/physics-semestre-2026-bank/'
    snapshot_tree = read(source_tree)
    if snapshot_tree['truncated'] or snapshot_tree['sha'] != '5cfbdcb055ba3ba136f97fb56e997f06e6cf3605':
        raise ValueError('Expected complete tree for the reviewed snapshot')
    blobs = {item['path'][len(prefix):]: item['sha'] for item in snapshot_tree['tree']
             if item['path'].startswith(prefix) and item['type'] == 'blob'}
    for path in sorted(blobs):
        raw = (source / path).read_bytes()
        if sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest() != blobs[path]:
            raise ValueError(f'Source bytes differ from Git tree: {path}')
    schema = read(source / manifest['questionSchema'])
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    ids = Counter()
    levels = Counter()
    by_unit = defaultdict(Counter)
    formats = Counter()
    integrity = []
    schema_errors = []
    key_errors = []
    link_errors = []
    visual_fields = []
    shared_checks = Counter()
    generic_hints = Counter()
    canonical_prompts = defaultdict(list)
    signatures = defaultdict(list)
    numeric_templates = defaultdict(list)
    formula_styles = Counter()
    unit_flags = []
    all_records = {}
    census = []
    for shard in manifest['shards']:
        path = source / shard['path']
        raw = path.read_bytes()
        checksum = sha256(raw).hexdigest()
        if checksum != shard['sha256']:
            raise ValueError(f'Shard hash mismatch: {path}')
        records = json.loads(raw)
        if len(records) != shard['count']:
            raise ValueError(f'Shard record count mismatch: {path}')
        git_blob = blobs[shard['path']]
        integrity.append(dict(path=shard['path'], count=len(records), sha256=checksum, blob=git_blob))
        census.extend(records)
        for row in records:
            qid = row['id']
            ids[qid] += 1
            unit = row['taxonomy']['unitId']
            level = row['difficulty']['level']
            levels[level] += 1
            by_unit[unit][level] += 1
            formats[row['format']] += 1
            all_records[qid] = (row, shard['path'], git_blob)
            for error in validator.iter_errors(row):
                schema_errors.append([qid, '/'.join(map(str, error.path)), error.message])
            if unit != path.stem.split('-')[0] or row['bankId'] != manifest['id']:
                link_errors.append(qid)
            answer = row['answer']
            options = row['options']
            correct = [o for o in options if o['id'] == answer.get('correctOptionId')]
            if row['format'] == 'multiple_choice' and (len(correct) != 1 or normalize(correct[0]['text']) != normalize(answer['text'])):
                key_errors.append([qid, answer.get('correctOptionId'), answer['text'], correct[0]['text'] if len(correct)==1 else None])
            if any(key in row for key in ('figure','figures','image','images','diagram','graph','svg')):
                visual_fields.append(qid)
            if 'I simboli rappresentano queste grandezze e non vanno scambiati con i loro valori numerici.' in row['solution']:
                shared_checks['symbols'] += 1
            if 'Non basta che il numero sembri plausibile.' in row['solution']:
                shared_checks['result'] += 1
            if all(s in row['solution'] for s in ('I simboli rappresentano queste grandezze e non vanno scambiati con i loro valori numerici.', 'Non basta che il numero sembri plausibile.')):
                shared_checks['both'] += 1
            if row['hints']:
                generic_hints[row['hints'][0]] += 1
            canonical_prompts[normalize(row['prompt'])].append(qid)
            signatures[row['semanticSignature']].append(qid)
            if row['format'] == 'completion':
                masked = re.sub(r'(?<![\w])[-−+]?\d+(?:[.,]\d+)?(?:/\d+)?', '#', normalize(row['prompt']))
                numeric_templates[(row['familyId'], masked)].append(qid)
            for step in row['solutionSteps']:
                math = step.get('math', '')
                if math:
                    formula_styles['withDollars' if '$' in math else 'plainLegacyNotation'] += 1
                    if math.count('$') % 2:
                        formula_styles['oddMathDelimiters'] += 1
            if re.search(r'\bin 1[?\.]|l[’\x27]unità richiesta è 1\.', row['prompt']):
                unit_flags.append(qid)
    if sum(ids.values()) != manifest['questionCount']:
        raise ValueError('Manifest total mismatch')
    selected = read(selected_path)
    units = read(units_path)
    assigned = {qid for row in units for qid in row['exerciseIds']}
    references = {qid: row for row in units for qid in row['exerciseIds']}
    selected_ids = {q['id'] for q in selected}
    if not selected_ids <= ids.keys() or not assigned <= selected_ids:
        raise ValueError('Broken selected bank references')
    origins = []
    for lot in sorted(lots.glob('*.json')):
        for revision in read(lot):
            qid = revision['id']
            original, path, blob = all_records[qid]
            taxonomy_unit = original['taxonomy']['unitId']
            lesson = references.get(qid) or next(row for row in units if row['familyId'] == Path(path).stem)
            origins.append(dict(id=qid, lessonId=lesson['unitId'], taxonomyUnit=taxonomy_unit,
                                level=original['difficulty']['level'], format=original['format'],
                                answer=original['answer'], path=path, blob=blob,
                                sha256=sha256(json.dumps(original, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()).hexdigest(),
                                previouslyAssigned=qid in assigned))
    duplicates = {key: count for key, count in ids.items() if count != 1}
    repeated = lambda values: [rows for rows in values.values() if len(rows)>1]
    report = dict(snapshot='5cfbdcb055ba3ba136f97fb56e997f06e6cf3605', count=len(census),
                  distinctIds=len(ids), levels=levels, byTaxonomyUnit=by_unit, formats=formats,
                  files=integrity, duplicateIds=duplicates, schemaErrors=schema_errors,
                  answerLabelMismatches=key_errors, taxonomyLinkErrors=link_errors, visualFieldRecords=visual_fields,
                  standardSolutionPhrases=shared_checks, frequentFirstHints=generic_hints.most_common(12),
                  exactPromptGroups=repeated(canonical_prompts), repeatedSemanticSignatures=repeated(signatures),
                  numericTemplateGroups=repeated(numeric_templates), legacySolutionStepNotation=formula_styles,
                  dimensionlessPlaceholderRecords=unit_flags, selectedNext=len(selected_ids),
                  nextPracticePlacements=sum(len(row['exerciseIds']) for row in units),
                  explicitlyAssignedNext=len(assigned), reviewedOrigins=len(origins),
                  scope='Flags require editorial review. Global check does not infer physical correctness or test the legacy UI.')
    return report, origins


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--tree', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--origins', type=Path, required=True)
    parameters = parser.parse_args()
    editorial = Path('docs/sources/physics-2026-27/editorial')
    report, origins = audit(parameters.source, editorial/'bank-selection.json', editorial/'units.json',
                            parameters.origins.parent/'lots', parameters.tree)
    for path, value in [(parameters.output, report), (parameters.origins, origins)]:
        path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
    print({key: report[key] for key in ('count','levels','formats','selectedNext','explicitlyAssignedNext','reviewedOrigins')})
