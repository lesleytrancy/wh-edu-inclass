import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

test('class recording preserves resumed transcripts, final flush and session isolation', async () => {
  const slots = [], pendingEffects = []
  let cursor = 0, starts = 0, stops = 0, onTranscript, resolveMinutes, requests = [], summaries = []
  let state = { phase: 'class', classStartedAt: 100 }
  const same = (a, b) => a?.length === b?.length && a.every((x, i) => x === b[i])
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(effect, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const old = slots[i]; pendingEffects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: effect() } }) } },
    useVoiceCapture(callback) { onTranscript = callback; return { start() { starts++ }, stop() { stops++ } } },
    generateClassroomMinutes(sessionId, transcript) { requests.push({ sessionId, transcript }); return new Promise(resolve => { resolveMinutes = resolve }) },
  }
  globalThis.recordingTestHooks = hooks
  const source = await readFile(new URL('../src/AIComponents.jsx', import.meta.url), 'utf8')
  const hook = source.slice(source.indexOf('export function useClassroomRecording'), source.indexOf('export function ClassroomMinutesPanel'))
  const { useClassroomRecording } = await import(`data:text/javascript;base64,${Buffer.from('const { useRef, useState, useEffect, useVoiceCapture, generateClassroomMinutes } = globalThis.recordingTestHooks;\n' + hook).toString('base64')}`)
  const update = callback => { state = callback(state) }
  const render = () => { cursor = 0; const capture = useClassroomRecording(state, update, minutes => summaries.push(minutes)); pendingEffects.splice(0).forEach(fn => fn()); return capture }
  try {
    let capture = render()
    assert.equal(starts, 1)
    onTranscript('第一段')
    capture.stop(); capture.start()
    onTranscript('第二段')
    assert.equal(state.classroomTranscript, '第一段第二段')
    const first = capture.flush()
    assert.equal(requests[0].transcript, '第一段第二段')
    onTranscript('第二段补充')
    state = { ...state, phase: 'after' }
    capture = render()
    assert.ok(stops >= 2)
    resolveMinutes({ summary: '旧版本', topics: [], questions: [], actions: [] })
    await first
    const final = capture.flush()
    assert.equal(requests[1].transcript, '第一段第二段补充')
    // Switching lessons while the final summary is pending must reject its result.
    state = { phase: 'class', classStartedAt: 200 }
    capture = render()
    resolveMinutes({ summary: '旧课堂纪要', topics: [], questions: [], actions: [] })
    await final
    assert.equal(state.classroomMinutes, undefined)
    onTranscript('新课堂')
    assert.equal(state.classroomTranscript, '新课堂')
    const periodic = capture.flush()
    const manual = capture.summarize()
    capture = render()
    assert.equal(capture.summarizing, true)
    resolveMinutes({ summary: '新课堂总结', topics: ['主题'], questions: [], actions: [] })
    await periodic
    await manual
    assert.equal(summaries.length, 1)
    assert.equal(summaries[0].summary, '新课堂总结')
    capture = render()
    assert.equal(capture.summarizing, false)
    const count = requests.length
    const repeated = capture.summarize()
    await Promise.resolve()
    assert.equal(requests.length, count + 1)
    resolveMinutes({ summary: '重新总结', topics: [], questions: [], actions: [] })
    await repeated
    assert.equal(summaries.length, 2)
    // A late result cannot post to the Agent after publication resets the session.
    onTranscript('新课堂补充')
    const stale = capture.summarize()
    await Promise.resolve()
    state = { phase: 'before', classStartedAt: null, classroomTranscript: '' }
    capture = render()
    resolveMinutes({ summary: '失效总结', topics: [], questions: [], actions: [] })
    await stale
    assert.equal(summaries.length, 2)
    assert.equal(state.classroomMinutes, undefined)
  } finally { slots.forEach(slot => slot?.cleanup?.()); delete globalThis.recordingTestHooks }
})
