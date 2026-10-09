export const reportTabs = [
  ['pre', '课前报告'], ['quality', '课堂质量'], ['questions', '课堂提问'],
  ['after', '课后总结'], ['growth', '成长总览'], ['standards', '新课标落实'],
]
export const sampleNotice = '数据尚未获取，当前为示例数据'
export function classroomRuns(state) {
  return [...new Map([...(state.questionHistory || []), state.questionRun].filter(Boolean).map(run => [run.id, run])).values()]
}
export function learningStats(state, stage, studentId) {
  const content = state.publishedLearningPack?.[stage] || state.learningPack?.[stage]
  const records = state.learningAnswers?.[stage]?.[studentId] || {}
  const exercises = content?.exercises || []
  const submitted = exercises.filter(item => records[item.id]?.text?.trim() && !records[item.id].simulated)
  const feedback = state.learningFeedback?.[stage]?.[studentId]?.items || []
  const grades = submitted.flatMap(item => {
    if (!item.type || item.type === 'single') return [records[item.id].text === item.answer]
    const assessment = feedback.find(entry => entry.question === item.question && entry.response === records[item.id].text && typeof entry.correct === 'boolean')
    return assessment ? [assessment.correct] : []
  })
  return { total: exercises.length, submitted: submitted.length, correct: grades.filter(Boolean).length, graded: grades.length }
}
const metric = (label, description, value, unit, example) => ({ label, description, value: value ?? example, unit, sample: value == null })
export function studentMetrics(state, student) {
  const runs = classroomRuns(state).filter(run => run.startedAt)
  const questions = runs.filter(run => run.kind !== 'discussion')
  const answers = questions.flatMap(run => (run.answers || []).filter(answer => answer.id === student.id && answer.text?.trim()))
  const discussions = runs.filter(run => run.kind === 'discussion' && run.members?.[student.id])
  const utterances = (state.studentUtterances || []).filter(item => item.studentId === student.id)
  const learning = ['preview', 'review'].map(stage => learningStats(state, stage, student.id))
  const gradedAnswers = answers.filter(answer => typeof answer.correct === 'boolean')
  const graded = learning.reduce((n, item) => n + item.graded, gradedAnswers.length)
  const correct = learning.reduce((n, item) => n + item.correct, gradedAnswers.filter(item => item.correct).length)
  const groups = discussions.flatMap(run => (run.answers || []).filter(answer => answer.id === run.members[student.id] && Number.isFinite(answer.score)))
  const tasks = runs.length
  const completed = answers.length + discussions.filter(run => (run.answers || []).some(answer => answer.id === run.members[student.id] && answer.text?.trim())).length
  const history = state.standardizedScoreHistory?.[student.id] || []
  return {
    performance: [
      metric('KDA（答题正确率）', '练习、提问、小测的正确率；', graded ? Math.round(correct / graded * 100) : null, '%', 82),
      metric('参团率（课堂活跃度）', '提问、回应、讨论参与次数；', runs.length || utterances.length ? answers.length + discussions.length + utterances.filter(item => item.stage === 'class').length : null, '次', 12),
      metric('转化比（小组成绩）', '小组成绩', groups.length ? Math.round(groups.reduce((n, item) => n + item.score, 0) / groups.length) : null, '分', 86),
      metric('任务专注度', '课堂任务完成参与率', tasks ? Math.round(completed / tasks * 100) : null, '%', 90),
      metric('表达展示力', '回答能否清晰表达观点', state.studentExpressionScores?.[student.id] ?? null, '分', 85),
      metric('实践应用力', '跨学科题目回答正确率', state.studentCrossSubjectAccuracy?.[student.id] ?? null, '%', 78),
    ],
    growth: [
      metric('段位（学业进步）', '跨课节标准分提升幅度', history.length >= 2 ? history.at(-1).score - history[0].score : null, '分', 8),
      metric('自主学习力', '和学伴 Agent 的互动频次', utterances.length ? utterances.length : null, '次', 16),
      { label: '素养迁移度', description: '各学科（目前只有地理，暂时不展示数据）综合评分', value: '暂不展示', unit: '', sample: false },
    ],
  }
}
export function stageReport(state, students, stage) {
  const rows = students.map(student => ({ student, ...learningStats(state, stage, student.id) }))
  const graded = rows.reduce((sum, row) => sum + row.graded, 0)
  return { rows, available: rows.some(row => row.submitted), accuracy: graded ? Math.round(rows.reduce((sum, row) => sum + row.correct, 0) / graded * 100) : null }
}
export function reportNotifications(state) {
  return [...(state.reportNotifications || [])].filter(item => !item.teacherUsername || item.teacherUsername === state.teacherUsername).sort((a, b) => b.sentAt - a.sentAt)
}
export function addReportNotification(state, tab, title, version = Date.now()) {
  const id = `${state.sectionId || 'class'}:${tab}:${version}`
  if ((state.reportNotifications || []).some(item => item.id === id)) return state
  return { ...state, reportNotifications: [{ id, tab, title, sectionId: state.sectionId, teacherUsername: state.teacherUsername, sentAt: Date.now() }, ...(state.reportNotifications || [])].slice(0, 30) }
}
