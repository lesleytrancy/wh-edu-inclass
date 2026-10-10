"""Console-controlled synthetic dataset lifecycle, scoped away from real courses."""
import json
from .demo_dataset import generate_dataset, install_demo

SECTION_ID = 'demo-geography-30'
CLASSROOM_ID = 'simulation-classroom'


def remove_test_sections(library):
    removed_materials = []
    books = []
    for book in library['books']:
        chapters = []
        for chapter in book['chapters']:
            sections = []
            for section in chapter['sections']:
                if section['id'] == SECTION_ID and section.get('teachingState', {}).get('simulation'):
                    removed_materials.extend(x['id'] for x in section.get('materials', []))
                else:
                    sections.append(section)
            if sections: chapters.append({**chapter, 'sections': sections})
        if chapters: books.append({**book, 'chapters': chapters})
    result = {**library, 'books': books}
    ids = [s['id'] for b in books for c in b['chapters'] for s in c['sections']]
    previous = result.pop('simulationPreviousSectionId', None)
    if result.get('selectedSectionId') not in ids:
        result['selectedSectionId'] = previous if previous in ids else ids[0] if ids else None
    return result, removed_materials


def init_control(db):
    db.execute('CREATE TABLE IF NOT EXISTS simulation_control (id INTEGER PRIMARY KEY, imported INTEGER NOT NULL, previous_state TEXT)')
    existing = any(any(s['id'] == SECTION_ID and s.get('teachingState', {}).get('simulation') for b in json.loads(row['library'])['books'] for c in b['chapters'] for s in c['sections']) for row in db.execute('SELECT library FROM teachers'))
    db.execute('INSERT OR IGNORE INTO simulation_control VALUES (1, ?, NULL)', (int(existing),))


def imported(db):
    return bool(db.execute('SELECT imported FROM simulation_control WHERE id=1').fetchone()[0])


def import_dataset(db, previous_state, seed):
    if imported(db):
        for row in db.execute('SELECT library FROM teachers'):
            for b in json.loads(row['library'])['books']:
                for c in b['chapters']:
                    for section in c['sections']:
                        if section['id'] == SECTION_ID and section.get('teachingState', {}).get('simulation'):
                            return section['teachingState']
    state = {**generate_dataset(seed), 'sectionId': SECTION_ID, 'classroomId': CLASSROOM_ID}
    if not imported(db):
        db.execute('UPDATE simulation_control SET imported=1, previous_state=? WHERE id=1', (json.dumps(previous_state, ensure_ascii=False) if previous_state else None,))
    # Import selects the dedicated section, and remembers each teacher's selection.
    selections = {row['username']: json.loads(row['library']).get('selectedSectionId') for row in db.execute('SELECT username, library FROM teachers')}
    install_demo(db, state)
    for row in db.execute('SELECT username, library FROM teachers').fetchall():
        library = json.loads(row['library'])
        if selections[row['username']] != SECTION_ID:
            library['simulationPreviousSectionId'] = selections[row['username']]
        library['selectedSectionId'] = SECTION_ID
        db.execute('UPDATE teachers SET library=? WHERE username=?', (json.dumps(library, ensure_ascii=False), row['username']))
    return state


def clear_dataset(db):
    previous = db.execute('SELECT previous_state FROM simulation_control WHERE id=1').fetchone()[0]
    materials = []
    for row in db.execute('SELECT username, library FROM teachers').fetchall():
        library, removed = remove_test_sections(json.loads(row['library']))
        materials.extend(removed)
        db.execute('UPDATE teachers SET library=? WHERE username=?', (json.dumps(library, ensure_ascii=False), row['username']))
    paths = [row['path'] for row in db.execute('SELECT path FROM resources WHERE classroom_id=?', (CLASSROOM_ID,))]
    for table in ('resources', 'resource_fts', 'jobs', 'events'):
        db.execute(f'DELETE FROM {table} WHERE classroom_id=?', (CLASSROOM_ID,))
    db.execute('UPDATE simulation_control SET imported=0, previous_state=NULL WHERE id=1')
    return json.loads(previous) if previous else None, materials, paths
