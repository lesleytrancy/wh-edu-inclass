import React, { useEffect, useRef, useState } from 'react'
import { useVoiceCapture } from './useVoiceCapture.js'
import { generateClassroomMinutes } from './ai.js'

export function Sources({ refs = [], status }) {
  return <div className="ai-sources">{refs.length > 0 && <small>依据：{refs.map((ref, i) => <React.Fragment key={`${ref.url || ref.resourceId || ref.name}:${i}`}>{i > 0 && ' · '}{/^https?:\/\//.test(ref.url || '') ? <a href={ref.url} target="_blank" rel="noreferrer">{ref.name}</a> : ref.name}</React.Fragment>)}</small>}{status === 'no_results' && <small>本次未检索到可引用的联网来源。</small>}{status === 'unconfigured' && <small>联网搜索尚未配置，本次结合已有资料回答。</small>}{status === 'unavailable' && <small>联网搜索暂不可用，本次结合已有资料回答。</small>}</div>
}

export function ResourceTemplateCards({ template, onPublish, published, onRegenerate }) {
  return <div className="resource-template"><header><h2>课堂资源生成结果</h2><button className="ghost" onClick={onRegenerate}>重新生成</button></header><article className="diagnostic-card"><h3>课前学习</h3><p>{template.pre_study.objectives}</p><ol>{template.pre_study.tasks.map((task, i) => <li key={i}>{task}</li>)}</ol></article><article className="diagnostic-card"><h3>课堂讨论</h3><p>{template.class_discussion.question}</p><p><strong>解析：</strong>{template.class_discussion.analysis}</p><p><strong>目标：</strong>{template.class_discussion.goal}</p></article><article className="diagnostic-card"><h3>课后巩固</h3><p>{template.after_school.summary}</p><ol>{template.after_school.exercises.map((task, i) => <li key={i}>{task}</li>)}</ol></article><button className="primary" disabled={published} onClick={onPublish}>{published ? '已确认并发布' : '一键确认并发布'}</button></div>
}

export function useClassroomRecording(state, updateState, onSummary) {
  const transcript = useRef(state.classroomTranscript || '')
  const voiceBase = useRef('')
  const sent = useRef('')
  const session = useRef(state.classStartedAt)
  const request = useRef(null)
  const latest = useRef(state)
  const summaryCallback = useRef(onSummary)
  latest.current = state
  summaryCallback.current = onSummary
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const manualRequest = useRef(false)
  const voice = useVoiceCapture(text => {
    transcript.current = voiceBase.current + text
    updateState(value => value.classStartedAt === session.current ? { ...value, classroomTranscript: transcript.current } : value)
  })
  const flush = async ({ force = false } = {}) => {
    if (request.current || !transcript.current.trim() || (!force && transcript.current === sent.current) || !session.current) return
    const text = transcript.current, token = session.current
    sent.current = text
    setGenerating(true)
    const pending = (async () => {
      try {
        const minutes = await generateClassroomMinutes(String(token), text.slice(-60000))
        if (session.current !== token || latest.current.classStartedAt !== token) return
        updateState(value => value.classStartedAt === token ? { ...value, classroomMinutes: minutes } : value)
        setError('')
        return minutes
      } catch (cause) {
        if (session.current === token) { sent.current = ''; setError(cause.message) }
      }
    })()
    request.current = pending
    try { return await pending }
    finally { if (request.current === pending) { request.current = null; setGenerating(false) } }
  }
  const summarize = async () => {
    if (manualRequest.current || !transcript.current.trim()) return
    const token = session.current
    manualRequest.current = true
    setSummarizing(true)
    try {
      const pending = request.current
      const result = await pending
      if (session.current !== token || latest.current.classStartedAt !== token) return
      const minutes = pending && transcript.current === sent.current ? result : await flush({ force: true })
      if (minutes && session.current === token && latest.current.classStartedAt === token) summaryCallback.current?.(minutes)
    } finally { manualRequest.current = false; setSummarizing(false) }
  }
  useEffect(() => {
    if (session.current !== state.classStartedAt) {
      session.current = state.classStartedAt
      transcript.current = state.classroomTranscript || ''
      sent.current = ''
      request.current = null
      setGenerating(false)
      setError('')
    }
    voiceBase.current = transcript.current
    if (state.phase === 'class') {
      voice.start()
      const timer = setInterval(flush, 15000)
      return () => { clearInterval(timer); voice.stop() }
    }
  }, [state.phase, state.classStartedAt])
  // Retry the final flush if the last periodic request was still running.
  useEffect(() => {
    if (state.phase !== 'after') return
    flush()
    const timer = setInterval(flush, 3000)
    return () => clearInterval(timer)
  }, [state.phase, state.classStartedAt])
  const resume = () => { voiceBase.current = transcript.current; voice.start() }
  const replaceTranscript = text => { transcript.current = text; updateState(value => value.classStartedAt === session.current ? { ...value, classroomTranscript: text } : value) }
  return { ...voice, start: resume, minutesError: error, generating, summarizing, flush, summarize, replaceTranscript }
}

export function ClassroomMinutesPanel({ state, capture }) {
  const minutes = state.classroomMinutes
  const recording = state.phase === 'class' && (capture.active || capture.pending)
  return <section className="classroom-minutes">
    <header><h3>实时课堂纪要</h3>{state.phase === 'class' && <button className="ghost" disabled={capture.pending} onClick={capture.active ? () => { capture.stop(); capture.flush() } : capture.start}>{capture.pending ? '等待麦克风授权…' : capture.active ? '暂停录音' : '开启录音'}</button>}</header>
    <small>{recording ? '正在录音与转写' : state.phase === 'after' ? '课堂已结束' : '录音已暂停'}</small>
    {(capture.error || capture.minutesError) && <p role="status">{capture.error || capture.minutesError}</p>}
    {recording ? <div className="minutes-recording" role="status" aria-label="正在识别说话人和讨论内容">
      <div className="minutes-skeleton-tree" aria-hidden="true"><i /><i /><i /></div>
      <div className="minutes-recognition"><strong>正在识别说话人和讨论内容<span className="minutes-ellipsis" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></strong><div className="minutes-skeleton-lines" aria-hidden="true"><i /><i /></div></div>
    </div> : minutes ? <div className="minutes-summary"><h4>会议纪要总结</h4><p>{minutes.summary}</p>{[['topics', '教学主题'], ['questions', '课堂问题'], ['actions', '后续行动']].map(([key, title]) => <div key={key}><strong>{title}</strong>{Array.isArray(minutes[key]) && minutes[key].length ? <ul>{minutes[key].map((text, i) => <li key={i}>{text}</li>)}</ul> : <p>尚无记录</p>}</div>)}</div> : <p role="status">{capture.generating ? 'AI生成中...' : state.phase === 'after' ? '暂无转写，请补充内容后总结会议纪要。' : '等待真实转写记录。'}</p>}
    <details><summary>转写原文</summary><p>{state.classroomTranscript || '暂无转写'}</p></details>
    {!capture.active && !capture.pending && <label>补充或修正转写<textarea value={state.classroomTranscript || ''} onChange={event => capture.replaceTranscript(event.target.value)} /></label>}
    <button className="ghost minutes-summarize" disabled={capture.summarizing || !state.classroomTranscript?.trim()} onClick={capture.summarize}>{capture.summarizing ? 'AI生成中...' : '总结会议纪要'}</button>
    {capture.summarizing && <small role="status">AI生成中...</small>}
  </section>
}
