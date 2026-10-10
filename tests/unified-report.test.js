import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsxModuleUrl } from './jsx-loader.js'

const { default: ClassroomReport } = await import(await jsxModuleUrl(new URL('../src/ClassroomReport.jsx', import.meta.url)))
const { default: AnalysisReports } = await import(await jsxModuleUrl(new URL('../src/AnalysisReports.jsx', import.meta.url)))
const report = {
  generatedAt: 2000, limitations: ['仅使用本节课堂记录'],
  sections: { after: { summary: '统一报告的课后诊断', evidence: ['课后真实作答'], chapters: Array.from({ length: 4 }, (_, i) => ({ analysis: `统一章节${i + 1}`, recommendations: [`改进建议${i + 1}`] })) } },
  analytics: { previewAccuracy: 60, reviewAccuracy: 80, questionCount: 3, gradedClassAnswers: 2, charts: { after: [{ title: '统一课后图表', type: 'bar', labels: ['正确率'], values: [80] }] } },
}
const source = { teacherUsername: 'teacher', sectionId: 'lesson', classStartedAt: 100, classEndedAt: 1000 }

test('end-of-class modal and after-report page render identical report contents', () => {
  const props = { state: { ...source, classroomReport: report }, report, students: [{ id: 'one', name: '甲' }], onGenerate() {}, onTab() {}, tab: 'after' }
  const modal = renderToStaticMarkup(React.createElement(ClassroomReport, props))
  const page = renderToStaticMarkup(React.createElement(AnalysisReports, props))
  // Navigation and surrounding layout differ, but the entire report body is shared.
  assert.equal(modal.slice(modal.indexOf('<section class="analysis-content">')), page.slice(page.indexOf('<section class="analysis-content">')))
  for (const html of [modal, page]) {
    assert.match(html, /统一报告的课后诊断/)
    assert.match(html, /统一章节4/)
    assert.match(html, /统一课后图表/)
    assert.match(html, /课后真实作答/)
    assert.match(html, /80/)
  }
  assert.doesNotMatch(modal, /report-sidebar/)
})

test('each report generates independently, and leaving or refreshing restores the demo', async () => {
  let state = { ...source, classroomReport: report }, cursor = 0, calls = 0
  const slots = [], effects = [], requests = []
  const demo = { state: { simulation: { id: 'demo' } }, report: { ...report, demo: true } }
  const hooks = {
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() } })
    },
    getDemoReports: async () => demo,
    generateReportSection(tab, context) { calls++; return new Promise((resolve, reject) => requests.push({ tab, context, resolve, reject })) },
  }
  globalThis.unifiedReportHooks = hooks
  let hookSource = await readFile(new URL('../src/useClassroomReport.js', import.meta.url), 'utf8')
  hookSource = hookSource.replace(/^import .* from 'react'\n/m, '').replace(/^import .* from '\.\/ai.js'\n/m, '').replace("'./reports.js'", JSON.stringify(new URL('../src/reports.js', import.meta.url).href))
  hookSource = 'const { useRef, useState, useEffect, generateReportSection, getDemoReports } = globalThis.unifiedReportHooks;\n' + hookSource
  const { useClassroomReport } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
  const render = () => { cursor = 0; const shared = useClassroomReport(state, [{ id: 'one', name: '甲' }]); effects.splice(0).forEach(effect => effect()); return shared }
  try {
    render(); await Promise.resolve()
    let shared = render()
    assert.equal(shared.reportFor('after'), demo.report, 'persisted old reports do not replace the demo')
    const after = shared.generate('after'), pre = shared.generate('pre')
    assert.equal(shared.generate('after'), after)
    assert.equal(calls, 2)
    assert.equal(requests[0].context.reportStudents[0].id, 'one')
    assert.equal(requests[0].context.simulation, undefined, 'demo evidence must not enter real requests')
    assert.equal(render().busyFor('after'), true)
    assert.equal(render().busyFor('pre'), true)
    assert.equal(render().busyFor('growth'), false)
    requests[0].resolve(report)
    await after
    assert.equal(render().reportFor('after'), report)
    assert.equal(render().reportFor('growth'), demo.report)
    assert.equal(render().busyFor('pre'), true)
    requests[1].resolve({ ...report, sections: { pre: { summary: '课前真实结果' } } })
    await pre
    assert.deepEqual(render().generatedTabs.sort(), ['after', 'pre'])
    assert.equal(state.classroomReport, report, 'generated reports are not persisted to classroom state')
    const failure = render().generate('after')
    requests[2].reject(new Error('服务暂不可用'))
    await failure
    assert.equal(render().reportFor('after'), report)
    assert.equal(render().errorFor('after'), '服务暂不可用')
    assert.equal(render().errorFor('pre'), '')
    const pending = render().generate('growth')
    render().reset()
    requests[3].resolve({ ...report, sections: { growth: { summary: '迟到的成长报告' } } })
    await pending
    assert.equal(render().reportFor('growth'), demo.report)
    assert.equal(render().reportFor('after'), demo.report)
    assert.deepEqual(render().generatedTabs, [])
    assert.equal(render().errorFor('after'), '')
    slots.forEach(slot => slot?.cleanup?.()); slots.splice(0)
    render(); await Promise.resolve()
    assert.equal(render().reportFor('after'), demo.report, 'a fresh page starts with demonstrations')
    const old = render().generate('after')
    state = { ...state, sectionId: 'other', classroomReport: null }
    render()
    requests[4].resolve(report)
    await old
    assert.equal(render().reportFor('after'), demo.report)
    assert.equal(render().busyFor('after'), false)
  } finally { slots.forEach(slot => slot?.cleanup?.()); delete globalThis.unifiedReportHooks }
})

test('demo notice is exact, and each page offers generation of only its current report', () => {
  const html = renderToStaticMarkup(React.createElement(AnalysisReports, { state: source, report: { ...report, demo: true }, students: [{ id: 'one', name: '甲' }], onGenerate() {}, onTab() {}, tab: 'after' }))
  assert.match(html, /当前为演示报告,真实报告正在生成/)
  assert.match(html, /生成当前报告/)
  assert.doesNotMatch(html, /生成六类|重新生成六类/)
})
