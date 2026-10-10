"""Individual growth evidence: observed submissions only, no demo fallback."""
from .ai_context import aggregate, student_context


def real_learning_state(context):
    def clean(value):
        if isinstance(value, list):
            return [clean(item) for item in value if not isinstance(item, dict) or not item.get('simulated')]
        if isinstance(value, dict):
            return {key: clean(item) for key, item in value.items()
                    if key != 'simulation' and (not isinstance(item, dict) or not item.get('simulated'))}
        return value
    result = clean(context)
    if context.get('simulation'):
        for key in ('abilityProfiles', 'learningProgress', 'studentExpressionScores', 'studentCrossSubjectAccuracy', 'lessonScoreHistory', 'standardizedScoreHistory'):
            result.pop(key, None)
    return result


def individual_growth_evidence(context):
    state = real_learning_state(context)
    aggregate_evidence = aggregate(state)
    result = {}
    for student in state.get('reportStudents', []):
        sid = student['id']
        personal = student_context(state, sid)
        personal.pop('simulation', None)
        personal['history'] = state.get('standardizedScoreHistory', {}).get(sid) or state.get('lessonScoreHistory', {}).get(sid, [])
        personal['discussions'] = []
        for run in aggregate_evidence['questionHistory']:
            if run.get('kind') != 'discussion':
                continue
            contribution = run.get('contributions', {}).get(sid)
            if contribution and contribution.get('text', '').strip():
                personal['discussions'].append({'question': run.get('question'), 'response': contribution['text']})
            group = next((g for g in run.get('groups', []) if g.get('leaderId') == sid), None)
            if group:
                for answer in run['answers']:
                    voice = answer.get('voiceText', answer.get('text', '') if not run.get('contributions') else '')
                    if answer['id'] == group['id'] and voice.strip():
                        personal['discussions'].append({'question': run.get('question'), 'response': voice})
        result[sid] = {'studentId': sid, 'name': student['name'], **personal}
    return result


def has_growth_evidence(personal):
    return any(personal['learning'].values()) or any(personal[key] for key in ('classAnswers', 'utterances', 'history', 'discussions'))
