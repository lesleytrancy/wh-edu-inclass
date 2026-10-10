import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classroomRuns, learningStats, studentMetrics, stageReport, addReportNotification, reportNotifications } from '../src/reports.js'
import { updateResourceContent } from '../src/learning.js'
const student = { id: '1', name: '甲' }
test('missing student metrics use samples; cross-subject transfer remains unscored', () => {
  const report = studentMetrics({}, student)
  assert.equal(report.performance.length, 6)
  assert.equal(report.growth.length, 3)
  assert.equal(report.growth[2].value, '暂不展示')
  assert.ok([...report.performance, ...report.growth.slice(0, 2)].every(row => row.sample))
})
test('submitted records exclude simulations and unsubmitted exercises', () => {
  const state = { learningPack: { preview: { exercises: [{ id: 'a', answer: 'A' }, { id: 'b', answer: 'B' }, { id: 'c', answer: 'C' }] } }, learningAnswers: { preview: { '1': { a: { text: 'A' }, b: { text: 'B', simulated: true } } } } }
  assert.deepEqual(learningStats(state, 'preview', '1'), { total: 3, submitted: 1, graded: 1, correct: 1 })
  assert.equal(stageReport(state, [student], 'preview').accuracy, 100)
  assert.equal(studentMetrics(state, student).performance[0].sample, false)
  assert.equal(studentMetrics(state, student).performance[3].sample, true)
})
test('class participation counts current runs once and distinguishes zero from missing', () => {
  const run = { id: 'q', startedAt: 1, answers: [{ id: '1', text: '回答' }] }
  const state = { questionHistory: [run], questionRun: { ...run, answers: [] } }
  assert.equal(classroomRuns(state).length, 1)
  const metrics = studentMetrics(state, student).performance
  assert.equal(metrics[1].value, 0)
  assert.equal(metrics[1].sample, false)
  assert.equal(metrics[3].value, 0)
  assert.equal(metrics[3].sample, false)
})
test('growth uses cross-lesson standardized scores and student-specific agent activity', () => {
  const metrics = studentMetrics({ standardizedScoreHistory: { '1': [{ score: 60 }, { score: 71 }] }, studentUtterances: [{ studentId: '1' }, { studentId: '2' }] }, student)
  assert.equal(metrics.growth[0].value, 11)
  assert.equal(metrics.growth[1].value, 1)
})
test('report notifications deduplicate versions and resource editing resets saved confirmation', () => {
  const state = addReportNotification({}, 'pre', '课前报告已生成', 123)
  assert.equal(addReportNotification(state, 'pre', '课前报告已生成', 123), state)
  const saved = updateResourceContent({}, 'discussion', [{ question: '旧问题' }], true)
  assert.equal(saved.resourceConfirmations.discussion, true)
  const edited = updateResourceContent(saved, 'discussion', [{ question: '新问题' }])
  assert.equal(edited.resourceConfirmations.discussion, false)
})
test('subjective grades only count AI feedback matching the current response', () => {
  const state = { learningPack: { review: { exercises: [{ id: 'r', type: 'comprehensive', question: '解释成因' }] } }, learningAnswers: { review: { '1': { r: { text: '当前回答' } } } }, learningFeedback: { review: { '1': { items: [{ question: '解释成因', response: '旧回答', correct: true }] } } } }
  assert.equal(learningStats(state, 'review', '1').graded, 0)
  state.learningFeedback.review['1'].items[0].response = '当前回答'
  assert.equal(learningStats(state, 'review', '1').correct, 1)
})
test('report messages retain their lesson and filter other teachers', () => {
  const state = addReportNotification({ sectionId: 's1', teacherUsername: 't1' }, 'pre', '课前报告已生成', 1)
  assert.equal(state.reportNotifications[0].sectionId, 's1')
  assert.equal(state.reportNotifications[0].teacherUsername, 't1')
  assert.equal(reportNotifications(state).length, 1)
  assert.equal(reportNotifications({ ...state, teacherUsername: 't2' }).length, 0)
})

test('missing evidence is null instead of a demo score', () => {
  assert.ok(studentMetrics({}, student).performance.every(row => row.value === null))
})
test('lesson score history records only real scored responses and replaces the same lesson', async () => {
  const { recordLessonScores } = await import('../src/reports.js')
  const state = { sectionId: 'lesson1', lessonTitle: '第一课', learningPack: { preview: { exercises: [{ id: 'a', answer: 'A' }] } }, learningAnswers: { preview: { '1': { a: { text: 'A' } }, '2': { a: { text: 'A', simulated: true } } } } }
  const next = recordLessonScores(state, [student, { id: '2' }])
  assert.equal(next.lessonScoreHistory['1'][0].score, 100)
  assert.equal(next.lessonScoreHistory['2'], undefined)
  assert.equal(recordLessonScores(next, [student]), next)
  const updated = recordLessonScores({ ...next, learningAnswers: { preview: { '1': { a: { text: 'B' } } } } }, [student])
  assert.equal(updated.lessonScoreHistory['1'].length, 1)
  assert.equal(updated.lessonScoreHistory['1'][0].score, 0)
  const later = recordLessonScores({ ...next, sectionId: 'lesson2', learningAnswers: { preview: { '1': { a: { text: 'B' } } } } }, [student])
  assert.equal(later.lessonScoreHistory['1'].length, 2)
  assert.equal(studentMetrics(later, student).growth[0].value, -100)
})
