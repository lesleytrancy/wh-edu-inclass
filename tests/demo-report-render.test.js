import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsxModuleUrl } from './jsx-loader.js'

const { default: AnalysisReports } = await import(await jsxModuleUrl(new URL('../src/AnalysisReports.jsx', import.meta.url)))

test('all six demo report pages render 24 distinct recommendations from their data', () => {
  const demo = JSON.parse(execFileSync('python3', ['-c', `
import json
from server.demo_reports import build_demo_reports
roster = [{'id': str(i), 'name': f'学生{i}', 'group': i % 8 + 1} for i in range(50)]
print(json.dumps(build_demo_reports({'reportStudents': roster}), ensure_ascii=False))
`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }))
  const advice = []
  for (const [tab, section] of Object.entries(demo.report.sections)) {
    const html = renderToStaticMarkup(React.createElement(AnalysisReports, {
      state: { lessonTitle: '地貌课堂' }, students: demo.state.reportStudents,
      report: demo.report, demoState: demo.state, tab, onTab() {}, onGenerate() {},
    }))
    const blocks = [...html.matchAll(/<div class="report-recommendations">(.*?)<\/div>/g)]
    assert.equal(blocks.length, 4, `${tab} must display advice in all four chapters`)
    section.chapters.forEach((chapter, i) => {
      assert.ok(chapter.recommendations.length > 0)
      for (const text of chapter.recommendations) {
        assert.ok(blocks[i][1].includes(text), `${tab} chapter ${i + 1} must render its own recommendation`)
        advice.push(text)
      }
    })
    assert.doesNotMatch(html, /结合任务证据分层指导，使用后续作答检验效果/)
  }
  assert.equal(new Set(advice).size, 24)
})
