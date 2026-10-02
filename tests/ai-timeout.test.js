import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AI_TIMEOUT_MS, generateLearningPack, request } from '../src/ai.js'
import { demoResult } from '../src/ai-demo.js'
import { publishLearningPack } from '../src/learning.js'
import { createDiscussion } from '../src/discussion.js'

const originalFetch = globalThis.fetch
const input = { stage: 'preview', role: 'student', content: { exercises: [{ id: '1', question: '成因', answer: 'A' }] }, responses: { '1': 'A' } }
const paths = ['/api/resources', '/api/agents/resources/regenerate', '/api/agents/classroom/snapshot-question', '/api/agents/chat', '/api/agents/learning/analyze', '/api/agents/teacher/insight', '/api/agents/classroom/analyze', '/api/agents/classroom/report']
test('learning content uses a 30 second generation budget', () => {
  assert.equal(AI_TIMEOUT_MS, 30000)
})
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

test('resource polling timeout yields a complete publishable karst lesson', async () => {
  try {
    globalThis.fetch = async path => path === '/api/resources'
      ? new Response(JSON.stringify({ jobId: 'pending' }), { status: 200 })
      : new Response('{}', { status: 504 })
    const pack = await generateLearningPack([], 'demo-classroom', 100)
    assert.equal(pack.fallback, true)
    assert.equal(pack.preview.exercises.length, 3)
    assert.equal(pack.review.exercises.length, 3)
    assert.match(pack.discussionQuestion, /石灰岩/)
    const state = publishLearningPack({ learningPack: { preview: pack.preview, review: pack.review }, discussionQuestion: pack.discussionQuestion, aiFallback: pack.fallback })
    assert.equal(state.publishedLearningPack.preview.task, pack.preview.task)
    assert.equal(state.publishedLearningPack.review.task, pack.review.task)
    assert.match(state.learningNotifications[0].title, /已发布/)
    assert.equal(state.publishedLearningFallback, true)
    assert.equal(createDiscussion([{ id: '1', name: '学生' }], state.discussionQuestion).question, pack.discussionQuestion)
  } finally { globalThis.fetch = originalFetch }
})
