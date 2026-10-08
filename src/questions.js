export function setQuestionAnswer(state, runId, student, text, active) {
  const run = state.questionRun
  if (run?.id !== runId || run.kind === 'discussion' || run.status !== 'answering') return state
  const previous = run.answers.find(answer => answer.id === student.id)
  if (previous?.text === text && previous.active === active) return state
  if (!previous && !text.trim() && !active) return state
  const awarded = !previous && text.trim().length > 0
  const answer = { firstResponseAt: previous?.firstResponseAt || Date.now(), id: student.id, name: student.name, text, active, points: previous?.points || (awarded ? 1 : 0) }
  const studentPoints = { ...(state.studentPoints || {}) }
  if (awarded) studentPoints[student.id] = (studentPoints[student.id] || 0) + 1
  return { ...state, updatedAt: Date.now(), studentPoints, questionRun: { ...run, answers: [...run.answers.filter(answer => answer.id !== student.id), answer] } }
}
