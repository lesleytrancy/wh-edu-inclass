import json
import unittest
from unittest.mock import patch
from server.app import validate_pack, regenerate_content, RegenerateRequest

class LearningPackTest(unittest.TestCase):
    def stage(self):
        return {'title': '喀斯特', 'tasks': ['观察原图并标注景观', '用资料说明流水作用', '总结地貌与农业的关系'], 'exercises': [{'question': '多余题目'}]}

    def test_resources_generate_tasks_and_structured_discussion_only(self):
        pack = validate_pack({'preview': self.stage(), 'review': self.stage(), 'discussion': {'question': '为何缺水？', 'analysis': '岩石裂隙渗漏', 'goal': '说明水文与地貌的联系'}})
        self.assertEqual(pack['preview']['exercises'], [])
        self.assertEqual(pack['review']['exercises'], [])
        self.assertEqual(len(pack['preview']['tasks']), 3)
        self.assertEqual(pack['discussions'][0]['analysis'], '岩石裂隙渗漏')

    def test_less_than_three_tasks_rejected(self):
        with self.assertRaises(ValueError):
            validate_pack({'preview': {'title': '地貌', 'tasks': ['观察']}, 'review': self.stage()})

    def test_regeneration_only_returns_requested_stage(self):
        with patch('server.app.call_model', return_value=json.dumps(self.stage())) as model:
            result = regenerate_content(RegenerateRequest(stage='preview', content={}, materialIds=[]))
        self.assertEqual(result['exercises'], [])
        self.assertNotIn('review', result)
        self.assertEqual(json.loads(model.call_args.args[0][1]['content'])['stage'], 'preview')

    def test_new_discussion_contains_all_three_fields(self):
        discussion = {'question': '如何开发？', 'analysis': '评估交通与旅游', 'goal': '理解双重影响'}
        with patch('server.app.call_model', return_value=json.dumps({'discussion': discussion})):
            result = regenerate_content(RegenerateRequest(stage='discussion', content={'question': '旅游'}, materialIds=[]))
        self.assertEqual(result['discussion'], discussion)
