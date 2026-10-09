import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from server import app as module


class TeacherLibraryTest(unittest.TestCase):
    def request(self, token=None):
        headers = [] if token is None else [(b'authorization', f'Bearer {token}'.encode())]
        return Request({'type': 'http', 'headers': headers})

    def test_accounts_keep_separate_libraries_and_reset_keeps_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            materials = root / 'classroom-materials'
            materials.mkdir()
            with patch.object(module, 'DB_PATH', root / 'classroom.db'), patch.object(module, 'CLASSROOM_MATERIAL_DIR', materials):
                module.init_db()
                with self.assertRaises(HTTPException):
                    module.login_teacher(module.TeacherLoginRequest(username='fanjiaqi', password='wrong'))
                first = module.login_teacher(module.TeacherLoginRequest(username='fanjiaqi', password='1234'))
                second = module.login_teacher(module.TeacherLoginRequest(username='dengyongchun', password='1234'))
                with self.assertRaises(HTTPException):
                    module.get_teacher_library(self.request())
                library = module.get_teacher_library(self.request(first['token']))['library']
                self.assertEqual(len(library['books']), 2)
                self.assertEqual(len(library['books'][0]['chapters']), 6)
                self.assertEqual(len(library['books'][1]['chapters']), 5)
                section = library['books'][0]['chapters'][0]['sections'][0]
                section['title'] = '宇宙环境公开课'
                section['materials'].append({'id': 'a' * 36, 'name': 'lesson.pdf', 'type': 'application/pdf'})
                self.assertEqual(module.save_teacher_library(library, self.request(first['token'])), {'ok': True})
                self.assertEqual(module.get_teacher_library(self.request(first['token']))['library'], library)
                other = module.get_teacher_library(self.request(second['token']))['library']
                self.assertNotEqual(other['books'][0]['chapters'][0]['sections'][0]['title'], section['title'])
                self.assertEqual(other['books'][0]['chapters'][0]['sections'][0]['materials'], [])
                stored = materials / ('a' * 36)
                stored.write_bytes(b'pdf')
                unowned = materials / ('b' * 36)
                unowned.write_bytes(b'old')
                module.reset_demo_classroom()
                self.assertTrue(stored.exists())
                self.assertFalse(unowned.exists())
                self.assertEqual(module.logout_teacher(self.request(first['token'])), {'ok': True})
                with self.assertRaises(HTTPException):
                    module.get_teacher_library(self.request(first['token']))

    def test_confirmed_publication_survives_relogin_and_database_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(module, 'DB_PATH', root / 'classroom.db'), patch.object(module, 'classroom_state', None):
                module.init_db()
                session = module.login_teacher(module.TeacherLoginRequest(username='fanjiaqi', password='1234'))
                library = module.get_teacher_library(self.request(session['token']))['library']
                section = library['books'][0]['chapters'][0]['sections'][0]
                pack = {stage: {'title': stage, 'task': '任务一\n任务二\n任务三', 'tasks': ['任务一', '任务二', '任务三'], 'exercises': [{'id': stage, 'question': '问题', 'options': ['A', 'B'], 'answer': 'A'}]} for stage in ('preview', 'review')}
                discussions = [{'id': 'discussion', 'question': '讨论题', 'analysis': '解析', 'goal': '目标'}]
                section['teachingState'] = {
                    'learningPack': pack, 'publishedLearningPack': pack,
                    'resourceConfirmations': {'preview': True, 'discussion': True, 'review': True},
                    'discussions': discussions, 'publishedDiscussions': discussions,
                    'discussionQuestion': '讨论题', 'publishedDiscussionQuestion': '讨论题',
                    'learningNotifications': [{'id': 'notice', 'stage': 'preview', 'sentAt': 123}],
                }
                module.save_teacher_library(library, self.request(session['token']))
                module.logout_teacher(self.request(session['token']))
                module.init_db()
                restored_session = module.login_teacher(module.TeacherLoginRequest(username='fanjiaqi', password='1234'))
                restored = module.get_teacher_library(self.request(restored_session['token']))['library']
                self.assertEqual(restored['books'][0]['chapters'][0]['sections'][0]['teachingState'], section['teachingState'])
                other_session = module.login_teacher(module.TeacherLoginRequest(username='dengyongchun', password='1234'))
                other = module.get_teacher_library(self.request(other_session['token']))['library']
                self.assertNotIn('teachingState', other['books'][0]['chapters'][0]['sections'][0])


if __name__ == '__main__':
    unittest.main()
