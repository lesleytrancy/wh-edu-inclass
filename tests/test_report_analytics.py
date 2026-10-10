import json
import sqlite3
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from server.demo_dataset import generate_dataset, install_demo
from server.ai_context import aggregate, student_context
from server.report_analytics import build_analytics, REPORTS
from server.app import classroom_report, ContextRequest, chat, ChatRequest
from server.teacher_library import initial_library


class ReportAnalyticsTest(unittest.TestCase):
    def setUp(self):
        self.state = generate_dataset()
        self.evidence = aggregate(self.state)
        self.analytics = build_analytics(self.state, self.evidence)

    def test_reproducible_30_students_all_stages_and_missing_submissions(self):
        self.assertEqual(self.state, generate_dataset())
        self.assertNotEqual(self.state, generate_dataset(42))
        self.assertEqual(len(self.state['reportStudents']), 30)
        self.assertEqual(len({s['id'] for s in self.state['reportStudents']}), 30)
        for stage in ('preview', 'review'):
            self.assertEqual(self.evidence['learning'][stage]['submittedStudents'], 30)
            self.assertLess(len(self.evidence['learning'][stage]['records']), 150)
            self.assertGreater(len(self.evidence['learning'][stage]['records']), 100)
        self.assertEqual(len(self.state['questionHistory']), 12)
        self.assertTrue(any(x['stage'] == 'class' for x in self.state['studentUtterances']))

    def test_simulated_evidence_only_in_explicit_test_context(self):
        normal = {**self.state, 'simulation': None}
        evidence = aggregate(normal)
        self.assertEqual(evidence['learning']['preview']['records'], [])
        self.assertEqual(evidence['studentUtterances'], [])
        self.assertTrue(all(not r['answers'] for r in evidence['questionHistory']))
        personal = student_context(self.state, 'D001')
        self.assertTrue(personal['simulation'])
        self.assertNotIn('D002', json.dumps(personal))

    def test_eighteen_charts_types_and_bloom_application(self):
        charts = self.analytics['charts']
        self.assertEqual(sum(len(x) for x in charts.values()), 18)
        self.assertEqual([c['type'] for c in charts['standards']], ['radar', 'bar', 'polarArea'])
        self.assertEqual(charts['questions'][1]['labels'][2], '应用')
        self.assertEqual(charts['questions'][1]['datasets'][0]['data'], [2]*6)
        self.assertTrue(charts['pre'][1]['options']['indexAxis'] == 'y')
        self.assertEqual(charts['after'][1]['datasets'][1]['type'], 'line')
        self.assertEqual(charts['after'][1]['datasets'][1]['data'][-1], 100)
        self.assertEqual(charts['quality'][0]['datasets'][1]['yAxisID'], 'engagement')

    def test_quiz_and_participation_preserve_total_students(self):
        quality = self.analytics['charts']['quality']
        self.assertEqual(sum(quality[1]['datasets'][0]['data']), 30)
        for i in range(12):
            self.assertEqual(sum(ds['data'][i] for ds in quality[2]['datasets']), 30)
        coverage = self.analytics['charts']['questions'][0]
        self.assertEqual(sum(coverage['datasets'][0]['data']), 24)

    def test_missing_evidence_does_not_create_zero_scores(self):
        empty = build_analytics({}, aggregate({}))
        self.assertIsNone(empty['previewAccuracy'])
        self.assertEqual(empty['charts']['pre'][0]['datasets'][0]['data'], [None]*4)
        self.assertEqual(empty['charts']['growth'][0]['datasets'][0]['data'], [None]*5)
        self.assertEqual(empty['charts']['standards'][0]['datasets'][0]['data'], [])

    def test_install_is_isolated_idempotent_and_preserves_existing_work(self):
        with sqlite3.connect(':memory:') as db:
            db.row_factory = sqlite3.Row
            db.execute('CREATE TABLE teachers(username TEXT, library TEXT)')
            original = initial_library()
            original['books'][0]['chapters'][0]['sections'][0]['teachingState'] = {'studentUtterances': [{'text': '真实数据'}]}
            db.execute('INSERT INTO teachers VALUES (?, ?)', ('teacher', json.dumps(original)))
            install_demo(db, self.state)
            first = db.execute('SELECT library FROM teachers').fetchone()[0]
            install_demo(db, self.state)
            self.assertEqual(first, db.execute('SELECT library FROM teachers').fetchone()[0])
            library = json.loads(first)
            self.assertEqual(library['selectedSectionId'], original['selectedSectionId'])
            self.assertEqual(library['books'][:2], original['books'])
            self.assertEqual(library['books'][-1]['chapters'][0]['sections'][0]['teachingState']['simulation'], self.state['simulation'])

    def report(self):
        return dict(title='诊断', conclusion='模拟测试', questionCounts=[0]*5, radar=[None]*5, timeline=[], mode='数据不足', transitions=[], suggestions=[], issues=[], limitations=[], sections={key: {'summary': '模拟证据分析', 'evidence': [], 'chapters': [{'title': title, 'analysis': '以模拟作答为依据', 'recommendations': ['关注概念混淆']} for title in config[1]]} for key, config in REPORTS.items()})

    def test_report_and_teacher_chat_share_same_statistics(self):
        with patch('server.app.call_model', return_value=json.dumps(self.report())) as model:
            report = classroom_report(ContextRequest(context=self.state, sections=True))
        self.assertEqual(report['analytics'], self.analytics)
        self.assertEqual(len(report['sections']['pre']['chapters']), 4)
        with patch('server.app.retrieve', return_value=[]), patch('server.app.emit'), patch('server.app.call_model', side_effect=['{"search":false}', '模拟数据答复']) as model:
            chat(ChatRequest(classroomId='test', role='teacher', message='学情如何？', context=self.state))
        payload = json.loads(model.call_args.args[0][-1]['content'])
        self.assertEqual(payload['evidence']['analytics'], report['analytics'])
        self.assertIn('模拟测试数据', model.call_args.args[0][0]['content'])

    def test_reject_report_missing_four_chapters(self):
        report = self.report()
        report['sections']['pre']['chapters'].pop()
        with patch('server.app.call_model', return_value=json.dumps(report)):
            with self.assertRaises(HTTPException):
                classroom_report(ContextRequest(context=self.state, sections=True))

if __name__ == '__main__':
    unittest.main()
