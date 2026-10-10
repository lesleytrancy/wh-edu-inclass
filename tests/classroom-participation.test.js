import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classroomParticipation } from '../src/reports.js'

const students = ['a', 'b', 'c', 'd'].map(id => ({ id }))
const base = { phase: 'class', classStartedAt: 100 }

test('participation counts distinct current-class submissions and excludes empty, simulated and unknown students', () => {
  const run = { id: 'q', startedAt: 110, answers: [{ id: 'a', text: '回答' }, { id: 'b', text: '  ', active: true }, { id: 'c', text: '预设回答', simulated: true }, { id: 'other', text: '回答' }] }
  const state = { ...base, simulation: { id: 'test' }, questionHistory: [run, { id: 'old', startedAt: 90, answers: [{ id: 'd', text: '上节课回答' }] }], questionRun: run, studentUtterances: [{ studentId: 'a', stage: 'class', at: 120, text: '再次发言' }, { studentId: 'b', stage: 'class', at: 130, text: '课堂发言' }, { studentId: 'd', stage: 'preview', at: 120, text: '预习发言' }] }
  assert.deepEqual(classroomParticipation(state, students), { participated: 2, total: 4, rate: 50 })
  assert.deepEqual(classroomParticipation({ ...state, classEndedAt: 125, phase: 'after' }, students), { participated: 1, total: 4, rate: 25 })
})

test('discussion counts submitted individuals and voice leader without counting silent group members', () => {
  const run = { id: 'g', kind: 'discussion', startedAt: 110, members: { a: 'g1', b: 'g1', c: 'g1', d: 'g1' }, groups: [{ id: 'g1', leaderId: 'a' }], contributions: { b: { studentId: 'b', text: '我的观点' }, c: { studentId: 'c', text: '' } }, answers: [{ id: 'g1', voiceText: '', text: '乙：我的观点' }] }
  assert.equal(classroomParticipation({ ...base, questionRun: run }, students).rate, 25)
  run.answers[0].voiceText = '组长提交的纪要'
  assert.equal(classroomParticipation({ ...base, questionRun: run }, students).rate, 50)
})

test('new sessions reset participation and distinguish zero participation from unavailable statistics', () => {
  assert.deepEqual(classroomParticipation(base, students), { participated: 0, total: 4, rate: 0 })
  assert.equal(classroomParticipation({ ...base, phase: 'before' }, students).rate, null)
  assert.equal(classroomParticipation({}, students).rate, null)
  assert.equal(classroomParticipation(base, []).rate, null)
  assert.equal(classroomParticipation({ ...base, classStartedAt: 200, questionHistory: [{ id: 'old', startedAt: 110, answers: [{ id: 'a', text: '旧回答' }] }] }, students).rate, 0)
})
