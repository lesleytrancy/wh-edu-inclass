"""Read-only demonstrations for the supplied roster; never install synthetic records."""
from .demo_dataset import generate_dataset
from .ai_context import aggregate
from .report_analytics import build_analytics, REPORTS


def build_demo_reports(context):
    roster = context.get('reportStudents', [])
    state = generate_dataset(roster=roster)
    state['lessonTitle'] = context.get('lessonTitle') or state['lessonTitle']
    evidence = aggregate(state)
    analytics = build_analytics(state, evidence)
    count = len(roster)
    preview = analytics.get('previewAccuracy')
    review = analytics.get('reviewAccuracy')
    details = {
        'pre': [f'本演示班级共{count}人，每名学生均模拟了阅读、预习与学伴交流记录；部分题目设为未提交，以展示不同完成度。', f'模拟预习已评分正确率为{preview if preview is not None else "数据不足"}%，地貌形成条件与作用过程是诊断重点。', '模拟学生提出溶蚀与堆积区别等疑问，需区分条件缺失、概念混淆与证据不足。', '按预习表现设置基础概念、因果链解释与情境迁移三类任务。'],
        'quality': ['演示课堂交替开展资料观察、教师提问、小组讨论与练习。', '模拟参与记录呈现学生之间的差异；参与度不能直接作为注意力测量。', '演示随堂检测保留正确、部分正确、错误及未回答四类记录。', '结合互动频次与回答质量评估教学效果，避免仅以平均正确率下结论。'],
        'questions': ['演示提问包含定向、随机与自由回答，比较覆盖人数和参与机会。', '记忆、理解、应用、分析、评价、创造六类任务均有模拟记录。', '模拟回答用于展示完整因果解释、概念混淆与证据不足的差异。', '为回答较少的学生增加等待时间与问题支架，再用迁移题检验理解。'],
        'after': [f'模拟课后已评分正确率为{review if review is not None else "数据不足"}%，保留未完成记录用于展示补交与反馈流程。', '对比课前与课后同一知识点表现，识别巩固效果与仍需干预的内容。', '演示错因包括概念混淆、计算失误、审题不清与逻辑推理缺失。', '依据每名学生的模拟作答和学伴交流，安排概念辨析、过程解释与应用练习。'],
        'growth': [f'{count}名学生各有六周模拟成绩与能力画像，可查看个人与班级差异。', '综合模拟阅读完成度、学伴交流和课堂参与记录，呈现自主学习行为。', '以地貌观察、因果解释和情境应用任务识别优势；演示数值不是正式能力量表。', '模拟首次主动提问与解释达标等成长节点，用具体任务反馈代替笼统评价。'],
        'standards': ['演示综合思维、区域认知、人地协调观与地理实践力四个维度的表现。', '模拟问题提出、资料收集、方案设计与成果展示四个项目阶段。', '按模拟证据的频次与解释深度展示探究表现，频次不等同于达成水平。', '此处目标为演示用教学目标；真实评价须对照教师提供的课标和学校培养要求。'],
    }
    sections = {key: {
        'summary': f'{title}（演示）：基于当前班级{count}名学生的模拟学习记录，用于展示报告效果。' + details[key][0],
        'evidence': [f'模拟学生：{s["name"]}（{s["id"]}）' for s in roster],
        'chapters': [{'title': heading, 'analysis': details[key][i], 'recommendations': ['结合任务证据分层指导，使用后续作答检验效果。']} for i, heading in enumerate(headings)],
        'keywords': [],
    } for key, (title, headings) in REPORTS.items()}
    return {'state': state, 'report': {'demo': True, 'sections': sections, 'analytics': analytics, 'limitations': ['本报告全部学生表现与评分均为模拟数据，不代表真实学生情况。']}}
