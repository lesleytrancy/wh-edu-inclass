import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from '../src/ai.js'
import { demoResult } from '../src/ai-demo.js'

const originalFetch = globalThis.fetch
const input = { stage: 'preview', role: 'student', content: { exercises: [{ id: '1', question: '成因', answer: 'A' }] }, responses: { '1': 'A' } }
const paths = ['/api/resources', '/api/agents/resources/regenerate', '/api/agents/classroom/snapshot-question', '/api/agents/chat', '/api/agents/learning/analyze', '/api/agents/teacher/insight', '/api/agents/classroom/analyze', '/api/agents/classroom/report']
test('all AI paths return karst presets on timeout', async () => {
  try {
    globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
    for (const path of paths) {
      const result = await request(path, { body: JSON.stringify(input) }, 5)
      assert.equal(result.fallback, true)
      assert.ok(JSON.stringify(result).length > 30, path)
      assert.doesNotMatch(JSON.stringify(result), /AI 生成超时，以下为/)
    }
    assert.equal(demoResult('/api/agents/resources/regenerate', { stage: 'discussion' }).fallback, true)
  } finally { globalThis.fetch = originalFetch }
})
test('real response wins and ordinary failures are not demo analyses', async () => {
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ summary: '真实结论' }))
    assert.deepEqual(await request('/api/agents/classroom/analyze', {}), { summary: '真实结论' })
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: '服务错误' }), { status: 503 })
    await assert.rejects(request('/api/agents/classroom/analyze', {}), /服务错误/)
    globalThis.fetch = async () => new Response('{}', { status: 504 })
    assert.equal((await request('/api/agents/classroom/analyze', {})).fallback, true)
  } finally { globalThis.fetch = originalFetch }
})
