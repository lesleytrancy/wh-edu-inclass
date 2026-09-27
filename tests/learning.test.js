import assert from 'node:assert/strict'
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers, saveLearningFeedback, reportLearningFeedback, publishLearningContent, publishLearningPack } from '../src/learning.js'

const learningPack = createLearningPack()
const students = [{ id: '1' }, { id: '2' }, { id: '3' }]
let state = { learningPack, learningAnswers: simulateLearningAnswers(learningPack, students) }
assert.equal(learningPack.preview.exercises.length, 3)
assert.equal(learningPack.review.exercises.length, 3)
assert.match(learningPack.preview.task, /42–45/)
const published = publishLearningContent({ learningPack }, 'preview', learningPack.preview)
assert.equal(published.publishedLearningPack.preview.title, '课前预习')
assert.equal(published.learningNotifications[0].stage, 'preview')
assert.notEqual(published.publishedLearningPack.preview, learningPack.preview)
assert.equal(publishLearningContent(published, 'discussion', learningPack.preview), published)
const publishedPack = publishLearningPack({ learningPack })
assert.equal(publishedPack.publishedLearningPack.preview.title, '课前预习')
assert.equal(publishedPack.publishedLearningPack.review.title, '课后复习')
assert.match(publishedPack.learningNotifications[0].title, /课前预习与课后复习/)
assert.equal(state.learningAnswers.preview['3'], undefined)
assert.equal(state.learningAnswers.preview['1'], undefined)
assert.equal(submitLearningAnswers(state, 'preview', '3', { p1: '错误选项' }), state)
assert.equal(submitLearningAnswers(state, 'invalid', '3', {}), state)
state = submitLearningAnswers(state, 'preview', '3', { p1: '二氧化碳', p2: '裂隙', p3: '石灰岩' })
assert.equal(state.learningAnswers.preview['3'].p1.simulated, false)
assert.equal(state.learningAnswers.review['3'], undefined)
state = submitLearningAnswers(state, 'preview', '1', { p1: '氧气', p2: '裂隙', p3: '石灰岩' })
const reparsed = simulateLearningAnswers(learningPack, students, state.learningAnswers)
assert.equal(reparsed.preview['1'].p1.text, '氧气')
assert.equal(reparsed.preview['1'].p1.simulated, false)
assert.equal(reparsed.preview['3'].p1.text, '二氧化碳')
console.log('learning checks passed')

state = saveLearningFeedback(state, 'preview', '1', { summary: '3 题中 2 题正确', items: [
  { question: '气体', response: '氧气', correct: false, guidance: '雨水吸收二氧化碳后形成弱酸。' },
  { question: '渗透', response: '裂隙', correct: true, guidance: '回答正确。' },
  { question: '岩石', response: '石灰岩', correct: true, guidance: '回答正确。' },
] })
const feedback = state.learningFeedback.preview['1']
assert.equal(feedback.reportedAt, null)
assert.equal(feedback.items[0].correct, false)
assert.equal(feedback.items[1].correct, true)
assert.match(feedback.items[0].guidance, /弱酸/)
assert.match(feedback.summary, /3 题中 2 题正确/)
assert.equal(reportLearningFeedback(state, 'preview', '1', feedback.id - 1), state)
const reported = reportLearningFeedback(state, 'preview', '1', feedback.id)
assert.ok(reported.learningFeedback.preview['1'].reportedAt)
assert.equal(reportLearningFeedback(reported, 'preview', '1', feedback.id), reported)
const resubmitted = submitLearningAnswers(reported, 'preview', '1', { p1: '二氧化碳', p2: '裂隙', p3: '石灰岩' })
assert.equal(resubmitted.learningFeedback.preview['1'], undefined)
assert.equal(reportLearningFeedback(resubmitted, 'preview', '1', feedback.id), resubmitted)
const reviewed = submitLearningAnswers(resubmitted, 'review', '1', { r1: '溶蚀', r2: '溶蚀', r3: '条件—过程—结果' })
assert.equal(reviewed.learningFeedback.review['1'], undefined)
