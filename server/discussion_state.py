"""Merge concurrent member submissions without losing another member's text."""


def merge_discussion_run(current, incoming):
    ranks = {'selecting': 0, 'answering': 1, 'analyzing': 2, 'result': 3}
    if ranks.get(incoming.get('status'), 0) < ranks.get(current.get('status'), 0):
        return current
    members = {**current.get('members', {}), **incoming.get('members', {})}
    contributions = dict(current.get('contributions', {}))
    for sid, entry in incoming.get('contributions', {}).items():
        if members.get(sid) != entry.get('groupId'):
            continue
        if entry.get('updatedAt', 0) >= contributions.get(sid, {}).get('updatedAt', 0):
            contributions[sid] = entry
    answers = {item['id']: item for item in current.get('answers', [])}
    for answer in incoming.get('answers', []):
        old = answers.get(answer['id'], {})
        if answer.get('voiceUpdatedAt', 0) >= old.get('voiceUpdatedAt', 0):
            answers[answer['id']] = answer
    for group in incoming.get('groups', []):
        answer = answers.get(group['id'])
        entries = [entry for entry in contributions.values() if entry.get('groupId') == group['id'] and entry.get('text', '').strip()]
        if not answer and not entries:
            continue
        answer = answer or {'id': group['id'], 'name': f"{group['number']}组 · {group['name']}", 'leaderName': group.get('leaderName'), 'active': False}
        voice = answer.get('voiceText', answer.get('text', ''))
        answers[group['id']] = {**answer, 'voiceText': voice, 'text': '\n\n'.join(([voice.strip()] if voice.strip() else []) + [f"{entry['name']}：{entry['text'].strip()}" for entry in entries])}
    return {**incoming, 'members': members, 'contributions': contributions, 'answers': list(answers.values())}
