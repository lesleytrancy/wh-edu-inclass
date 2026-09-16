import assert from 'node:assert/strict'
import { createDiscussion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion, formatDiscussionMinutes, submitDiscussionMinutes } from '../src/discussion.js'

const students = [{ id: '1', name: '组长甲' }, { id: '2', name: '组长乙' }, { id: '3', name: '组员' }]
let state = { questionRun: createDiscussion(students, '讨论问题', 100) }
assert.equal(state.questionRun.groups.length, 2)
assert.equal(joinDiscussion(state, 99, '1', 'group-1'), state)
assert.equal(joinDiscussion(state, 100, '1', 'invalid'), state)
state = joinDiscussion(state, 100, '1', 'group-1')
state = joinDiscussion(state, 100, '3', 'group-1')
assert.equal(setGroupAnswer(state, 100, '1', 'group-1', '提前回答', true), state)
state = startDiscussion(state, 100, 1000)
assert.equal(state.questionRun.endAt, 301000)
assert.equal(startDiscussion(state, 100), state)
assert.equal(setGroupAnswer(state, 100, '3', 'group-1', '组员不能发言', true), state)
assert.equal(setGroupAnswer(state, 100, '2', 'group-1', '其他组长不能代答', true), state)
state = setGroupAnswer(state, 100, '1', 'group-1', '小组回答', true)
state = setGroupAnswer(state, 100, '1', 'group-1', '更新的小组回答', false)
assert.equal(state.questionRun.answers.length, 1)
assert.equal(state.questionRun.answers[0].name, '1组 · 探索组')
assert.equal(summarizeDiscussion(state.questionRun).groups[0].answer, '更新的小组回答')
assert.equal(summarizeDiscussion(state.questionRun).groups[1].answer, '暂无回答')
state = { ...state, questionRun: { ...state.questionRun, status: 'analyzing' } }
assert.equal(setGroupAnswer(state, 100, '1', 'group-1', '迟到回答', true), state)
assert.equal(startDiscussion({ questionRun: createDiscussion([], '空班级', 1) }, 1).questionRun.status, 'selecting')
assert.equal(startDiscussion({ questionRun: createDiscussion(students, '  ', 1) }, 1).questionRun.status, 'selecting')
console.log('discussion checks passed')

const draft = formatDiscussionMinutes('讨论问题', 1, '雨水沿裂隙渗透。雨水沿裂隙渗透。石灰岩被溶解。')
assert.match(draft, /会议纪要/)
assert.equal(draft.match(/雨水沿裂隙渗透/g).length, 1)
assert.equal(formatDiscussionMinutes('讨论问题', 1, '  '), '')
let minutesState = { questionRun: createDiscussion(students, '讨论问题', 600) }
minutesState = joinDiscussion(minutesState, 600, '1', 'group-1')
minutesState = startDiscussion(minutesState, 600)
minutesState = setGroupAnswer(minutesState, 600, '1', 'group-1', '', true)
assert.equal(submitDiscussionMinutes(minutesState, 600, '1', 'group-1', draft), minutesState)
minutesState = setGroupAnswer(minutesState, 600, '1', 'group-1', '', false)
assert.equal(submitDiscussionMinutes(minutesState, 600, '3', 'group-1', draft), minutesState)
assert.equal(submitDiscussionMinutes(minutesState, 599, '1', 'group-1', draft), minutesState)
assert.equal(submitDiscussionMinutes(minutesState, 600, '1', 'group-1', '  '), minutesState)
const edited = draft + '\n补充：进一步观察岩石裂隙。'
minutesState = submitDiscussionMinutes(minutesState, 600, '1', 'group-1', edited)
assert.equal(minutesState.discussionMinutes['600:group-1'].text, edited)
assert.equal(minutesState.questionRun.answers[0].text, edited)
assert.equal(submitDiscussionMinutes(minutesState, 600, '1', 'group-1', edited), minutesState)
assert.equal(minutesState.discussionMinutes['600:group-1'].transcript, undefined)
