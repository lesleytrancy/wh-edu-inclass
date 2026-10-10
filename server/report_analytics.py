"""Deterministic report charts. Missing observations stay null; AI writes prose only."""
from collections import Counter

REPORTS = {
    'pre': ('课前学情预判与精准备课报告', ['预习任务整体完成情况', '核心知识点预习正确率分布', '疑问与薄弱点汇总', '课前精准教学策略建议']),
    'quality': ('课堂教学质量与实时互动总览报告', ['课堂讲练节奏与互动分布', '学生注意力与参与度分析', '随堂检测实时答题质量', '课堂整体教学效果评估与反馈']),
    'questions': ('课堂提问效能与思维品质分析报告', ['提问学生覆盖面与公平性诊断', '提问问题认知层级分布', '学生应答质量与思维表现', '提问互动策略优化方案']),
    'after': ('课后作业诊断与个性化巩固报告', ['作业完成与批改整体概况', '知识点闭环掌握度演变', '错题归因与典型错误分析', '数字人伴学与个性化干预建议']),
    'growth': ('学生综合素养与学业成长画像报告', ['学业水平长周期发展趋势', '学习习惯与自主学习能力评估', '学科优势与潜力诊断', '阶段性成长里程碑与评语']),
    'standards': ('新课标核心素养与跨学科实践落实报告', ['新课标核心素养维度达成评估', '跨学科主题与情境化任务完成度', '探究性学习与实践能力表现', '基于新课标的后续教学改进建议']),
}
COLORS = ['#8170ce', '#54a99a', '#e2aa58', '#dc7b95', '#64a8cc', '#ab8ac7']


def allowed(record, state):
    return not record.get('simulated') or bool(state.get('simulation'))


def mean(values):
    values = [x for x in values if isinstance(x, (int, float)) and not isinstance(x, bool)]
    return round(sum(values)/len(values), 1) if values else None


def percent(part, whole):
    return round(part/whole*100, 1) if whole else None


def chart(title, kind, labels, series, options=None, note=''):
    datasets = []
    for i, (label, values) in enumerate(series):
        datasets.append({'label': label, 'data': values, 'borderColor': COLORS[i % 6], 'backgroundColor': COLORS[i % 6] + ('44' if kind == 'radar' else 'bb'), 'borderWidth': 2})
    if kind in ('pie', 'doughnut', 'polarArea') and datasets:
        datasets[0]['backgroundColor'] = COLORS
    return {'title': title, 'type': kind, 'labels': labels, 'datasets': datasets, 'options': options or {}, 'note': note}


