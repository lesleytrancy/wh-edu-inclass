"""Observed classroom evidence, shared by reports and question answering."""
from .report_analytics import allowed

def aggregate(context: dict) -> dict:
    pack = context.get('publishedLearningPack') or context.get('learningPack') or {}
    stages = {}
    for stage in ('preview', 'review'):
        exercises = {str(x.get('id')): x for x in pack.get(stage, {}).get('exercises', [])}
        records = []
        for student, answers in context.get('learningAnswers', {}).get(stage, {}).items():
            feedback = context.get('learningFeedback', {}).get(stage, {}).get(student, {}).get('items', [])
            for exercise_id, answer in answers.items():
                if not allowed(answer, context) or not str(answer.get('text', '')).strip():
                    continue
                exercise = exercises.get(str(exercise_id))
                if not exercise:
                    continue
                correct = None
                if exercise.get('type', 'single') == 'single' and exercise.get('answer'):
                    correct = answer['text'] == exercise['answer']
                else:
                    grade = next((x for x in feedback if x.get('question') == exercise.get('question') and x.get('response') == answer['text'] and isinstance(x.get('correct'), bool)), {})
                    correct = grade.get('correct')
                records.append({'studentId': student, 'exerciseId': exercise_id, 'knowledgePoint': exercise.get('knowledgePoint'), 'errorCause': answer.get('errorCause'), 'simulated': bool(answer.get('simulated')), 'question': exercise.get('question'), 'response': answer['text'], 'correct': correct, 'submittedAt': answer.get('submittedAt')})
        graded = [x for x in records if x['correct'] is not None]
        stages[stage] = {'records': records, 'submittedStudents': len({x['studentId'] for x in records}), 'graded': len(graded), 'accuracy': round(sum(x['correct'] for x in graded) / len(graded) * 100, 1) if graded else None}
    runs = {x['id']: x for x in [*context.get('questionHistory', []), context.get('questionRun')] if isinstance(x, dict) and x.get('id')}
    real_runs = [{**run, 'answers': [answer for answer in run.get('answers', []) if allowed(answer, context) and str(answer.get('text', '')).strip()]} for run in runs.values()]
    return {'simulation': context.get('simulation'), 'reportStudents': context.get('reportStudents', []), 'learningProgress': context.get('learningProgress', {}), 'abilityProfiles': context.get('abilityProfiles', {}), 'growthMilestones': context.get('growthMilestones', []), 'projectProgress': context.get('projectProgress', []), 'competencyEvidence': context.get('competencyEvidence', []), 'engagementObservations': context.get('engagementObservations', []), 'attendance': context.get('attendance', []), 'learning': stages, 'questionHistory': real_runs,
            'studentPoints': context.get('studentPoints', {}),
            'studentUtterances': [x for x in context.get('studentUtterances', []) if allowed(x, context)],
            'discussionMinutes': context.get('discussionMinutes', {}),
            'classroomMinutes': context.get('classroomMinutes'),
            'classroomTranscript': context.get('classroomTranscript', '')[-60000:],
            'activityHistory': context.get('activityHistory', []),
            'classStartedAt': context.get('classStartedAt'), 'classEndedAt': context.get('classEndedAt'),
            'standardizedScoreHistory': context.get('standardizedScoreHistory', {}),
            'lessonScoreHistory': context.get('lessonScoreHistory', {}),
            'materials': [{'name': x.get('name')} for x in context.get('materials', [])],
            'learningObjectives': {stage: {key: pack.get(stage, {}).get(key) for key in ('title', 'objectives', 'summary', 'tasks')} for stage in ('preview', 'review')},
            'curriculumGoals': context.get('curriculumGoals', ''),
            'trainingRequirements': context.get('trainingRequirements', '')}


def student_context(context: dict, student_id: str) -> dict:
    evidence = aggregate(context)
    return {'simulation': context.get('simulation'), 'learning': {stage: [x for x in data['records'] if x['studentId'] == student_id] for stage, data in evidence['learning'].items()},
            'classAnswers': [{'question': run.get('question'), 'response': answer.get('text'), 'correct': answer.get('correct')} for run in evidence['questionHistory'] if run.get('kind') != 'discussion' for answer in run.get('answers', []) if answer.get('id') == student_id],
            'utterances': [x for x in evidence['studentUtterances'] if x.get('studentId') == student_id]}


def compact_evidence(evidence: dict) -> dict:
    """Deduplicate repeated classroom text without discarding student-level evidence."""
    result = dict(evidence)
    result['learning'] = {}
    for stage, data in evidence['learning'].items():
        by_question = {}
        for record in data['records']:
            key = record['exerciseId']
            question = by_question.setdefault(key, {'question': record['question'], 'knowledgePoint': record['knowledgePoint'], 'responses': {}})
            signature = (record['response'], record['correct'], record.get('errorCause'))
            group = question['responses'].setdefault(signature, {'response': record['response'], 'correct': record['correct'], 'errorCause': record.get('errorCause'), 'studentIds': []})
            group['studentIds'].append(record['studentId'])
        result['learning'][stage] = {**{k: v for k, v in data.items() if k != 'records'}, 'questions': [{**q, 'responses': list(q['responses'].values())} for q in by_question.values()]}
    result['questionHistory'] = []
    for run in evidence['questionHistory']:
        groups = {}
        for answer in run['answers']:
            key = (answer['text'], answer.get('correct'), answer.get('responseQuality'))
            group = groups.setdefault(key, {'text': answer['text'], 'correct': answer.get('correct'), 'responseQuality': answer.get('responseQuality'), 'studentIds': [], 'responseDelaysSeconds': []})
            group['studentIds'].append(answer['id'])
            if answer.get('firstResponseAt') and run.get('startedAt'):
                group['responseDelaysSeconds'].append(round((answer['firstResponseAt']-run['startedAt'])/1000, 1))
        result['questionHistory'].append({**{k: v for k, v in run.items() if k != 'answers'}, 'groupedResponses': list(groups.values())})
    return result
