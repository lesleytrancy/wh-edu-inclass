import React, { useEffect, useId, useRef, useState } from 'react'
import { FileText, Mic, CheckCheck, MessageSquare, ListChecks, BookOpen, ChevronDown } from 'lucide-react'
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
  const [collapsed, setCollapsed] = useState(false)
  const bodyId = useId()
  const minutes = state.classroomMinutes
  const before = state.phase === 'before'
  const ended = state.phase === 'after'
  const recording = state.phase === 'class' && (capture.active || capture.pending)
  const busy = capture.generating || capture.summarizing
  const hasTranscript = Boolean(state.classroomTranscript?.trim())
  return <section className={`classroom-minutes${before ? ' minutes-before' : ended ? ' minutes-ended' : ''}${collapsed ? ' minutes-collapsed' : ''}`} aria-label="实时课堂纪要">
    <header><div className="minutes-heading"><span className="minutes-heading-icon"><FileText size={18} aria-hidden="true" /></span><div><h1>实时课堂纪要</h1><span className={`minutes-status${recording ? ' is-recording' : ended ? ' is-ended' : ''}`} role="status"><i aria-hidden="true" />{capture.pending ? '等待麦克风授权' : recording ? '正在录音与转写' : before ? '待开始' : ended ? '课堂已结束' : '录音已暂停'}</span></div></div><div className="minutes-header-actions">{state.phase === 'class' && <button className="ghost minutes-record-toggle" disabled={capture.pending} onClick={capture.active ? () => { capture.stop(); capture.flush() } : capture.start}>{capture.pending ? '授权中…' : capture.active ? '暂停录音' : '开启录音'}</button>}<button type="button" className="minutes-collapse-toggle" aria-label={collapsed ? '展开实时课堂纪要' : '折叠实时课堂纪要'} aria-expanded={!collapsed} aria-controls={bodyId} title={collapsed ? '展开纪要' : '折叠纪要'} onClick={() => setCollapsed(value => !value)}><ChevronDown size={16} aria-hidden="true" /></button></div></header>
    <div id={bodyId} className="minutes-body" hidden={collapsed}>
    {(capture.error || capture.minutesError) && <p className="minutes-error" role="status">{capture.error || capture.minutesError}</p>}
    {recording ? <div className="minutes-recording" role="status" aria-label="正在识别说话人和讨论内容">
      <div className="minutes-skeleton-tree" aria-hidden="true"><i /><i /><i /></div>
      <div className="minutes-recognition"><strong>正在识别说话人和讨论内容<span className="minutes-ellipsis" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></strong><div className="minutes-skeleton-lines" aria-hidden="true"><i /><i /></div></div>
    </div> : minutes ? <div className="minutes-summary"><div className="minutes-summary-intro"><h4><CheckCheck size={16} aria-hidden="true" />会议纪要总结</h4><p>{minutes.summary || '暂无课堂总结'}</p></div>{[['topics', '教学主题', BookOpen], ['questions', '课堂问题', MessageSquare], ['actions', '后续行动', ListChecks]].map(([key, title, SectionIcon]) => <div className={`minutes-summary-section minutes-section-${key}`} key={key}><strong><SectionIcon size={15} aria-hidden="true" />{title}<span>{Array.isArray(minutes[key]) ? minutes[key].length : 0}</span></strong>{Array.isArray(minutes[key]) && minutes[key].length ? <ul>{minutes[key].map((text, i) => <li key={i}>{text}</li>)}</ul> : <p className="minutes-no-items">尚无记录</p>}</div>)}</div> : <div className="minutes-empty" role="status"><span className="minutes-empty-icon">{ended ? <FileText size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}</span><strong>{busy ? '正在整理课堂内容' : before ? '让课堂重点有迹可循' : ended ? hasTranscript ? '课堂记录已就绪' : '待补充课堂内容' : '等待开启课堂记录'}</strong><p>{busy ? 'AI 正在提炼教学主题、课堂问题与后续行动。' : before ? '开始上课后开启录音，将课堂讨论整理为清晰的纪要。' : ended ? hasTranscript ? '点击下方按钮，整理本堂课的教学重点与后续行动。' : '暂无转写，请补充内容后总结会议纪要。' : '开启录音后自动转写，也可补充文字整理纪要。'}</p>{before && <div className="minutes-flow"><span>录音转写</span><span aria-hidden="true">→</span><span>提炼要点</span><span aria-hidden="true">→</span><span>课堂总结</span></div>}</div>}
    {!before && <div className="minutes-tools"><details className="minutes-transcript"><summary>转写原文<span>{hasTranscript ? `${state.classroomTranscript.length} 字` : '暂无内容'}</span></summary><p>{state.classroomTranscript || '暂无转写'}</p></details>
      {!capture.active && !capture.pending && <details className="minutes-edit" open={!minutes || undefined}><summary>补充或修正转写</summary><label><span className="minutes-input-label">课堂内容</span><textarea value={state.classroomTranscript || ''} placeholder="补充课堂讨论、关键问题或需要跟进的事项…" onChange={event => capture.replaceTranscript(event.target.value)} /></label></details>}
      <div className="minutes-footer"><button className="primary minutes-summarize" disabled={busy || !hasTranscript} onClick={capture.summarize}>{busy ? 'AI生成中...' : '总结会议纪要'}</button><small>{busy ? '正在整理，请稍候' : minutes ? '补充内容后可重新总结' : '根据转写内容生成总结'}</small></div>
    </div>}
    </div>
  </section>
}
