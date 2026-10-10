"""Reproducible synthetic interactions; never pretend these are real submissions."""
import argparse
import json
import random
from datetime import datetime, timezone
from pathlib import Path

KNOWLEDGE = ['喀斯特溶蚀', '流水侵蚀', '流水堆积', '风力地貌', '地貌观察']
LEVELS = ['记忆', '理解', '应用', '分析', '评价', '创造']
ERRORS = ['概念混淆', '计算失误', '审题不清', '逻辑推理缺失']


def generate_dataset(seed=20261010, roster=None):
    rng = random.Random(seed)
    start = int(datetime(2026, 10, 10, 1, tzinfo=timezone.utc).timestamp() * 1000)
    names = ['林小满', '周子航', '陈雨桐', '李思齐', '王嘉宁', '张星宇', '刘可欣', '赵一鸣', '黄子涵', '吴亦安', '徐晨曦', '孙晓彤', '胡博文', '朱若溪', '高梓轩', '何书瑶', '郭雨泽', '马诗涵', '罗明远', '梁芷晴', '宋承宇', '郑语桐', '谢景行', '韩沐阳', '唐心怡', '冯逸凡', '于清越', '董嘉禾', '萧知夏', '程云舒']
    students = [{'id': f'D{i+1:03}', 'name': name, 'group': i // 5 + 1, 'region': ['前排', '左侧', '右侧', '后排'][i % 4]} for i, name in enumerate(names)]
    if roster is not None:
        students = [{**student, 'region': ['前排', '左侧', '右侧', '后排'][i % 4]} for i, student in enumerate(roster)]
    prompts = [
        ('形成喀斯特溶洞需要哪些条件？', ['A. 可溶性石灰岩、含二氧化碳的水和裂隙', 'B. 沙漠中的强风', 'C. 岩浆喷发', 'D. 冰川覆盖']),
        ('山区河谷呈V形，主要受到哪种作用？', ['A. 风力堆积', 'B. 流水侵蚀', 'C. 海浪堆积', 'D. 岩浆作用']),
        ('河流出山口流速减慢，最可能形成什么地貌？', ['A. 风蚀蘑菇', 'B. 溶洞', 'C. 冲积扇', 'D. 峡谷']),
        ('沙丘迎风坡较缓、背风坡较陡，主要成因为何？', ['A. 冰川刨蚀', 'B. 海浪侵蚀', 'C. 流水溶蚀', 'D. 风力搬运和堆积']),
        ('野外观察地貌，首先应该记录什么？', ['A. 形态、坡度、物质组成和空间位置', 'B. 仅记录游客数量', 'C. 仅拍照不标位置', 'D. 仅凭印象判定成因']),
    ]
    responses = [
        ('含二氧化碳的水沿裂隙溶解石灰岩，形成地下溶洞。', '流水把泥沙堆在地下就形成了溶洞。'),
        ('山区坡度大，河流下切侵蚀形成V形谷。', '河谷是风吹出来的，流水只会堆积。'),
        ('流速降低，搬运能力减弱，泥沙沉积形成冲积扇。', '流速越快就会堆积越多，形成冲积扇。'),
        ('风搬运沙粒并在条件变化时沉积，形成沙丘。', '沙丘完全由岩石溶解形成。'),
        ('先观察形态、坡度、组成和位置，再结合过程解释。', '只看一张照片就能确定全部形成过程。'),
    ]
    pack = {stage: {'title': '常见地貌类型', 'task': '1. 观察地貌特征\n2. 解释形成过程\n3. 绘制因果链', 'tasks': ['观察地貌特征', '解释形成过程', '绘制因果链'], 'exercises': [
        {'id': f'{stage}-{k}', 'type': 'single', 'question': ('课前诊断：' if stage == 'preview' else '课后巩固：') + prompts[k][0], 'knowledgePoint': point, 'options': prompts[k][1], 'answer': prompts[k][1][[0, 1, 2, 3, 0][k]]} for k, point in enumerate(KNOWLEDGE)]} for stage in ['preview', 'review']}
    state = {'simulation': {'id': f'geography-30-v2-{seed}', 'seed': seed, 'label': '30人模拟课堂 · 非真实学情'}, 'reportStudents': students, 'lessonTitle': '常见地貌类型 · 30人测试课堂', 'phase': 'after', 'activity': 'screen', 'resourcesReady': True, 'learningPack': pack, 'publishedLearningPack': pack, 'resourceConfirmations': {'preview': True, 'review': True}, 'learningAnswers': {'preview': {}, 'review': {}}, 'learningFeedback': {'preview': {}, 'review': {}}, 'learningProgress': {'preview': {}, 'review': {}}, 'studentUtterances': [], 'questionHistory': [], 'studentPoints': {}, 'lessonScoreHistory': {}, 'abilityProfiles': {}, 'growthMilestones': [], 'projectProgress': [], 'competencyEvidence': [], 'classStartedAt': start, 'classEndedAt': start + 45*60000, 'activityHistory': [], 'engagementObservations': [], 'attendance': [s['id'] for s in students], 'discussionMinutes': {}, 'curriculumGoals': '测试教学目标（非课标原文）：通过地貌观察与形成过程分析，训练综合思维、区域认知、人地协调观和地理实践力。', 'trainingRequirements': ''}
    for i, student in enumerate(students):
        sid = student['id']
        ability = .38 + (i % 10) * .052
        state['studentPoints'][sid] = 0
        for stage, improvement in [('preview', 0), ('review', .19)]:
            answers = {}
            for k, exercise in enumerate(pack[stage]['exercises']):
                if (i + k) % (13 if stage == 'preview' else 19) == 0:
                    continue
                correct = rng.random() < ability + improvement - (.15 if k == 0 else 0)
                answers[exercise['id']] = {'text': exercise['answer'] if correct else exercise['options'][1 if exercise['answer'] == exercise['options'][0] else 0], 'submittedAt': start + (-600000 if stage == 'preview' else 3600000) + i*1000, 'simulated': True, 'errorCause': None if correct else ERRORS[(i+k) % 4]}
            state['learningAnswers'][stage][sid] = answers
            state['learningProgress'][stage][sid] = {'videoCompletion': round(rng.uniform(.55, 1)*100), 'documentCompletion': round(rng.uniform(.6, 1)*100), 'buddyMinutes': 4 + i % 18}
            state['studentUtterances'].append({'studentId': sid, 'name': student['name'], 'stage': stage, 'text': f'{KNOWLEDGE[i % 5]}的形成条件是什么？溶蚀和堆积有什么区别？', 'at': start + (-300000 if stage == 'preview' else 3800000), 'simulated': True})
        base = 42 + i % 10 * 4
        state['lessonScoreHistory'][sid] = [{'sectionId': f'demo-week-{w}', 'label': f'第{w+1}周', 'score': min(98, base + w*3 + rng.randrange(-3, 4)), 'subjectScore': min(98, base + w*4), 'simulated': True} for w in range(6)]
        state['abilityProfiles'][sid] = [min(98, base + rng.randrange(5, 22)) for _ in range(5)]
        state['growthMilestones'].append({'studentId': sid, 'week': 2+i % 4, 'dimension': i % 5, 'importance': 5+i % 8, 'label': '首次主动提问' if i % 2 else '地貌成因解释达标', 'simulated': True})
    for i, student in enumerate(students):
        if i % 4 != 0:
            state['studentUtterances'].append({'studentId': student['id'], 'name': student['name'], 'stage': 'class', 'text': '我认为需要分别分析流水侵蚀和堆积的条件。', 'at': start + (10+i)*60000, 'simulated': True})
    if roster is not None:
        state['simulation'] = {'id': 'roster-report-demo', 'label': f'{len(students)}人演示报告 · 非真实学情'}
        state['lessonTitle'] = '常见地貌类型 · 班级演示报告'
    for q in range(12 if students else 0):
        run = {'id': f'demo-q-{q}', 'kind': 'question', 'question': f'{LEVELS[q % 6]}任务：' + prompts[q % 5][0], 'knowledgePoint': KNOWLEDGE[q % 5], 'bloomLevel': LEVELS[q % 6], 'questionType': ['定向提问', '随机抽查', '自由抢答'][q % 3], 'targetStudentIds': [students[(q*2) % min(12, len(students))]['id'], students[(q*2+4) % min(24, len(students))]['id']], 'startedAt': start + (3+q*3)*60000, 'status': 'result', 'answers': []}
        for i, student in enumerate(students):
            if (i+q) % 7 == 0: continue
            correct = rng.random() < .52 + i % 10*.035
            run['answers'].append({'id': student['id'], 'name': student['name'], 'text': responses[q % 5][0 if correct else 1], 'correct': correct, 'responseQuality': '正确' if correct else ('部分正确' if i % 3 else '错误'), 'firstResponseAt': run['startedAt'] + rng.randrange(3000, 22000), 'simulated': True})
            state['studentPoints'][student['id']] += 1
        state['questionHistory'].append(run)
    for minute in range(0, 46, 5):
        state['activityHistory'].append({'activity': ['screen', 'question', 'discussion'][minute // 5 % 3], 'phase': 'class', 'at': start + minute*60000})
        state['engagementObservations'].append({'minute': minute, 'participation': 62+minute//5*2, 'simulated': True})
    for g in range(len(set(s.get('group', 1) for s in students))):
        state['discussionMinutes'][f'demo-group-{g+1}'] = {'text': '小组比较溶蚀与堆积条件，提出用岩石和水的酸碱性验证成因。', 'simulated': True}
    state['classroomMinutes'] = {'summary': '模拟课堂围绕五类地貌展开观察、解释、讨论和练习，溶蚀与沉积是共性薄弱点。', 'topics': ['五类地貌特征与形成过程'], 'questions': ['溶蚀与沉积的条件有什么区别？'], 'actions': ['用因果链对比典型地貌形成条件'], 'simulated': True}
    for j, label in enumerate(['问题提出', '资料收集', '方案设计', '成果展示']):
        state['projectProgress'].append({'label': label, 'completion': 96-j*9, 'quality': 88-j*5, 'simulated': True})
    for j, label in enumerate(['综合思维', '区域认知', '人地协调观', '地理实践力']):
        state['competencyEvidence'].append({'label': label, 'attainment': 68+j*5, 'frequency': 8+j*3, 'depth': 60+j*7, 'simulated': True})
    state['testQuestions'] = ['哪些学生的课前预习需要重点关注？请列出姓名和依据。', '溶蚀知识点从课前到课后改善了多少？', '课堂提问是否覆盖后排学生？', '哪些学生作业尚未完成？', 'AI伴学时长与提升有关吗？能否证明因果关系？']
    return state


def install_demo(db, state):
    """Add an isolated test section once; preserve every existing teaching section."""
    section_id = 'demo-geography-30'
    for row in db.execute('SELECT username, library FROM teachers').fetchall():
        library = json.loads(row['library'])
        sections = [s for b in library['books'] for c in b['chapters'] for s in c['sections']]
        existing = next((s for s in sections if s['id'] == section_id), None)
        if existing:
            previous = existing.get('teachingState', {}).get('simulation', {})
            if previous.get('id', '').startswith('geography-30-') and previous.get('id') != state['simulation']['id']:
                existing['teachingState'] = state
                db.execute('UPDATE teachers SET library = ? WHERE username = ?', (json.dumps(library, ensure_ascii=False), row['username']))
            continue
        empty = all(not s.get('teachingState') and not s.get('materials') for s in sections)
        library['books'].append({'id': 'demo-book', 'name': 'AI测试数据集（模拟）', 'chapters': [{'id': 'demo-chapter', 'name': '30人全流程课堂', 'sections': [{'id': section_id, 'name': state['lessonTitle'], 'title': state['lessonTitle'], 'materials': [], 'teachingState': state}]}]})
        if empty: library['selectedSectionId'] = section_id
        db.execute('UPDATE teachers SET library = ? WHERE username = ?', (json.dumps(library, ensure_ascii=False), row['username']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=20261010)
    parser.add_argument('--output', default='data/demo-classroom-30.json')
    args = parser.parse_args()
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(generate_dataset(args.seed), ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'已生成30人模拟数据集：{path}')
