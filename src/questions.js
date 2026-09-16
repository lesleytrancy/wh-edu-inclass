export function setQuestionAnswer(state, runId, student, text, active) {
  const run = state.questionRun
  if (run?.id !== runId || run.kind === 'discussion' || run.status !== 'answering') return state
  const previous = run.answers.find(answer => answer.id === student.id)
  if (previous?.text === text && previous.active === active) return state
  if (!previous && !text.trim() && !active) return state
  const answer = { id: student.id, name: student.name, text, active }
  return { ...state, updatedAt: Date.now(), questionRun: { ...run, answers: [...run.answers.filter(answer => answer.id !== student.id), answer] } }
}
