import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from contextlib import closing
from unittest.mock import patch
from server import app as module
from server.simulation import CLASSROOM_ID, SECTION_ID, remove_test_sections


class SimulationLifecycleTest(unittest.TestCase):
    def test_import_clear_preserves_real_courses_files_and_previous_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            uploads = root / 'uploads'; uploads.mkdir()
            materials = root / 'materials'; materials.mkdir()
            with patch.object(module, 'DB_PATH', root / 'classroom.db'), patch.object(module, 'DATA_DIR', root), patch.object(module, 'UPLOAD_DIR', uploads), patch.object(module, 'CLASSROOM_MATERIAL_DIR', materials), patch.object(module, 'classroom_state', None), patch.object(module, 'classroom_sockets', set()):
                module.init_db()
                self.assertFalse(module.simulation_status()['imported'])
                real_state = {'sectionId': 'section-0-0-0', 'phase': 'after', 'learningAnswers': {'review': {'one': {'q': {'text': '真实回答'}}}}}
                with closing(module.connect()) as db, db:
                    original = json.loads(db.execute('SELECT library FROM teachers LIMIT 1').fetchone()[0])
                    original['books'][0]['chapters'][0]['sections'][0]['teachingState'] = real_state
                    db.execute('UPDATE teachers SET library=?', (json.dumps(original),))
                imported = asyncio.run(module.import_simulation(module.SimulationImportRequest(previousState=real_state)))
                self.assertTrue(imported['imported'])
                self.assertTrue((root / 'demo-classroom-30.json').exists())
                with closing(module.connect()) as db, db:
                    library = json.loads(db.execute('SELECT library FROM teachers LIMIT 1').fetchone()[0])
                    self.assertEqual(library['selectedSectionId'], SECTION_ID)
                    self.assertEqual(library['books'][:2], original['books'])
                    demo = library['books'][-1]['chapters'][0]['sections'][0]
                    demo['teachingState']['classroomReport'] = {'title': '模拟AI生成报告'}
                    db.execute('UPDATE teachers SET library=?', (json.dumps(library),))
                    for classroom, name in [(CLASSROOM_ID, 'simulation.txt'), ('real-classroom', 'real.txt')]:
                        file = uploads / name; file.write_text(name)
                        db.execute('INSERT INTO resources VALUES (?, ?, ?, ?, ?, ?)', (name, classroom, name, str(file), 'text', 1))
                        db.execute('INSERT INTO events VALUES (?, ?, ?, ?, ?)', (name, classroom, 'agent.responded', '{}', 1))
                # Repeated imports do not discard a generated report.
                repeated = asyncio.run(module.import_simulation(module.SimulationImportRequest()))
                self.assertEqual(repeated['state']['classroomReport']['title'], '模拟AI生成报告')
                cleared = asyncio.run(module.clear_simulation())
                self.assertFalse(cleared['imported'])
                self.assertEqual(cleared['state'], real_state)
                self.assertFalse((root / 'demo-classroom-30.json').exists())
                self.assertFalse((uploads / 'simulation.txt').exists())
                self.assertTrue((uploads / 'real.txt').exists())
                with closing(module.connect()) as db:
                    library = json.loads(db.execute('SELECT library FROM teachers LIMIT 1').fetchone()[0])
                    self.assertEqual(library, original)
                    self.assertEqual(db.execute('SELECT count(*) FROM events').fetchone()[0], 1)
                self.assertFalse(module.simulation_status()['imported'])
                self.assertFalse(asyncio.run(module.clear_simulation())['imported'])

    def test_stale_library_cleanup_keeps_real_edits(self):
        library = {'selectedSectionId': SECTION_ID, 'simulationPreviousSectionId': 'real', 'books': [{'id': 'book', 'chapters': [{'sections': [{'id': 'real', 'materials': [], 'teachingState': {'classroomReport': '真实报告'}}, {'id': SECTION_ID, 'materials': [{'id': 'test-material'}], 'teachingState': {'simulation': {'id': 'test'}}}]}]}]}
        clean, removed = remove_test_sections(library)
        self.assertEqual(removed, ['test-material'])
        self.assertEqual(clean['selectedSectionId'], 'real')
        self.assertEqual(clean['books'][0]['chapters'][0]['sections'][0]['teachingState']['classroomReport'], '真实报告')

if __name__ == '__main__':
    unittest.main()
