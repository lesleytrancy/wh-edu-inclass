import json
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from server import app
from server.student_growth import individual_growth_evidence
from server.demo_dataset import generate_dataset


class StudentGrowthTest(unittest.TestCase):
    def setUp(self):
        self.context = {'sectionId': 'lesson', 'classEndedAt': 200, 'reportStudents': [{'id': 'a', 'name': '甲'}, {'id': 'b', 'name': '乙'}], 'questionHistory': [{'id': 'q', 'kind': 'question', 'question': '解释成因', 'answers': [{'id': 'a', 'text': '流水侵蚀形成', 'correct': True}, {'id': 'b', 'text': '示例回答', 'simulated': True}]}]}

    def test_simulation_produces_no_ai_analysis_or_fabricated_scores(self):
        with patch.object(app, 'call_model', side_effect=AssertionError('no real evidence')):
            result = app.student_growth_reports(app.ContextRequest(context=generate_dataset()))
        self.assertTrue(result['reports'])
        self.assertTrue(all(row['status'] == 'insufficient' and row['dataSource'] == 'observed' for row in result['reports'].values()))

    def test_individual_real_evidence_and_no_data_students(self):
        model_result = {'reports': [{'studentId': 'a', 'conclusion': '能识别流水侵蚀作用。', 'strengths': ['解释了作用类型'], 'nextSteps': ['补充形成条件'], 'evidence': ['回答：流水侵蚀形成']}]}
        with patch.object(app, 'call_model', return_value=json.dumps(model_result, ensure_ascii=False)) as model:
            result = app.student_growth_reports(app.ContextRequest(context=self.context))
        supplied = json.loads(model.call_args.args[0][1]['content'])['students']
        self.assertEqual([row['studentId'] for row in supplied], ['a'])
        self.assertNotIn('示例回答', json.dumps(supplied, ensure_ascii=False))
        self.assertEqual(result['reports']['a']['status'], 'ready')
        self.assertEqual(result['reports']['b']['status'], 'insufficient')
        self.assertEqual(result['reports']['a']['sectionId'], 'lesson')

    def test_group_results_do_not_become_every_members_evidence(self):
        self.context['questionHistory'] = [{'id': 'g', 'kind': 'discussion', 'question': '比较成因', 'groups': [{'id': 'g1', 'leaderId': 'a'}], 'members': {'a': 'g1', 'b': 'g1'}, 'answers': [{'id': 'g1', 'voiceText': '组长发言', 'text': '组长发言'}]}]
        personal = individual_growth_evidence(self.context)
        self.assertEqual(personal['a']['discussions'][0]['response'], '组长发言')
        self.assertEqual(personal['b']['discussions'], [])

    def test_model_failure_and_wrong_student_ids_surface_errors(self):
        with patch.object(app, 'call_model', side_effect=RuntimeError('provider unavailable')):
            with self.assertRaises(HTTPException):
                app.student_growth_reports(app.ContextRequest(context=self.context))
        with patch.object(app, 'call_model', return_value='{"reports": []}'):
            with self.assertRaises(HTTPException):
                app.student_growth_reports(app.ContextRequest(context=self.context))
