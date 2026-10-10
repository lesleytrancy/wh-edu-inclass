import json
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from server import app
from server.demo_reports import build_demo_reports
from server.report_analytics import REPORTS
from server.discussion_state import merge_discussion_run


class IndividualReportsTest(unittest.TestCase):
    def setUp(self):
        self.roster = [{'id': f'{i+1:05}', 'name': f'学生{i+1}', 'group': i % 8 + 1} for i in range(50)]
        self.context = {'reportStudents': self.roster, 'sectionId': 'lesson', 'lessonTitle': '当前课节'}

    def test_demo_every_student_has_data_without_writing_real_classroom(self):
        with patch.object(app, 'classroom_state', {'real': True}), patch.object(app, 'emit', side_effect=AssertionError('demo must not emit')):
            demo = app.demo_reports(app.ContextRequest(context=self.context))
            self.assertEqual(app.classroom_state, {'real': True})
        self.assertTrue(demo['report']['demo'])
        self.assertEqual(set(demo['report']['sections']), set(REPORTS))
        self.assertEqual(demo, build_demo_reports(self.context))
        for sid in [s['id'] for s in self.roster]:
            for stage in ['preview', 'review']:
                self.assertIn(sid, demo['state']['learningAnswers'][stage])
                self.assertIn(sid, demo['state']['learningProgress'][stage])
            self.assertIn(sid, demo['state']['abilityProfiles'])
            self.assertEqual(len(demo['state']['lessonScoreHistory'][sid]), 6)
        self.assertEqual(demo['state']['reportStudents'][0]['name'], '学生1')
        self.assertEqual(sum(len(section['chapters']) for section in demo['report']['sections'].values()), 24)
        self.assertEqual(sum(len(rows) for rows in demo['report']['analytics']['charts'].values()), 18)
        for roster in [[], self.roster[:1]]:
            self.assertEqual(len(build_demo_reports({'reportStudents': roster})['state']['reportStudents']), len(roster))

    def test_single_report_generates_only_requested_section(self):
        for tab, (_, headings) in REPORTS.items():
            section = {'summary': '依据记录生成的结论', 'evidence': [], 'chapters': [{'title': title, 'analysis': '分析', 'recommendations': ['建议']} for title in headings]}
            with patch.object(app, 'call_model', return_value=json.dumps(section, ensure_ascii=False)) as model:
                result = app.classroom_report_section(app.ReportSectionRequest(context=self.context, tab=tab))
            self.assertEqual(set(result['sections']), {tab})
            self.assertEqual(set(result['analytics']['charts']), {tab})
            self.assertEqual(model.call_count, 1)
            self.assertEqual(json.loads(model.call_args.args[0][1]['content'])['requestedReport'], tab)
            self.assertFalse(result['demo'])

    def test_invalid_chapter_count_and_model_failure_surface_errors(self):
        with patch.object(app, 'call_model', return_value='{"summary":"不完整","evidence":[],"chapters":[]}'):
            with self.assertRaises(HTTPException):
                app.classroom_report_section(app.ReportSectionRequest(context=self.context, tab='after'))
        with patch.object(app, 'call_model', side_effect=RuntimeError('provider unavailable')):
            with self.assertRaises(HTTPException):
                app.classroom_report_section(app.ReportSectionRequest(context=self.context, tab='growth'))


class ConcurrentDiscussionTest(unittest.TestCase):
    def test_members_text_merges_with_voice_and_cannot_reopen_finished_run(self):
        group = {'id': 'g1', 'number': 1, 'name': '1组', 'leaderName': '组长'}
        base = {'kind': 'discussion', 'status': 'answering', 'groups': [group], 'members': {'one': 'g1', 'two': 'g1'}, 'answers': [{'id': 'g1', 'voiceText': '组长语音', 'voiceUpdatedAt': 10, 'text': '组长语音'}]}
        one = {**base, 'contributions': {'one': {'studentId': 'one', 'groupId': 'g1', 'name': '甲', 'text': '观点甲', 'updatedAt': 20}}}
        two = {**base, 'contributions': {'two': {'studentId': 'two', 'groupId': 'g1', 'name': '乙', 'text': '观点乙', 'updatedAt': 21}}}
        merged = merge_discussion_run(merge_discussion_run(base, one), two)
        self.assertEqual(set(merged['contributions']), {'one', 'two'})
        for text in ['组长语音', '甲：观点甲', '乙：观点乙']:
            self.assertEqual(merged['answers'][0]['text'].count(text), 1)
        edited = {**one, 'contributions': {'one': {**one['contributions']['one'], 'text': '修改后的观点', 'updatedAt': 22}}}
        merged = merge_discussion_run(merged, edited)
        self.assertIn('修改后的观点', merged['answers'][0]['text'])
        self.assertNotIn('甲：观点甲', merged['answers'][0]['text'])
        finished = {**merged, 'status': 'result'}
        self.assertEqual(merge_discussion_run(finished, two), finished)


if __name__ == '__main__':
    unittest.main()
