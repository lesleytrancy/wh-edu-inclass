export const reportTabs = [
  ['pre', '课前报告'], ['quality', '课堂质量'], ['questions', '课堂提问'],
  ['after', '课后总结'], ['growth', '成长总览'], ['standards', '新课标落实'],
]
export const sampleNotice = '数据尚未获取，当前为示例数据'
export function classroomRuns(state) {
  return [...new Map([...(state.questionHistory || []), state.questionRun].filter(Boolean).map(run => [run.id, run])).values()]
}

export function classroomParticipation(state, students = []) {
  const roster = new Set(students.map(student => String(student.id)))
  const participants = new Set()
  const start = state.classStartedAt
  const inLesson = at => Number.isFinite(at) && at >= start && (!state.classEndedAt || at <= state.classEndedAt)
  const add = id => { if (id != null && roster.has(String(id))) participants.add(String(id)) }
  const submitted = record => record && !record.simulated && typeof record.text === 'string' && record.text.trim()
  if (!start || state.phase === 'before' || !roster.size) return { participated: 0, total: roster.size, rate: null }
  for (const run of classroomRuns(state)) {
    if (run.simulated || !inLesson(run.startedAt)) continue
    if (run.kind !== 'discussion') {
      for (const answer of run.answers || []) if (submitted(answer)) add(answer.id)
      continue
    }
    for (const contribution of Object.values(run.contributions || {})) {
      if (submitted(contribution)) add(contribution.studentId)
    }
    for (const answer of run.answers || []) {
      // A group submission establishes the leader's contribution, not every member's.
      const voiceText = answer.voiceText ?? (run.contributions ? '' : answer.text)
      if (!submitted({ ...answer, text: voiceText })) continue
      add(run.groups?.find(group => group.id === answer.id)?.leaderId)
    }
  }
  for (const utterance of state.studentUtterances || []) {
    if (utterance.stage === 'class' && submitted(utterance) && inLesson(utterance.at)) add(utterance.studentId)
  }
  return { participated: participants.size, total: roster.size, rate: Math.round(participants.size / roster.size * 100) }
}
export function learningStats(state, stage, studentId) {
  const content = state.publishedLearningPack?.[stage] || state.learningPack?.[stage]
  const records = state.learningAnswers?.[stage]?.[studentId] || {}
  const exercises = content?.exercises || []
  const submitted = exercises.filter(item => records[item.id]?.text?.trim() && (!records[item.id].simulated || state.simulation))
  const feedback = state.learningFeedback?.[stage]?.[studentId]?.items || []
  const grades = submitted.flatMap(item => {
    if (!item.type || item.type === 'single') return item.answer ? [records[item.id].text === item.answer] : []
    const assessment = feedback.find(entry => entry.question === item.question && entry.response === records[item.id].text && typeof entry.correct === 'boolean')
    return assessment ? [assessment.correct] : []
  })
  return { total: exercises.length, submitted: submitted.length, correct: grades.filter(Boolean).length, graded: grades.length }
}
const metric = (label, description, value, unit, example) => ({ label, description, value: value ?? null, unit, sample: value == null })
export function studentMetrics(state, student) {
  const runs = classroomRuns(state).filter(run => run.startedAt)
  const questions = runs.filter(run => run.kind !== 'discussion')
  const answers = questions.flatMap(run => (run.answers || []).filter(answer => answer.id === student.id && (!answer.simulated || state.simulation) && answer.text?.trim()))
  const discussions = runs.filter(run => run.kind === 'discussion' && run.members?.[student.id])
  const utterances = (state.studentUtterances || []).filter(item => item.studentId === student.id)
  const learning = ['preview', 'review'].map(stage => learningStats(state, stage, student.id))
  const gradedAnswers = answers.filter(answer => typeof answer.correct === 'boolean')
  const graded = learning.reduce((n, item) => n + item.graded, gradedAnswers.length)
  const correct = learning.reduce((n, item) => n + item.correct, gradedAnswers.filter(item => item.correct).length)
  const groups = discussions.flatMap(run => (run.answers || []).filter(answer => answer.id === run.members[student.id] && Number.isFinite(answer.score)))
  const tasks = runs.length
  const completed = answers.length + discussions.filter(run => (run.answers || []).some(answer => answer.id === run.members[student.id] && answer.text?.trim())).length
  const history = state.standardizedScoreHistory?.[student.id] || state.lessonScoreHistory?.[student.id] || []
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
      metric('段位（学业进步）', state.standardizedScoreHistory?.[student.id] ? '跨课节标准分提升幅度' : '跨课节已评分正确率变化（百分点）', history.length >= 2 ? history.at(-1).score - history[0].score : null, state.standardizedScoreHistory?.[student.id] ? '分' : '个百分点', 8),
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

export function classroomReportScope(state) {
  return JSON.stringify([state.teacherUsername, state.sectionId, state.classStartedAt, state.classEndedAt])
}

export function saveClassroomReport(state, report, source) {
  if (classroomReportScope(state) !== classroomReportScope(source)) return state
  return addReportNotification({ ...state, classroomReport: report }, 'after', '课后总结报告已生成', report.generatedAt)
}

// Each entry is a scored-answer accuracy, not an inferred ability or normative score.
export function recordLessonScores(state, students) {
  if (!state.sectionId) return state
  const history = { ...state.lessonScoreHistory }
  let changed = false
  for (const student of students) {
    const results = ['preview', 'review'].map(stage => learningStats(state, stage, student.id))
    const graded = results.reduce((n, result) => n + result.graded, 0)
    if (!graded) continue
    const score = Math.round(results.reduce((n, result) => n + result.correct, 0) / graded * 100)
    const previous = history[student.id] || []
    const entry = { sectionId: state.sectionId, label: state.lessonTitle || state.sectionId, score, graded }
    const existing = previous.find(x => x.sectionId === state.sectionId)
    if (existing?.score === score && existing?.graded === graded) continue
    changed = true
    history[student.id] = (existing ? previous.map(x => x.sectionId === state.sectionId ? entry : x) : [...previous, entry]).slice(-30)
  }
  return changed ? { ...state, lessonScoreHistory: history } : state
}
