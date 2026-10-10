import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsxModuleUrl } from './jsx-loader.js'
const { Sources, ResourceTemplateCards } = await import(await jsxModuleUrl(new URL('../src/AIComponents.jsx', import.meta.url)))
const { ReportChart } = await import(await jsxModuleUrl(new URL('../src/ClassroomReport.jsx', import.meta.url)))
test('fixed resource results are read-only and offer one-click publishing', () => {
  const template = { pre_study: { objectives: '理解地貌', tasks: ['观察', '分析', '归纳'] }, class_discussion: { question: '如何形成？', analysis: '条件分析', goal: '因果解释' }, after_school: { summary: '总结过程', exercises: ['画图解释'] } }
  const html = renderToStaticMarkup(React.createElement(ResourceTemplateCards, { template, onPublish() {}, onRegenerate() {} }))
  assert.match(html, /理解地貌/)
  assert.match(html, /条件分析/)
  assert.match(html, /一键确认并发布/)
  assert.doesNotMatch(html, /textarea|<input/)
})
test('sources expose safe links and explicit search availability', () => {
  const html = renderToStaticMarkup(React.createElement(Sources, { refs: [{ name: '网页', url: 'https://example.org' }, { name: '资料', url: 'javascript:alert(1)' }], status: 'unconfigured' }))
  assert.match(html, /href="https:\/\/example.org"/)
  assert.doesNotMatch(html, /href="javascript/)
  assert.match(html, /联网搜索尚未配置/)
})
test('missing report evidence never renders invented sample charts', () => {
  const html = renderToStaticMarkup(React.createElement(ReportChart, { title: '质量', type: 'radar', labels: ['达成度'], values: [null] }))
  assert.match(html, /暂无足够的真实数据/)
  assert.doesNotMatch(html, /示例数据|canvas|75/)
})

test('partial classroom minutes from persisted simulations do not crash teacher pages', async () => {
  const { ClassroomMinutesPanel } = await import(await jsxModuleUrl(new URL('../src/AIComponents.jsx', import.meta.url)))
  for (const minutes of [{ summary: '模拟课堂纪要' }, { summary: '旧纪要', topics: null, questions: '旧字段', actions: undefined }]) {
    const html = renderToStaticMarkup(React.createElement(ClassroomMinutesPanel, { state: { phase: 'after', classroomMinutes: minutes }, capture: { replaceTranscript() {}, flush() {} } }))
    assert.match(html, /尚无记录/)
    assert.match(html, /实时课堂纪要/)
  }
})


test('recording minutes show the recognition skeleton and manual summary progress', async () => {
  const { ClassroomMinutesPanel } = await import(await jsxModuleUrl(new URL('../src/AIComponents.jsx', import.meta.url)))
  const capture = { active: true, summarize() {}, stop() {}, flush() {}, replaceTranscript() {} }
  const state = { phase: 'class', classroomTranscript: '真实转写', classroomMinutes: { summary: '中间结果' } }
  const html = renderToStaticMarkup(React.createElement(ClassroomMinutesPanel, { state, capture }))
  assert.match(html, /minutes-skeleton-tree/)
  assert.match(html, /正在识别说话人和讨论内容/)
  assert.match(html, /minutes-ellipsis/)
  assert.doesNotMatch(html, /中间结果|整理当前转写/)
  assert.match(html, /总结会议纪要/)
  const pending = renderToStaticMarkup(React.createElement(ClassroomMinutesPanel, { state, capture: { ...capture, summarizing: true } }))
  assert.match(pending, /disabled=""[^>]*>AI生成中/)
  const finished = renderToStaticMarkup(React.createElement(ClassroomMinutesPanel, { state: { ...state, phase: 'after' }, capture: { ...capture, active: false } }))
  assert.match(finished, /会议纪要总结/)
  assert.match(finished, /中间结果/)
  assert.doesNotMatch(finished, /minutes-skeleton-tree/)
})
