import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { realLearningState, saveStudentGrowthReports } from '../src/student-growth.js'
import { studentStageAvailable } from '../src/learning.js'
import { jsxModuleUrl } from './jsx-loader.js'
const { StudentReport } = await import(await jsxModuleUrl(new URL('../src/AnalysisReports.jsx', import.meta.url)))

test('growth is always available and real personal reports discard synthetic records', () => {
  for (const phase of ['before', 'class', 'after']) assert.equal(studentStageAvailable(phase, 'growth'), true)
  const source = { simulation: { id: 'demo' }, abilityProfiles: { a: [99, 99, 99, 99, 99] }, lessonScoreHistory: { a: [{ score: 99 }] }, studentUtterances: [{ studentId: 'a', text: '示例', simulated: true }, { studentId: 'a', text: '真实发言' }], learningAnswers: { preview: { a: { fake: { text: '示例', simulated: true }, real: { text: '实际回答' } } } } }
  const clean = realLearningState(source)
  assert.equal(clean.simulation, undefined)
  assert.equal(clean.abilityProfiles, undefined)
  assert.equal(clean.lessonScoreHistory, undefined)
  assert.equal(clean.studentUtterances.length, 1)
  assert.deepEqual(Object.keys(clean.learningAnswers.preview.a), ['real'])
  const html = renderToStaticMarkup(React.createElement(StudentReport, { state: source, student: { id: 'a', name: '甲' } }))
  assert.doesNotMatch(html, /模拟测试数据|个人成长趋势|个人与班级综合能力对比/)
  assert.match(html, /AI 成长分析/)
  assert.match(html, /数据不足/)
})

test('end-class AI results are saved for the same session only and rendered for the individual', () => {
  const state = { teacherUsername: 'teacher', sectionId: 'lesson', classStartedAt: 100, classEndedAt: 200 }
  const result = { generatedAt: 300, reports: { a: { sectionId: 'lesson', dataSource: 'observed', generatedAt: 300, conclusion: '甲的真实分析', nextSteps: ['补全形成条件'], evidence: ['实际回答'] } } }
  const saved = saveStudentGrowthReports(state, state, result)
  assert.equal(saved.studentGrowthReportStatus.status, 'ready')
  for (const changed of [{ sectionId: 'other' }, { classStartedAt: 400 }, { classEndedAt: 500 }]) {
    const current = { ...state, ...changed }
    assert.equal(saveStudentGrowthReports(current, state, result), current)
  }
  const html = renderToStaticMarkup(React.createElement(StudentReport, { state: saved, student: { id: 'a', name: '甲' } }))
  assert.match(html, /甲的真实分析/)
  assert.match(html, /补全形成条件/)
  const other = renderToStaticMarkup(React.createElement(StudentReport, { state: saved, student: { id: 'b', name: '乙' } }))
  assert.doesNotMatch(other, /甲的真实分析/)
  assert.match(renderToStaticMarkup(React.createElement(StudentReport, { state: { ...saved, studentGrowthReportStatus: { status: 'generating' } }, student: { id: 'a', name: '甲' } })), /正在根据真实学习记录更新/)
})

test('growth AI failures surface an error instead of a simulated fallback', async () => {
  const { generateStudentGrowthReports } = await import('../src/ai.js')
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('{}', { status: 504 })
    await assert.rejects(generateStudentGrowthReports({ reportStudents: [] }), /超时/)
  } finally { globalThis.fetch = original }
})

test('ending class preserves the last answers and automatically refreshes real individual analysis', async () => {
  const { readFile } = await import('node:fs/promises')
  const { recordLessonScores } = await import('../src/reports.js')
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const handlers = main.slice(main.indexOf('  const refreshStudentGrowth ='), main.indexOf('  const send ='))
  let state = { phase: 'class', sectionId: 'lesson', classStartedAt: 100, questionHistory: [], questionRun: { id: 'last', startedAt: 110, question: '解释地貌', answers: [{ id: 'a', text: '流水侵蚀' }, { id: 'b', text: '模拟回答', simulated: true }] } }
  let requested, resolveReport, panel
  const updateState = change => { state = change(state) }
  const end = Function('state', 'setPanel', 'broadcast', 'classStudents', 'updateState', 'recordLessonScores', 'realLearningState', 'generateStudentGrowthReports', 'saveStudentGrowthReports', handlers + '\nreturn endClass;')(
    state, value => { panel = value }, next => { state = next }, [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }], updateState, recordLessonScores, realLearningState,
    context => { requested = context; return new Promise(resolve => { resolveReport = resolve }) }, saveStudentGrowthReports,
  )
  const completion = end()
  assert.equal(panel, 'report')
  assert.equal(state.phase, 'after')
  assert.equal(state.questionRun, null)
  assert.equal(state.studentGrowthReportStatus.status, 'generating')
  assert.equal(requested.questionHistory[0].answers.length, 1)
  assert.equal(requested.questionHistory[0].answers[0].text, '流水侵蚀')
  resolveReport({ generatedAt: 300, reports: { a: { conclusion: '真实成长分析', dataSource: 'observed' } } })
  await completion
  assert.equal(state.studentGrowthReports.a.conclusion, '真实成长分析')
  assert.equal(state.studentGrowthReportStatus.status, 'ready')
})
