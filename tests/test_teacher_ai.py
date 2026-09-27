import unittest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from server.app import ContextRequest, RegenerateRequest, classroom_report, regenerate_content, teacher_insight, analyze, AnalyzeRequest, call_model
import json


class TeacherAITest(unittest.TestCase):
    def test_model_request_uses_json_post(self):
        response = Mock()
        response.read.return_value = b'{"choices":[{"message":{"content":"ok"}}]}'
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch.dict('os.environ', {'DOUBAO_API_KEY': 'test-key', 'DOUBAO_MODEL': 'test-model'}), patch('server.app.urlopen', return_value=response) as send:
            self.assertEqual(call_model([{'role': 'user', 'content': 'test'}]), 'ok')
        request = send.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(json.loads(request.data)['model'], 'test-model')

    def test_answer_analysis_uses_actual_question_and_answers(self):
        expected = {'summary': '能解释溶蚀', 'commonIssue': '未解释沉积', 'extension': '追问沉积条件'}
        with patch('server.app.retrieve', return_value=[]), patch('server.app.call_model', return_value=json.dumps(expected)) as model:
            result = analyze(AnalyzeRequest(classroomId='test', question='溶洞如何形成？', answers=['水沿裂隙溶解石灰岩', '  ']))
        self.assertEqual(result['summary'], expected['summary'])
        payload = json.loads(model.call_args.args[0][1]['content'])
        self.assertEqual(payload['answers'], ['水沿裂隙溶解石灰岩'])
        self.assertEqual(payload['question'], '溶洞如何形成？')

    def test_no_answers_do_not_invent_analysis(self):
        with patch('server.app.retrieve', return_value=[]), patch('server.app.call_model') as model:
            result = analyze(AnalyzeRequest(classroomId='test', question='为什么？', answers=[]))
        model.assert_not_called()
        self.assertIn('尚未收到', result['summary'])

    def test_model_timeout_has_explicit_http_status(self):
        with patch('server.app.call_model', side_effect=TimeoutError('timed out')):
            with self.assertRaises(HTTPException) as error:
                teacher_insight(ContextRequest(context={}))
        self.assertEqual(error.exception.status_code, 504)

    def test_teacher_insight_is_separate_conclusion(self):
        with patch('server.app.call_model', return_value=json.dumps({'conclusion': '学生能描述现象，因果解释仍不完整', 'suggestions': ['追问形成条件']})):
            result = teacher_insight(ContextRequest(context={'utterances': [{'text': '岩石被水溶解'}]}))
        self.assertIn('conclusion', result)
        self.assertNotIn('summary', result)

    def test_report_preserves_missing_evidence(self):
        report = dict(title='诊断', conclusion='记录不足', questionCounts=[None]*5, radar=[None]*5, timeline=[], mode='数据不足', transitions=[], suggestions=[], issues=[], limitations=['无课堂录像'])
        with patch('server.app.call_model', return_value=json.dumps(report)):
            self.assertEqual(classroom_report(ContextRequest(context={})), report)

    def test_report_accepts_named_dimensions(self):
        report = dict(title='诊断', conclusion='记录不足', questionCounts={}, radar={}, timeline=[], mode='数据不足', transitions=[], suggestions=[], issues=[], limitations=[])
        with patch('server.app.call_model', return_value=json.dumps(report)):
            result = classroom_report(ContextRequest(context={}))
        self.assertEqual(result['radar'], [None]*5)
        self.assertEqual(result['questionCounts'], [None]*5)

    def test_failures_do_not_return_demo_content(self):
        with patch('server.app.call_model', side_effect=RuntimeError('unavailable')):
            for action, request in [(teacher_insight, ContextRequest(context={})), (classroom_report, ContextRequest(context={})), (regenerate_content, RegenerateRequest(stage='discussion', content={}))]:
                with self.assertRaises(HTTPException) as error:
                    action(request)
                self.assertEqual(error.exception.status_code, 503)

    def test_invalid_report_rejected(self):
        with patch('server.app.call_model', return_value='{"title":"incomplete"}'):
            with self.assertRaises(HTTPException):
                classroom_report(ContextRequest(context={}))

    def test_regeneration_validates_answer(self):
        invalid = {'title': '学习', 'task': '阅读', 'exercises': [{'question': '问题', 'options': ['A', 'B'], 'answer': 'C'}]*3}
        with patch('server.app.call_model', return_value=json.dumps(invalid)):
            with self.assertRaises(HTTPException):
                regenerate_content(RegenerateRequest(stage='preview', content={}))

if __name__ == '__main__':
    unittest.main()
