"""Read-only demonstrations for the supplied roster; never install synthetic records."""
from collections import Counter

from .demo_dataset import generate_dataset
from .ai_context import aggregate
from .report_analytics import build_analytics, mean, percent, REPORTS


def metric(value, unit='%'):
    return '数据不足' if value is None else f'{value:g}{unit}'


def chart_values(chart, series=0):
    return '、'.join(f'{label}{metric(value)}' for label, value in zip(chart['labels'], chart['datasets'][series]['data']))


def lowest(chart, series=0):
    values = [(label, value) for label, value in zip(chart['labels'], chart['datasets'][series]['data']) if value is not None]
    return min(values, key=lambda item: item[1]) if values else ('暂无可评价项目', None)


def build_demo_reports(context):
    roster = context.get('reportStudents', [])
    state = generate_dataset(roster=roster)
    state['lessonTitle'] = context.get('lessonTitle') or state['lessonTitle']
    evidence = aggregate(state)
    analytics = build_analytics(state, evidence)
    charts = analytics['charts']
    count = len(roster)
    preview = evidence['learning']['preview']
    review = evidence['learning']['review']
    pre_rates = charts['pre'][0]['datasets'][0]['data']
    pre_weak, pre_score = lowest(charts['pre'][1])
    pre_focus, _ = lowest(charts['pre'][0])
    completion = {}
    for stage in ('preview', 'review'):
        exercises = state['publishedLearningPack'][stage]['exercises']
        records = evidence['learning'][stage]['records']
        submissions = Counter(row['studentId'] for row in records)
        complete = sum(submissions[s['id']] == len(exercises) for s in roster)
        completion[stage] = (complete, count - complete)
    runs = evidence['questionHistory']
    answers = [answer for run in runs for answer in run['answers']]
    answered = {answer['id'] for answer in answers}
    targeted = {sid for run in runs for sid in run['targetStudentIds']}
    quality_counts = Counter(answer.get('responseQuality') for answer in answers)
    class_accuracy = percent(sum(a['correct'] is True for a in answers), len(answers))
    unanswered = count * len(runs) - len(answers)
    region_chart = charts['questions'][0]
    region_counts = region_chart['datasets'][0]['data']
    regions = '、'.join(f'{label}{metric(value, "次")}' for label, value in zip(region_chart['labels'], region_counts))
    region_weak, _ = lowest(region_chart)
    level_chart = charts['questions'][1]
    levels = '、'.join(f'{label}{metric(value, "题")}' for label, value in zip(level_chart['labels'], level_chart['datasets'][0]['data']))
    errors = Counter(row['errorCause'] for row in review['records'] if row['correct'] is False and row.get('errorCause'))
    error_focus = errors.most_common(1)[0][0] if errors else '暂无已标注错因'
    error_text = '、'.join(f'{label}{n}次' for label, n in errors.most_common()) or '暂无已标注错因'
    after_weak, after_score = lowest(charts['after'][0], 2)
    change = (round(review['accuracy'] - preview['accuracy'], 1)
              if review['accuracy'] is not None and preview['accuracy'] is not None else None)
    histories = charts['growth'][1]['datasets'][0]['data'] or [None]
    growth_change = round(histories[-1] - histories[0], 1) if histories and histories[0] is not None and histories[-1] is not None else None
    ability_weak, ability_score = lowest(charts['growth'][0])
    ability_values = list(zip(charts['growth'][0]['labels'], charts['growth'][0]['datasets'][0]['data']))
    ability_best = max((row for row in ability_values if row[1] is not None), key=lambda row: row[1], default=('暂无可评价维度', None))
    milestones = Counter(row['label'] for row in state['growthMilestones'])
    milestone_text = '、'.join(f'{label}{n}人次' for label, n in milestones.items()) or '暂无成长事件记录'
    competency_weak, competency_score = lowest(charts['standards'][0])
    project_weak, project_score = lowest(charts['standards'][1])
    depths = state['competencyEvidence']
    depth_weak = min(depths, key=lambda row: row['depth']) if depths else None
    depth_label = depth_weak['label'] if depth_weak else '暂无可评价维度'
    preview_messages = [row for row in evidence['studentUtterances'] if row['stage'] == 'preview']
    buddy_minutes = mean([row['buddyMinutes'] for row in state['learningProgress']['review'].values()])
    participation = state['engagementObservations']
    details = {
        'pre': [
            (f'该班级在本堂课预习任务与小测验完成情况：共{count}人，已有{preview["submittedStudents"]}人提交小测验，{completion["preview"][0]}人完成全部题目，{completion["preview"][1]}人仍有题目待完成。视频平均完播率{metric(pre_rates[0])}，文档平均阅读率{metric(pre_rates[1])}。',
             f'优先关注{pre_focus}对应的任务，课前核对未完成学生名单；用一题入口诊断区分未完成任务与已完成但未理解的学生。'),
            (f'预习已评分题目正确率为{metric(preview["accuracy"])}。各知识点表现为{chart_values(charts["pre"][1]) or "数据不足"}；{pre_weak}正确率{metric(pre_score)}，是备课时应优先复核的内容。',
             f'围绕{pre_weak}安排图片辨识和形成条件判断，要求学生说明选项依据；根据诊断结果决定是否增加概念讲解时间。'),
            (f'课前学伴对话共{len(preview_messages)}条，关键词分布为' + '、'.join(f'{label}{value}条' for label, value in zip(charts['pre'][2]['labels'], charts['pre'][2]['datasets'][0]['data'])) + '。这些疑问提示需要核查学生对形成条件及作用过程的理解，提问频次本身不能证明概念掌握程度。',
             '把“溶蚀与堆积有什么区别”转为对照任务：分别填写物质变化、介质和形成条件，再让学生用溶洞与冲积扇举例说明。'),
            (f'预习中有{completion["preview"][1]}人尚未完成全部题目，知识点最低正确率为{metric(pre_score)}。备课需同时照顾任务完成与概念理解两类需求。',
             f'为未完成者安排补做入口题，为{pre_weak}答错者提供“条件—过程—地貌”因果链支架，为掌握较好者增加陌生地貌迁移题。'),
        ],
        'quality': [
            (f'课堂时长45分钟，共记录{len(state["activityHistory"])}个活动节点和{len(runs)}次提问；活动在资料观察、提问和讨论之间交替。现有节点未单独标注练习时段，需结合学生作答判断讲练安排。',
             '在每轮观察与讨论后插入两分钟独立作答，并记录练习起止时间；依据即时结果决定继续讲解还是进入下一任务。'),
            (f'全班{count}人出勤，{len(answered)}人有课堂回答。参与度观察指数从{participation[0]["participation"]}到{participation[-1]["participation"]}；该指数反映记录的参与表现，不能直接解释为注意力。',
             '对发言较少的学生先安排同伴复述，再邀请其说明一项观察依据；用个人提交与发言记录复核每位学生的参与情况。'),
            (f'随堂共收到{len(answers)}条回答，已评分正确率为{metric(class_accuracy)}；回答质量标签中正确{quality_counts["正确"]}条、部分正确{quality_counts["部分正确"]}条、错误{quality_counts["错误"]}条，另有{unanswered}个学生题次未回答。部分正确标签与二元正确率分别统计。',
             '让部分正确者补全形成过程的关键环节，对错误回答给出反例辨析；未回答者先完成简短选择题，再说明理由。'),
            (f'课堂已覆盖{len(answered)}名回答学生，随堂正确率为{metric(class_accuracy)}；课后正确率为{metric(review["accuracy"])}。这些指标可用于检查理解与巩固，但不能仅凭班级均值判断每名学生达成目标。',
             '课末用“识别地貌—解释条件—迁移应用”三项退出题检查目标达成，下一课优先反馈尚未达成的环节。'),
        ],
        'questions': [
            (f'{len(runs)}次提问共记录{len(targeted)}名点名对象，占全班{metric(percent(len(targeted), count))}；各区域被提问次数为{regions or "数据不足"}。有回答的学生共{len(answered)}人，回答覆盖与点名覆盖需分别查看。',
             f'下一轮优先从{region_weak}及尚未被点名的学生中选择对象，建立轮换名单；保留自由回答机会并记录实际点名对象。'),
            (f'认知层级分布为{levels}。题目标签覆盖六类层级，但能否形成高阶思考还需检查题干是否要求比较、论证或方案设计。',
             '把地貌识记题逐步延伸为成因比较、证据评价和观察方案设计，要求高阶任务提交推理过程，避免只给结论。'),
            (f'学生应答中正确{quality_counts["正确"]}条、部分正确{quality_counts["部分正确"]}条、错误{quality_counts["错误"]}条。正确回答包含形成条件与作用过程，错误回答中可见将溶洞解释为泥沙堆积、将流水侵蚀解释为风力作用等概念混淆。' if answers else '尚无学生应答，无法判断思维表现。',
             '追问“哪项证据支持这一成因”和“条件改变后会怎样”，让学生修正概念混淆，并按条件、过程、结果三个要素补充解释。'),
            (f'当前点名覆盖{len(targeted)}人，而应答覆盖{len(answered)}人；共有{unanswered}个学生题次未回答。优化提问需同时关注参与机会、等待时间及回答质量。',
             '先给30秒独立思考，再进行同伴交流和随机邀请；对首次回答困难的学生提供句式支架，随后以无支架迁移题复查。'),
        ],
        'after': [
            (f'课后共有{review["submittedStudents"]}人提交作业，{completion["review"][0]}人完成全部题目，{completion["review"][1]}人仍有待完成题目；已评分{review["graded"]}题，正确率{metric(review["accuracy"])}。',
             '按未提交、部分完成、已完成待订正分别跟进；先核实缺交原因，再设置补交时点，并对订正题重新评分。'),
            (f'班级已评分正确率由课前{metric(preview["accuracy"])}变为课后{metric(review["accuracy"])}，差值{metric(change, "个百分点")}；课后各知识点为{chart_values(charts["after"][0], 2) or "数据不足"}。不同阶段题目与提交范围存在差异，差值不等同于同题增分。',
             f'对{after_weak}安排一道等难度平行题和一道情境迁移题，检查能否独立解释，并保留逐人前后作答供复核。'),
            (f'已有错因标签的错误分布为{error_text}。其中{error_focus}出现最多；错因统计只覆盖已标注错误，需要结合原题和作答确认诊断。',
             f'优先复核{error_focus}的典型作答：概念混淆用对照例题，计算失误重做过程，审题不清标注条件，逻辑缺失补全因果链；订正后再用同类题验证。'),
            (f'课后学伴平均交流时长为{metric(buddy_minutes, "分钟")}，伴学时长与正确率变化图包含{len(charts["after"][2]["datasets"][0]["data"])}名可配对学生。交流时长与学习变化的关系不能直接解释为因果。',
             '让学伴围绕个人错题依次追问错误原因、形成条件和修正依据；教师检查学生是否能独立重答，再决定是否继续干预。'),
        ],
        'growth': [
            (f'共{count}名学生有六周成绩记录；班级平均综合评分从{metric(histories[0], "分")}变为{metric(histories[-1], "分")}，变化{metric(growth_change, "分")}。班级趋势不能代替个人趋势，也不能据此推断跨学科迁移能力。',
             '逐人查看六周曲线，对持续停滞或波动学生复核对应任务；设定下一阶段的具体知识点目标，每周用等难度任务跟踪。'),
            (f'自主学习画像均值为{metric(charts["growth"][0]["datasets"][0]["data"][2], "分")}，课前提问参与率{metric(pre_rates[3])}，完整预习测验完成率{metric(pre_rates[2])}。主动交流和按时完成是不同学习行为，需要结合查看。',
             '用“阅读—提问—作答—自查”清单安排每次预习，要求学生记录一个待解问题和一次自主订正；每周反馈完成习惯。'),
            (f'综合画像中{ability_best[0]}均值最高，为{metric(ability_best[1], "分")}；{ability_weak}相对较低，为{metric(ability_score, "分")}。这些记录用于比较维度表现，仍需具体任务验证优势和需求。',
             f'围绕{ability_weak}设计专项任务，并让学生利用{ability_best[0]}方面的优势完成地貌解释或观察展示；收集作品后再调整个人目标。'),
            (f'阶段性成长事件为{milestone_text}。主动提问和成因解释达标分别体现参与行为与任务表现，评语应指向具体事件及后续目标。',
             '为每位学生选择一项有记录的突破，按“完成了什么—依据是什么—下一步做什么”写评语，并在下一次同类任务中复核。'),
        ],
        'standards': [
            (f'本课目标对应的素养维度记录为{chart_values(charts["standards"][0])}；{competency_weak}相对较低，为{metric(competency_score)}。当前依据为教学目标记录，未提供正式课标原文，不能作正式达标认定。',
             f'围绕{competency_weak}增加“观察事实—分析过程—说明结论”任务，并对照教师采用的目标量表逐项记录证据。'),
            (f'项目各阶段完成率为{chart_values(charts["standards"][1])}；{project_weak}完成率最低，为{metric(project_score)}。对应质量评分为{chart_values(charts["standards"][1], 1).replace("%", "分")}，需同时检查进度与成果质量。',
             f'为{project_weak}提供成果模板与检查清单，让小组把地理观察、测量数据和图文表达整合为展示作品，再开展同伴反馈。'),
            (f'各素养维度的证据频次与解释深度分别为' + '、'.join(f'{row["label"]}{row["frequency"]}次、深度{row["depth"]}' for row in depths) + f'；{depth_label}解释深度相对较低。证据频次不等同于能力达成。',
             f'针对{depth_label}要求小组提出可检验的问题、说明取样与观察方法，并用证据支持结论；按过程记录与作品质量反馈探究表现。'),
            (f'后续改进应优先衔接{competency_weak}维度与{project_weak}阶段，同时补充正式课标和学校培养要求，建立目标、任务与评价证据之间的对应关系。',
             '下一单元安排校园或周边地貌观察任务，明确观察指标、合作分工和成果标准；依据课标原文及学校方案修订量表，用作品和过程记录检查改进效果。'),
        ],
    }
    sections = {}
    for key, (title, headings) in REPORTS.items():
        chapters = [{'title': heading, 'analysis': analysis, 'recommendations': [recommendation]}
                    for heading, (analysis, recommendation) in zip(headings, details[key])]
        if not count:
            for chapter in chapters:
                chapter['analysis'] = '当前班级尚无学生名单与可评价的学生记录，无法判断本项学情。'
                chapter['recommendations'] = ['补充学生名单及对应任务记录后，' + chapter['recommendations'][0]]
        sections[key] = {
            'summary': chapters[0]['analysis'] + chapters[-1]['analysis'],
            'evidence': [chapter['analysis'] for chapter in chapters[:3]],
            'chapters': chapters,
            'keywords': [],
        }
    return {'state': state, 'report': {'demo': True, 'sections': sections, 'analytics': analytics, 'limitations': ['本报告全部学生表现与评分均为模拟数据，不代表真实学生情况。']}}