def build_analytics(state, evidence):
    students = state.get('reportStudents', [])
    roster = {s['id']: s for s in students}
    count = len(roster)
    runs = [r for r in evidence['questionHistory'] if r.get('kind') != 'discussion']
    learning = evidence['learning']
    knowledge = list(dict.fromkeys(x.get('knowledgePoint') for stage in learning.values() for x in stage['records'] if x.get('knowledgePoint')))
    for run in runs:
        if run.get('knowledgePoint') and run['knowledgePoint'] not in knowledge: knowledge.append(run['knowledgePoint'])
    def accuracy(records):
        graded = [r for r in records if isinstance(r.get('correct'), bool)]
        return percent(sum(r['correct'] for r in graded), len(graded))
    def kp_scores(records):
        return [accuracy([r for r in records if r.get('knowledgePoint') == k]) for k in knowledge]
    progress = state.get('learningProgress', {}).get('preview', {})
    preview = learning['preview']['records']
    review = learning['review']['records']
    class_answers = [{**a, 'knowledgePoint': r.get('knowledgePoint')} for r in runs for a in r['answers']]
    utterances = [x for x in evidence['studentUtterances'] if x.get('stage') == 'preview']
    rates = [mean([x.get('videoCompletion') for x in progress.values()]), mean([x.get('documentCompletion') for x in progress.values()]), percent(sum(len([r for r in preview if r['studentId'] == sid]) == len((state.get('publishedLearningPack') or state.get('learningPack') or {}).get('preview', {}).get('exercises', [])) and len([r for r in preview if r['studentId'] == sid]) > 0 for sid in roster), count), percent(len({x.get('studentId') for x in utterances}), count)]
    scores = kp_scores(preview)
    ordered = sorted(zip(knowledge, scores), key=lambda x: x[1] if x[1] is not None else -1, reverse=True)
    blind = chart('知识点预习正确率（%）', 'bar', [x[0] for x in ordered], [('正确率', [x[1] for x in ordered])], {'indexAxis': 'y', 'scales': {'x': {'min': 0, 'max': 100}}}, '橙色表示错误率 ≥ 30%；正确率仅按已评分作答计算。')
    blind['datasets'][0]['backgroundColor'] = ['#e29a58' if v is not None and v <= 70 else '#8170ce' for _, v in ordered]
    # Count distinct messages containing domain terms; never fabricate NLP frequencies.
    terms = state.get('questionKeywords') or ['溶蚀', '堆积', '侵蚀', '形成条件', '地貌', '观察', '因果', '区别']
    frequencies = sorted([(term, sum(term in x.get('text', '') for x in utterances)) for term in terms], key=lambda x: -x[1])
    frequencies = [(k, v) for k, v in frequencies if v]
    pre = [chart('预习完成度', 'radar', ['视频完播率', '文档阅读率', '测验完成率', '提问参与率'], [('全班', rates)], note='测验完成率指完成全部预习题的人数占比。'), blind, chart('高频疑问词频', 'bar', [k for k, _ in frequencies], [('含该词的疑问条数', [v for _, v in frequencies])], note='基于学伴对话关键词匹配；语义薄弱点由 AI 在正文归纳。')]
    activities = [x for x in evidence['activityHistory'] if x.get('phase') == 'class' and isinstance(x.get('at'), (int, float))]
    start = state.get('classStartedAt')
    obs = [x for x in state.get('engagementObservations', []) if allowed(x, state)]
    minutes = sorted(set([round((x['at']-start)/60000, 1) for x in activities] if start else []) | {x['minute'] for x in obs})
    rhythm = chart('课堂节奏与互动趋势', 'line', minutes, [('课堂活动', [next(({'screen': 1, 'question': 2, 'discussion': 2, 'exercise': 3}.get(x['activity']) for x in reversed(activities) if start and (x['at']-start)/60000 <= m), None) for m in minutes]), ('参与度指数', [next((x.get('participation') for x in obs if x['minute'] == m), None) for m in minutes])], {'scales': {'x': {'title': {'display': True, 'text': '课堂时间（分钟）'}}, 'y': {'min': 0, 'max': 3, 'title': {'display': True, 'text': '1 讲授 · 2 互动 · 3 练习'}}, 'engagement': {'position': 'right', 'min': 0, 'max': 100, 'grid': {'drawOnChartArea': False}}}}, '参与度使用已记录的观察指数，不等同于注意力测量。')
    rhythm['datasets'][0]['stepped'] = True
    rhythm['datasets'][1]['yAxisID'] = 'engagement'
    attendees = set(state.get('attendance', []))
    triggered = {a['id'] for a in class_answers}
    speakers = {x['studentId'] for x in evidence['studentUtterances'] if x.get('stage') == 'class'} | {a['id'] for r in runs if r.get('questionType') == '自由抢答' for a in r['answers']}
    correct_ids = {a['id'] for a in class_answers if a.get('correct') is True}
    # A nested funnel has overlapping populations. Use mutually exclusive highest levels.
    participation = [len(attendees-triggered), len(triggered-speakers-correct_ids), len(speakers-correct_ids), len(correct_ids)] if attendees else [None]*4
    stacked = {'scales': {'x': {'stacked': True}, 'y': {'stacked': True, 'beginAtZero': True}}}
    quality = [rhythm, chart('参与层级（互斥人数）', 'doughnut', ['仅出勤', '仅触发互动', '主动发言未答对', '正确回答'], [('学生人数', participation)], note='按最高参与层级去重；不把重叠的累计人数作为占比。'), chart('随堂检测答题质量', 'bar', [f'第{i+1}题' for i in range(len(runs))], [('正确', [sum(a.get('correct') is True for a in r['answers']) for r in runs]), ('错误', [sum(a.get('correct') is False for a in r['answers']) for r in runs]), ('未答', [max(0, count-len({a['id'] for a in r['answers']})) if count else None for r in runs]), ('待评分', [sum(not isinstance(a.get('correct'), bool) for a in r['answers']) for r in runs])], stacked)]
    regions = list(dict.fromkeys(s.get('region') or f"第{s.get('group', '?')}组" for s in students))
    targets = [sid for r in runs for sid in r.get('targetStudentIds', [])]
    region_counts = Counter((roster[sid].get('region') or f"第{roster[sid].get('group', '?')}组") for sid in targets if sid in roster)
    coverage = chart('提问覆盖分组', 'bar', regions, [('被提问次数', [region_counts[r] for r in regions] if targets else [None]*len(regions))], note='按已记录的提问对象统计频次；未记录点名对象时保持为空。')
    avg = mean(list(region_counts.values()))
    coverage['datasets'][0]['backgroundColor'] = ['#e29a58' if avg and (region_counts[r] < avg*.7 or region_counts[r] > avg*1.3) else '#8170ce' for r in regions]
    levels = ['记忆', '理解', '应用', '分析', '评价', '创造']
    types = ['定向提问', '随机抽查', '自由抢答']
    bloom = Counter(r.get('bloomLevel') for r in runs)
    questions = [coverage, chart('布卢姆思维层级', 'pie', levels, [('问题数量', [bloom[l] for l in levels] if any(bloom[l] for l in levels) else [None]*6)], note='依据已记录的认知层级；未标注问题不参与统计。'), chart('提问类型与应答质量', 'bar', types, [(label, [sum(a.get('responseQuality', '正确' if a.get('correct') is True else '错误' if a.get('correct') is False else '未评分') == label for r in runs if r.get('questionType') == t for a in r['answers']) for t in types]) for label in ['正确', '部分正确', '错误', '未评分']], stacked)]
    causes = Counter(x.get('errorCause') for x in review if x.get('correct') is False and x.get('errorCause'))
    labels = sorted(causes, key=lambda k: -causes[k])
    total = sum(causes.values())
    pareto = chart('错题归因与累计占比', 'bar', labels, [('错误次数', [causes[k] for k in labels]), ('累计百分比', [percent(sum(causes[k] for k in labels[:i+1]), total) for i in range(len(labels))])], {'scales': {'y': {'beginAtZero': True}, 'percentage': {'position': 'right', 'min': 0, 'max': 100, 'grid': {'drawOnChartArea': False}}}}, '仅统计已有错因标签；未标注错因不进行自动归因。')
    pareto['datasets'][1].update(type='line', yAxisID='percentage')
    scatter = []
    for sid in roster:
        before = accuracy([x for x in preview if x['studentId'] == sid])
        after = accuracy([x for x in review if x['studentId'] == sid])
        duration = state.get('learningProgress', {}).get('review', {}).get(sid, {}).get('buddyMinutes')
        if before is not None and after is not None and duration is not None: scatter.append({'x': duration, 'y': round(after-before, 1), 'studentId': sid})
    after_charts = [chart('知识点闭环掌握度（%）', 'line', knowledge, [('课前预习', kp_scores(preview)), ('随堂检测', kp_scores(class_answers)), ('课后作业', kp_scores(review))], {'scales': {'y': {'min': 0, 'max': 100}}}), pareto, chart('AI伴学时长与成绩提升', 'scatter', [], [('学生', scatter)], {'scales': {'x': {'title': {'display': True, 'text': '伴学时长（分钟）'}}, 'y': {'title': {'display': True, 'text': '正确率提升（百分点）'}}}}, '同知识点不同题目的正确率差值；相关性不能证明伴学导致提升。')]
    profiles = state.get('abilityProfiles', {})
    dimensions = ['学业基础', '逻辑思维', '自主学习', '课堂参与', '提问品质']
    averages = [mean([p[i] for p in profiles.values() if len(p) > i]) for i in range(5)]
    histories = evidence['standardizedScoreHistory'] or evidence['lessonScoreHistory']
    weeks = list(dict.fromkeys(x.get('label', x.get('sectionId')) for rows in histories.values() for x in rows))
    history_values = lambda field: [mean([x.get(field) for rows in histories.values() for x in rows if x.get('label', x.get('sectionId')) == w]) for w in weeks]
    milestones = [x for x in state.get('growthMilestones', []) if allowed(x, state)]
    growth = [chart('综合能力对比', 'radar', dimensions, [('班级平均', averages)], note='能力评分来自已有量表记录；个人报告可选择学生查看。'), chart('长周期成绩演进', 'line', weeks, [('综合评分', history_values('score')), ('地理成绩', history_values('subjectScore'))]), chart('成长突破里程碑', 'bubble', [], [('成长事件', [{'x': x['week'], 'y': x['dimension'], 'r': x['importance'], 'label': x['label'], 'studentId': x['studentId']} for x in milestones])], {'scales': {'x': {'title': {'display': True, 'text': '周次'}}, 'y': {'min': 0, 'max': 4, 'title': {'display': True, 'text': '0基础 · 1思维 · 2自主 · 3参与 · 4提问'}}}})]
    competencies = [x for x in state.get('competencyEvidence', []) if allowed(x, state)] if state.get('curriculumGoals') else []
    projects = [x for x in state.get('projectProgress', []) if allowed(x, state)]
    standards = [chart('核心素养达成度', 'radar', [x['label'] for x in competencies], [('量表记录', [x.get('attainment') for x in competencies])], note='模拟教学目标或教师提供的目标量表，不能当作官方课标达标认证。'), chart('跨学科项目任务进度', 'bar', [x['label'] for x in projects], [('完成率（%）', [x.get('completion') for x in projects]), ('质量评分', [x.get('quality') for x in projects])]), chart('素养映射标签覆盖', 'polarArea', [x['label'] for x in competencies], [('覆盖频次', [x.get('frequency') for x in competencies])], note='掌握深度：' + '、'.join(f"{x['label']} {x.get('depth', '未记录')}" for x in competencies))]
    return {'charts': dict(zip(REPORTS, [pre, quality, questions, after_charts, growth, standards])), 'studentCount': count, 'source': 'simulation' if state.get('simulation') else 'observed', 'previewAccuracy': learning['preview']['accuracy'], 'reviewAccuracy': learning['review']['accuracy'], 'questionCount': len(runs), 'gradedClassAnswers': sum(isinstance(a.get('correct'), bool) for a in class_answers)}
