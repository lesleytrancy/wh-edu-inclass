import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateReportSection, analyzeClassroomAnswers } from '../src/ai.js'

test('single-report calls select one category without requesting the six-report endpoint', async () => {
  const original = globalThis.fetch
  try {
    let path, payload
    globalThis.fetch = async (url, options) => { path = url; payload = JSON.parse(options.body); return new Response(JSON.stringify({ sections: { growth: { summary: '当前报告' } } })) }
    await generateReportSection('growth', { sectionId: 'lesson' })
    assert.equal(path, '/api/agents/classroom/report-section')
    assert.equal(payload.tab, 'growth')
    assert.equal(payload.context.sectionId, 'lesson')
    assert.equal(payload.sections, undefined)
  } finally { globalThis.fetch = original }
})

test('discussion AI receives every typed member and leader minutes; timeout has no invented summary', async () => {
  const original = globalThis.fetch
  const run = { kind: 'discussion', question: '溶洞形成条件？', answers: [{ name: '1组', text: '组长纪要\n\n甲：观点甲\n\n乙：观点乙' }] }
  try {
    let payload
    globalThis.fetch = async (_, options) => { payload = JSON.parse(options.body); return new Response(JSON.stringify({ summary: 'AI总结' })) }
    assert.equal((await analyzeClassroomAnswers(run)).summary, 'AI总结')
    assert.equal(payload.kind, 'discussion')
    assert.match(payload.answers[0], /1组/)
    for (const text of ['组长纪要', '甲：观点甲', '乙：观点乙']) assert.match(payload.answers[0], new RegExp(text))
    globalThis.fetch = async () => new Response('{}', { status: 504 })
    await assert.rejects(analyzeClassroomAnswers(run), /超时/)
  } finally { globalThis.fetch = original }
})
