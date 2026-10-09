import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { matchingQuestions, composeQuestions } from '../src/question-bank.js'
import { submitLearningAnswers } from '../src/learning.js'
const bank = JSON.parse(readFileSync(new URL('../public/question-bank/geography.json', import.meta.url)))
test('Word bank preserves all answers, coefficients, explanations and original images', () => {
  assert.equal(bank.questions.length, 38)
  for (const q of bank.questions) {
    assert.ok(q.answer && q.explanation && q.difficultyCoefficient)
    if (q.type === 'single') { assert.equal(q.options.length, 4); assert.ok(q.options.includes(q.answer)) }
    for (const path of q.images) assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)))
  }
})
test('composition respects count, difficulty, type and requires images without duplicates', () => {
  const questions = composeQuestions(bank, { difficulty: 'medium', type: 'single' }, 5, 'review')
  assert.equal(questions.length, 5)
  assert.equal(new Set(questions.map(q => q.bankQuestionId)).size, 5)
  assert.ok(questions.every(q => q.images.length && q.difficulty === 'medium' && q.type === 'single'))
  assert.equal(matchingQuestions(bank, { type: 'fill' }).length, 0)
  assert.throws(() => composeQuestions(bank, { type: 'fill' }, 1, 'preview'), /共 0 道/)
})
test('students can submit comprehensive answers', () => {
  const exercise = bank.questions.find(q => q.type === 'comprehensive')
  const state = { publishedLearningPack: { preview: { exercises: [exercise] } } }
  assert.equal(submitLearningAnswers(state, 'preview', 'student', { [exercise.id]: '流水溶蚀作用' }).learningAnswers.preview.student[exercise.id].text, '流水溶蚀作用')
})

test('multiple selected types form a combined pool and no selection produces no questions', () => {
  const types = ['single', 'comprehensive']
  const available = matchingQuestions(bank, { types })
  assert.ok(available.some(question => question.type === 'single'))
  assert.ok(available.some(question => question.type === 'comprehensive'))
  const mixed = composeQuestions(bank, { types }, 3, 'preview', () => 0.5)
  assert.deepEqual(new Set(mixed.map(question => question.type)), new Set(types))
  const questions = composeQuestions(bank, { types }, available.length, 'preview')
  assert.deepEqual(new Set(questions.map(question => question.type)), new Set(types))
  assert.equal(matchingQuestions(bank, { types: [] }).length, 0)
  assert.throws(() => composeQuestions(bank, { types: [] }, 1, 'preview'), /共 0 道/)
})
