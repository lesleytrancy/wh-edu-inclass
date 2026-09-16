import assert from 'node:assert/strict'
import { setQuestionAnswer } from '../src/questions.js'

const student = { id: '08001', name: '李奕贤' }
let state = { questionRun: { id: 10, status: 'answering', answers: [] } }
assert.equal(setQuestionAnswer(state, 10, student, '', false), state)
state = setQuestionAnswer(state, 10, student, '', true)
state = setQuestionAnswer(state, 10, student, '实际语音转写', true)
assert.equal(state.questionRun.answers.length, 1)
assert.equal(state.questionRun.answers[0].text, '实际语音转写')
assert.equal(setQuestionAnswer(state, 9, student, '过期回答', true), state)
state = setQuestionAnswer(state, 10, student, '手动订正后的回答', false)
assert.equal(state.questionRun.answers[0].active, false)
assert.equal(setQuestionAnswer(state, 10, student, '手动订正后的回答', false), state)
for (const status of ['analyzing', 'result']) {
  const ended = { questionRun: { ...state.questionRun, status } }
  assert.equal(setQuestionAnswer(ended, 10, student, '延迟转写', true), ended)
}
const discussion = { questionRun: { ...state.questionRun, kind: 'discussion' } }
assert.equal(setQuestionAnswer(discussion, 10, student, '不能覆盖小组', true), discussion)
