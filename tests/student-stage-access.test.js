import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLearningPack, publishLearningPack, studentStageAvailable, studentDefaultStage, submitLearningAnswers } from '../src/learning.js'

test('ending a lesson locks preview and interaction while review and growth remain available', () => {
  const ended = { phase: 'after', learningPublishedAt: 100, studentActivitiesLocked: true, learningPack: createLearningPack() }
  for (const stage of ['preview', 'class']) assert.equal(studentStageAvailable(ended, stage), false)
  for (const stage of ['review', 'growth']) assert.equal(studentStageAvailable(ended, stage), true)
  assert.equal(studentDefaultStage(ended), 'review')
  assert.equal(studentStageAvailable(JSON.parse(JSON.stringify(ended)), 'preview'), false)
  const restarted = { ...ended, phase: 'class' }
  assert.equal(studentStageAvailable(restarted, 'preview'), false)
  assert.equal(studentStageAvailable(restarted, 'class'), true)
  assert.equal(studentDefaultStage(restarted), 'class')
  assert.equal(submitLearningAnswers(ended, 'preview', 'a', { p1: '二氧化碳', p2: '裂隙', p3: '化学溶蚀' }), ended)
})

test('sending again unlocks preview while classroom interaction waits for the teacher to start', () => {
  const ended = { phase: 'after', learningPublishedAt: 100, studentActivitiesLocked: true, learningPack: createLearningPack(), resourceConfirmations: { preview: true, discussion: true, review: true }, learningAnswers: { preview: { a: { p1: { text: '旧回答' } } } } }
  assert.equal(publishLearningPack({ ...ended, resourceConfirmations: {} }).studentActivitiesLocked, true)
  const sent = publishLearningPack(ended)
  assert.equal(sent.phase, 'before')
  assert.equal(sent.studentActivitiesLocked, false)
  assert.equal(studentStageAvailable(sent, 'preview'), true)
  assert.equal(studentStageAvailable(sent, 'class'), false)
  assert.equal(studentStageAvailable({ ...sent, phase: 'class' }, 'class'), true)
  assert.equal(studentDefaultStage(sent), 'preview')
  assert.deepEqual(sent.learningAnswers, { preview: {}, review: {} })
  assert.equal(studentStageAvailable(sent, 'review'), false)
  assert.equal(studentStageAvailable(sent, 'growth'), true)
})
