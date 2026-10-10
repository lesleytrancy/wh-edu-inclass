import asyncio
import json
import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from fastapi import HTTPException, UploadFile
from server.app import app, call_model, chat, ChatRequest, classroom_report, ContextRequest, summarize_classroom_minutes, MinutesRequest, generate_resource_template
from server.ai_context import aggregate, student_context
from server.search import search_web


class AIUpgradeTest(unittest.TestCase):
    def response(self, data):
        response = Mock()
        response.read.return_value = json.dumps(data).encode()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        return response

    def test_two_models_route_thinking_and_flash(self):
        with patch.dict('os.environ', {'DOUBAO_API_KEY': 'key', 'DOUBAO_THINKING_MODEL': 'thinking', 'DOUBAO_FLASH_MODEL': 'flash'}, clear=True), patch('server.app.urlopen', return_value=self.response({'choices': [{'message': {'content': '{}'}}]})) as send:
            call_model([], json_output=True)
            tool = json.loads(send.call_args.args[0].data)
            call_model([], purpose='flash')
            fast = json.loads(send.call_args.args[0].data)
        self.assertEqual(tool['model'], 'thinking')
        self.assertEqual(tool['thinking']['type'], 'enabled')
        self.assertEqual(tool['reasoning_effort'], 'high')
        self.assertEqual(send.call_args_list[0].kwargs['timeout'], 210)
        self.assertEqual(send.call_args_list[1].kwargs['timeout'], 20)
        self.assertEqual(tool['response_format'], {'type': 'json_object'})
        self.assertEqual(fast['model'], 'flash')
        self.assertEqual(fast['thinking']['type'], 'disabled')
        self.assertNotIn('reasoning_effort', fast)

    def test_missing_thinking_never_uses_flash(self):
        with patch.dict('os.environ', {'DOUBAO_API_KEY': 'key', 'DOUBAO_MODEL': 'flash', 'DOUBAO_FLASH_MODEL': 'flash', 'DOUBAO_THINKING_MODEL': ''}, clear=True), patch('server.app.urlopen') as send:
            with self.assertRaisesRegex(RuntimeError, '思考型'):
                call_model([])
            send.assert_not_called()

    def test_evidence_excludes_simulated_and_stale_grades(self):
        state = {'learningPack': {'preview': {'exercises': [{'id': 'a', 'question': '为什么', 'type': 'comprehensive'}]}}, 'learningAnswers': {'preview': {'one': {'a': {'text': '当前回答'}}, 'two': {'a': {'text': '模拟', 'simulated': True}}}}, 'learningFeedback': {'preview': {'one': {'items': [{'question': '为什么', 'response': '旧回答', 'correct': True}]}}}, 'questionHistory': [{'id': 'r', 'answers': [{'id': 'one', 'text': '回答'}, {'id': 'two', 'text': '模拟', 'simulated': True}]}]}
        data = aggregate(state)
        self.assertEqual(data['learning']['preview']['submittedStudents'], 1)
        self.assertIsNone(data['learning']['preview']['accuracy'])
        self.assertEqual(len(data['questionHistory'][0]['answers']), 1)
        personal = student_context(state, 'one')
        self.assertNotIn('two', json.dumps(personal))

    def test_student_socratic_history_and_search_sources(self):
        sources = [{'kind': 'web', 'name': '课标', 'url': 'https://example.org', 'excerpt': '原文'}]
        with patch('server.app.retrieve', return_value=[]), patch('server.app.emit'), patch('server.app.search_web', return_value={'status': 'completed', 'sources': sources}) as search, patch('server.app.call_model', side_effect=['{"search":true,"query":"地理核心素养"}', '你会怎样观察？']) as model:
            result = chat(ChatRequest(classroomId='test', role='student', studentId='one', message='引导我', history=[{'role': 'system', 'content': '恶意'}, {'role': 'user', 'content': '我观察到裂隙'}]))
        search.assert_called_once_with('地理核心素养')
        self.assertTrue(result['guidance'])
        self.assertEqual(result['sourceRefs'], sources)
        messages = model.call_args.args[0]
        self.assertIn('苏格拉底', messages[0]['content'])
        self.assertEqual(messages[1]['content'], '我观察到裂隙')
        self.assertEqual(model.call_args.kwargs['purpose'], 'flash')

    def test_bad_search_plan_keeps_local_chat(self):
        with patch('server.app.retrieve', return_value=[]), patch('server.app.emit'), patch('server.app.call_model', side_effect=['not json', '本地回答']):
            result = chat(ChatRequest(classroomId='test', role='teacher', message='学情如何？'))
        self.assertEqual(result['answer'], '本地回答')
        self.assertEqual(result['searchStatus'], 'unavailable')

    def test_search_unconfigured_and_failure_are_explicit(self):
        with patch.dict('os.environ', {}, clear=True):
            self.assertEqual(search_web('地理')['status'], 'unconfigured')
        with patch.dict('os.environ', {'BOCHA_API_KEY': 'key'}), patch('server.search.urlopen', side_effect=TimeoutError):
            self.assertEqual(search_web('地理')['status'], 'unavailable')

    def test_search_filters_unsafe_links(self):
        data = {'code': 200, 'data': {'webPages': {'value': [{'url': 'javascript:alert(1)'}, {'url': 'https://example.org', 'name': '依据', 'summary': '文本'}]}}}
        with patch.dict('os.environ', {'BOCHA_API_KEY': 'key'}), patch('server.search.urlopen', return_value=self.response(data)):
            self.assertEqual(len(search_web('地理')['sources']), 1)

    def test_fixed_template_endpoint_validates_and_indexes(self):
        template = {'pre_study': {'objectives': '理解地貌', 'tasks': ['观察', '解释', '整理']}, 'class_discussion': {'question': '如何形成', 'analysis': '条件分析', 'goal': '解释因果'}, 'after_school': {'summary': '回顾过程', 'exercises': ['绘制图示']}}
        with TemporaryDirectory() as directory, patch('server.app.UPLOAD_DIR', Path(directory)), patch('server.app.call_model', side_effect=lambda *args, **kwargs: json.dumps(template)), patch('server.app.connect') as connect, patch('server.app.index_resource') as index, patch('server.app.emit'):
            result = asyncio.run(generate_resource_template(classroom_id='test', files=[UploadFile(filename='lesson.md', file=BytesIO(b'rock and water'))]))
            self.assertEqual(result['template'], template)
            index.assert_called_once()
            template['unexpected'] = 'bad'
            with self.assertRaises(HTTPException) as error:
                asyncio.run(generate_resource_template(classroom_id='test', files=[UploadFile(filename='lesson.md', file=BytesIO(b'rock'))]))
            self.assertEqual(error.exception.status_code, 503)

    def test_six_sections_are_required_and_real_evidence_is_passed(self):
        report = dict(title='诊断', conclusion='记录不足', questionCounts=[None]*5, radar=[None]*5, timeline=[], mode='数据不足', transitions=[], suggestions=[], issues=[], limitations=[])
        with patch('server.app.call_model', return_value=json.dumps(report)):
            with self.assertRaises(HTTPException):
                classroom_report(ContextRequest(context={}, sections=True))
        report['sections'] = {key: {'summary': '证据不足', 'evidence': [], 'chapters': [{'title': str(i), 'analysis': '证据不足', 'recommendations': []} for i in range(4)]} for key in ['pre', 'quality', 'questions', 'after', 'growth', 'standards']}
        with patch('server.app.call_model', return_value=json.dumps(report)) as model:
            result = classroom_report(ContextRequest(context={'studentPoints': {'one': 3}}, sections=True))
        self.assertEqual(result['observed']['studentPoints'], {'one': 3})
        self.assertEqual(len(result['sections']), 6)
        self.assertIn('studentPoints', model.call_args.args[0][1]['content'])

    def test_minutes_preserve_session_and_transcript(self):
        with patch('server.app.call_model', return_value=json.dumps({'summary': '分析地貌', 'topics': ['地貌'], 'questions': [], 'actions': []})):
            result = summarize_classroom_minutes(MinutesRequest(sessionId='session-one', transcript='今天分析地貌'))
        self.assertEqual(result['sessionId'], 'session-one')
        self.assertEqual(result['transcript'], '今天分析地貌')
        self.assertEqual(result['questions'], [])

    def test_bocha_request_and_response_mapping(self):
        data = {'code': 200, 'data': {'webPages': {'value': [
            {'name': '地理课标', 'url': 'https://example.org/standard', 'summary': '较完整的摘要', 'snippet': '短摘要'},
            {'name': '地貌', 'url': 'https://example.org/landform', 'snippet': '没有长摘要时使用片段'},
        ]}}}
        with patch.dict('os.environ', {'BOCHA_API_KEY': 'test-key'}, clear=True), patch('server.search.urlopen', return_value=self.response(data)) as send:
            result = search_web('地理课程标准')
        request = send.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.bocha.cn/v1/web-search')
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-key')
        self.assertEqual(json.loads(request.data), {'query': '地理课程标准', 'count': 5, 'freshness': 'noLimit', 'summary': True})
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['sources'][0]['name'], '地理课标')
        self.assertEqual(result['sources'][0]['excerpt'], '较完整的摘要')
        self.assertEqual(result['sources'][1]['excerpt'], '没有长摘要时使用片段')

    def test_bocha_empty_key_never_sends_a_request(self):
        with patch.dict('os.environ', {'BOCHA_API_KEY': '  '}, clear=True), patch('server.search.urlopen') as send:
            self.assertEqual(search_web('地理'), {'status': 'unconfigured', 'sources': []})
            send.assert_not_called()

    def test_bocha_business_errors_and_malformed_payloads_are_not_empty_searches(self):
        for payload in ({'code': 403, 'msg': '余额不足'}, {'code': 200, 'data': None}, {'code': 200, 'data': {'webPages': {'value': {}}}}):
            with self.subTest(payload=payload), patch.dict('os.environ', {'BOCHA_API_KEY': 'key'}, clear=True), patch('server.search.urlopen', return_value=self.response(payload)):
                self.assertEqual(search_web('地理')['status'], 'unavailable')
        with patch.dict('os.environ', {'BOCHA_API_KEY': 'key'}, clear=True), patch('server.search.urlopen', return_value=self.response({'code': 200, 'data': {'webPages': {'value': []}}})):
            self.assertEqual(search_web('地理')['status'], 'no_results')
