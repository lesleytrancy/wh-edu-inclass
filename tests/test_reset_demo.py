import tempfile
from contextlib import closing
import unittest
from pathlib import Path
from unittest.mock import patch
from server import app as module


class ResetDemoTest(unittest.TestCase):
    def test_clears_only_demo_classroom(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            uploads = root / 'uploads'
            uploads.mkdir()
            materials = root / 'classroom-materials'
            materials.mkdir()
            demo_file = uploads / 'demo.pdf'
            other_file = uploads / 'other.pdf'
            demo_file.write_text('demo')
            other_file.write_text('other')
            with patch.object(module, 'DB_PATH', root / 'classroom.db'), patch.object(module, 'UPLOAD_DIR', uploads), patch.object(module, 'CLASSROOM_MATERIAL_DIR', materials):
                module.init_db()
                with closing(module.connect()) as db, db:
                    for classroom, file in [('demo-classroom', demo_file), ('other-classroom', other_file)]:
                        db.execute('INSERT INTO resources VALUES (?, ?, ?, ?, ?, ?)', (classroom, classroom, file.name, str(file), 'text', 1))
                        db.execute('INSERT INTO resource_fts VALUES (?, ?, ?, ?)', (classroom, classroom, file.name, 'text'))
                        db.execute('INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?)', (classroom, classroom, 'learning_pack', 'completed', '{}', None, 1))
                        db.execute('INSERT INTO events VALUES (?, ?, ?, ?, ?)', (classroom, classroom, 'test', '{}', 1))
                self.assertEqual(module.reset_demo_classroom(), {'ok': True})
                self.assertFalse(demo_file.exists())
                self.assertTrue(other_file.exists())
                with closing(module.connect()) as db, db:
                    for table in ('resources', 'resource_fts', 'jobs', 'events'):
                        self.assertEqual(db.execute(f'SELECT count(*) FROM {table} WHERE classroom_id = ?', ('demo-classroom',)).fetchone()[0], 0)
                        self.assertEqual(db.execute(f'SELECT count(*) FROM {table} WHERE classroom_id = ?', ('other-classroom',)).fetchone()[0], 1)

if __name__ == '__main__':
    unittest.main()
