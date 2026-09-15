import assert from 'node:assert/strict'
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers } from '../src/learning.js'

const learningPack = createLearningPack()
const students = [{ id: '1' }, { id: '2' }, { id: '3' }]
let state = { learningPack, learningAnswers: simulateLearningAnswers(learningPack, students) }
assert.equal(learningPack.preview.exercises.length, 2)
assert.equal(learningPack.review.exercises.length, 2)
assert.match(learningPack.preview.task, /42–45/)
assert.equal(state.learningAnswers.preview['3'], undefined)
assert.equal(state.learningAnswers.preview['1'].p1.simulated, true)
assert.equal(submitLearningAnswers(state, 'preview', '3', { p1: '错误选项' }), state)
assert.equal(submitLearningAnswers(state, 'invalid', '3', {}), state)
state = submitLearningAnswers(state, 'preview', '3', { p1: '二氧化碳', p2: '裂隙' })
assert.equal(state.learningAnswers.preview['3'].p1.simulated, false)
assert.equal(state.learningAnswers.review['3'], undefined)
state = submitLearningAnswers(state, 'preview', '1', { p1: '氧气', p2: '裂隙' })
const reparsed = simulateLearningAnswers(learningPack, students, state.learningAnswers)
assert.equal(reparsed.preview['1'].p1.text, '氧气')
assert.equal(reparsed.preview['1'].p1.simulated, false)
assert.equal(reparsed.preview['3'].p1.text, '二氧化碳')
console.log('learning checks passed')
