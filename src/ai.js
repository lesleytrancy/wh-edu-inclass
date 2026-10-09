import { demoResult } from './ai-demo.js'
const API_BASE = import.meta.env?.VITE_AI_API_BASE || ''
export const AI_TIMEOUT_MS = 30000

export async function request(path, options, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal })
    if (response.status === 504 || response.status === 408) {
      const fallback = demoResult(path, typeof options?.body === 'string' ? JSON.parse(options.body) : {})
      if (fallback) return fallback
      throw new Error('AI 生成超时')
    }
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `AI 服务请求失败（${response.status}）`)
    return await response.json()
  } catch (error) {
    if (controller.signal.aborted) {
      const fallback = demoResult(path, typeof options?.body === 'string' ? JSON.parse(options.body) : {})
      if (fallback) return fallback
      throw new Error('AI 生成超时')
    }
    throw error
  } finally { clearTimeout(timer) }
}

export async function generateLearningPack(files, classroomId = 'demo-classroom', timeoutMs = 120000) {
  const body = new FormData()
  body.append('classroom_id', classroomId)
  files.forEach(file => body.append('files', file, file.name))
  const started = Date.now()
  const uploaded = await request('/api/resources', { method: 'POST', body }, timeoutMs)
  if (uploaded.fallback) return uploaded
  while (Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, Math.min(1000, timeoutMs - (Date.now() - started))))
    const remaining = timeoutMs - (Date.now() - started)
    if (remaining <= 0) break
    let job
    try { job = await request(`/api/jobs/${uploaded.jobId}`, undefined, remaining) }
    catch (error) { if (error.message.includes('超时')) break; throw error }
    if (job.status === 'completed') return job.result
    if (job.status === 'failed') {
      if (/timeout|timed out|超时/i.test(job.error || '')) break
      throw new Error(job.error || '资料解析失败')
    }
  }
  return demoResult('/api/resources')
}

export function askAgent({ classroomId = 'demo-classroom', message, role, studentId, stage }) {
  return request('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, message, role, studentId, stage }),
  })
}

export function generateSnapshotQuestion({ imageData, materialName, page, classroomId = 'demo-classroom' }) {
  return request('/api/agents/classroom/snapshot-question', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, imageData, materialName, page }),
  })
}

export function analyzeLearningAnswers({ stage, studentId, content, responses, classroomId = 'demo-classroom' }) {
  return request('/api/agents/learning/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, stage, studentId, content, responses }),
  })
}

export function generateTeacherInsight(context) {
  return request('/api/agents/teacher/insight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) })
}
export function generateClassroomReport(context) {
  return request('/api/agents/classroom/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) }, 120000)
}
export function regenerateContent(stage, content, materialIds) {
  return request('/api/agents/resources/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, content, materialIds }) }, 120000)
}

export function analyzeClassroomAnswers(run) {
  return request('/api/agents/classroom/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classroomId: 'demo-classroom', question: run.question, answers: run.answers.filter(answer => answer.text?.trim()).map(answer => answer.text) }) })
}

export function resetDemoClassroom() {
  return request('/api/classroom/reset-demo', { method: 'POST' }, 10000)
}
