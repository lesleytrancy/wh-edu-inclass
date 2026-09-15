export const defaultDiscussionQuestion = '结合示意图，讨论溶洞与钟乳石形成的先后关系，并说明溶蚀与沉积的区别。'

export function createDiscussion(students, question, id = Date.now()) {
  return {
    id, kind: 'discussion', source: 'resource', question, status: 'selecting', answers: [], members: {},
    groups: students.slice(0, 2).map((student, index) => ({ id: `group-${index + 1}`, number: index + 1, name: ['探索组', '求知组'][index], leaderId: student.id, leaderName: student.name })),
  }
}

export function joinDiscussion(state, runId, studentId, groupId) {
  const run = state.questionRun
  if (run?.id !== runId || run.kind !== 'discussion' || !['selecting', 'answering'].includes(run.status) || !run.groups.some(group => group.id === groupId)) return state
  return { ...state, updatedAt: Date.now(), questionRun: { ...run, members: { ...run.members, [studentId]: groupId } } }
}

export function startDiscussion(state, runId, now = Date.now()) {
  const run = state.questionRun
  if (run?.id !== runId || run.kind !== 'discussion' || run.status !== 'selecting' || !run.question.trim() || !run.groups.length) return state
  return { ...state, updatedAt: now, discussion: run.question.trim(), questionRun: { ...run, question: run.question.trim(), status: 'answering', startedAt: now, endAt: now + 300000 } }
}

export function setGroupAnswer(state, runId, studentId, groupId, text, active) {
  const run = state.questionRun
  const group = run?.groups?.find(group => group.id === groupId)
  if (run?.id !== runId || run.kind !== 'discussion' || run.status !== 'answering' || group?.leaderId !== studentId || run.members[studentId] !== groupId) return state
  const answer = { id: group.id, name: `${group.number}组 · ${group.name}`, leaderName: group.leaderName, text, active }
  return { ...state, updatedAt: Date.now(), questionRun: { ...run, answers: [...run.answers.filter(answer => answer.id !== groupId), answer] } }
}

export function summarizeDiscussion(run) {
  const answered = run.groups.filter(group => run.answers.some(answer => answer.id === group.id && answer.text.trim()))
  return {
    title: `已收集 ${answered.length} / ${run.groups.length} 个小组的回答`,
    text: answered.length ? '各组观点已整理如下，请结合讨论题对比证据、补充遗漏，并共同形成课堂结论。' : '尚未收到有效回答，建议再次组织讨论或邀请组长补充。',
    groups: run.groups.map(group => ({ ...group, answer: run.answers.find(answer => answer.id === group.id)?.text.trim() || '暂无回答' })),
  }
}
