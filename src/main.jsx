import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, GraduationCap, Monitor, Bot, FolderOpen, Upload, Sparkles, Users, Pencil, CircleHelp, MessagesSquare, Send, ArrowLeft, ArrowRight, Check, Plus, X, Download, Mic, Camera, Square, ChevronDown, Bell } from 'lucide-react'
import './styles.css'
import { seedStudents, migrateStudents } from './students.js'
import { createDiscussion, defaultDiscussionQuestion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion, submitDiscussionMinutes, formatDiscussionMinutes } from './discussion.js'
import { setQuestionAnswer } from './questions.js'
import { useVoiceCapture } from './useVoiceCapture.js'
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers, reportLearningFeedback, publishLearningPack } from './learning.js'
import { saveMaterials, useMaterial, getMaterialPage, turnMaterialPage } from './materials.js'

const geographyTools = Object.entries(import.meta.glob('../tools/*.html', { query: '?raw', import: 'default' })).map(([path, load]) => ({ name: path.split('/').pop().replace(/\.html$/i, ''), load })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

const initialMessages = [
  { from: 'agent', text: '你好，我是课堂助教。请先上传教师课件，系统将模拟生成课前预习、课后复习及习题。', time: '09:28' },
]

const slideQuestions = [
  '雨水是怎样一步步塑造喀斯特地貌的？',
  '二氧化碳在石灰岩溶蚀过程中起了什么作用？',
  '钟乳石为什么会从洞顶向下生长？',
]

const icons = {
  book: BookOpen, cap: GraduationCap, screen: Monitor, robot: Bot,
  folder: FolderOpen, upload: Upload, spark: Sparkles, users: Users,
  pen: Pencil, question: CircleHelp, chat: MessagesSquare, send: Send,
  back: ArrowLeft, next: ArrowRight, check: Check, plus: Plus, close: X,
  download: Download, mic: Mic, camera: Camera, stop: Square, down: ChevronDown, bell: Bell,
}

function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

function Icon({ name }) {
  const Component = icons[name]
  return <span className="icon" aria-hidden="true"><Component size="1em" strokeWidth={1.8} /></span>
}

function useCountdown(endAt) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
    tick(); const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [endAt])
  return seconds
}

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <div className="brand-mark"><Icon name="spark" /></div>
    <div><strong>武侯课教</strong><small>SMART CLASSROOM</small></div>
  </div>
}

function Console({ onEnter }) {
  return <main className="console-page">
    <div className="ambient one" /><div className="ambient two" />
    <section className="console-wrap">
      <Brand />
      <div className="version-pill">V2.0 · 三端联动控制台</div>
      <h1>武侯课教智慧课堂</h1>
      <p className="lead">连接教师、学生与教室大屏，让 AI 参与课堂的每个关键节点。</p>
      <div className="connection"><span />课堂同步通道已就绪 <small>BroadcastChannel · 演示教室</small></div>
      <div className="portal-grid">
        <Portal icon="book" title="教师端" text="课件控制、发起答题、小组讨论、白板与 AI 助教" action="进入教师教学工作台" onClick={() => onEnter('teacher')} />
        <Portal icon="cap" title="学生端" text="接收课件提示、答题、讨论任务与查看学习记录" action="打开学生端" tone="blue" onClick={() => onEnter('student')} />
        <Portal icon="screen" title="教室大屏" text="同步课件、互动数据、小组讨论进度和课堂结论" action="打开大屏" tone="mint" onClick={() => onEnter('screen')} />
      </div>
      <p className="tip">提示：在不同标签页打开三个端，即可体验课堂状态实时同步</p>
    </section>
  </main>
}

function Portal({ icon, title, text, action, tone = '', onClick }) {
  return <button className={`portal ${tone}`} onClick={onClick}>
    <span className="portal-icon"><Icon name={icon} /></span>
    <strong>{title}</strong><p>{text}</p><span className="portal-action">{action} <Icon name="next" /></span>
  </button>
}

function Topbar({ title, onHome, actions }) {
  return <header className="topbar"><button className="brand-button" onClick={onHome}><Brand compact /></button><span className="crumb">/ {title}</span><div className="top-actions">{actions}</div></header>
}

function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><div className="modal-head"><h2>{title}</h2><button className="circle-button" onClick={onClose}><Icon name="close" /></button></div>{children}</section></div>
}

function Teacher({ onHome, state, updateState, students, setStudents, messages, setMessages }) {
  const [panel, setPanel] = useState(null)
  const [teacherPage, setTeacherPage] = useState('materials')
  const [questionVisible, setQuestionVisible] = useState(true)
  const [agentCollapsed, setAgentCollapsed] = useState(false)
  const [input, setInput] = useState('')
  const [drawMode, setDrawMode] = useState(null)
  const [dragTarget, setDragTarget] = useState(false)
  const [draggingQuestion, setDraggingQuestion] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [selectedTool, setSelectedTool] = useState(null)
  const pptCanvasRef = useRef(null)
  const boardCanvasRef = useRef(null)
  const pageAnnotations = useRef(new Map())
  const annotationDirty = useRef(false)
  const materials = state.materials || []
  const material = materials.find(material => material.id === state.materialId && (material.type === 'application/pdf' || /\.pdf$/i.test(material.name)))
  const materialPage = getMaterialPage(state, material?.id)
  useEffect(() => {
    const context = pptCanvasRef.current?.getContext('2d')
    if (!context) return
    const key = `${material?.id}:${materialPage}`
    context.clearRect(0, 0, 1400, 800)
    const saved = pageAnnotations.current.get(key)
    annotationDirty.current = !!saved
    if (saved) context.putImageData(saved, 0, 0)
    return () => {
      if (annotationDirty.current) pageAnnotations.current.set(key, context.getImageData(0, 0, 1400, 800))
      else pageAnnotations.current.delete(key)
    }
  }, [material?.id, materialPage])
  useEffect(() => {
    const run = state.questionRun
    if (run?.kind === 'discussion' && run.status === 'result') setMessages(messages => messages.some(message => message.discussionRunId === run.id) ? messages : [...messages, { from: 'agent', discussionRunId: run.id, text: `小组讨论已结束。${(run.summary || summarizeDiscussion(run)).title}，各组回答与讨论总结已展示。`, time: '刚刚' }])
  }, [state.questionRun?.id, state.questionRun?.status])

  useEffect(() => {
    const reports = Object.values(state.learningFeedback || {}).flatMap(stage => Object.values(stage)).filter(feedback => feedback.reportedAt)
    if (!reports.length) return
    setMessages(current => {
      const additions = reports.filter(feedback => !current.some(message => message.learningFeedbackId === `${feedback.stage}:${feedback.studentId}:${feedback.id}`)).map(feedback => ({
        from: 'agent', learningFeedbackId: `${feedback.stage}:${feedback.studentId}:${feedback.id}`,
        text: `收到 AI 学伴分析 · ${students.find(student => student.id === feedback.studentId)?.name || feedback.studentId}\n${feedback.summary}\n${feedback.items.map(item => `${item.question} 回答：${item.response}。${item.guidance}`).join('\n')}`,
        time: new Date(feedback.reportedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }))
      return additions.length ? [...current, ...additions] : current
    })
  }, [state.learningFeedback, students])

  useEffect(() => {
    const minutes = Object.values(state.discussionMinutes || {})
    if (!minutes.length) return
    setMessages(current => {
      const additions = minutes.filter(item => !current.some(message => message.discussionMinutesId === `${item.runId}:${item.groupId}:${item.id}`)).map(item => ({
        from: 'agent', discussionMinutesId: `${item.runId}:${item.groupId}:${item.id}`, text: `收到小组会议纪要\n${item.text}`,
        time: new Date(item.submittedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }))
      return additions.length ? [...current, ...additions] : current
    })
  }, [state.discussionMinutes])

  const broadcast = (patch, agentText) => {
    const next = { ...state, ...patch, updatedAt: Date.now() }
    updateState(next)
    if (agentText) setMessages(m => [...m, { from: 'agent', text: agentText, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }])
  }

  const startClass = () => {
    setPanel(null)
    setSelectedTool(null)
    setTeacherPage('classroom')
    broadcast({ phase: 'class', activity: 'screen', questionRun: null, ...(state.phase === 'after' ? { slide: 0 } : {}) }, '课程已开始。全班预习完成率 100%，重点关注“碳酸溶蚀”的理解。')
  }
  const endClass = () => {
    setPanel(null)
    broadcast({ phase: 'after', activity: 'review', questionRun: null }, '课堂已结束，课堂总结报告已自动生成。')
  }
  const send = () => {
    if (!input.trim()) return
    setMessages(m => [...m, { from: 'me', text: input.trim(), time: '刚刚' }, { from: 'agent', text: '已收到，我会结合当前课堂进度为你整理建议。', time: '刚刚' }])
    setInput('')
  }

  const beginDraw = e => {
    if (!drawMode) return
    const c = e.currentTarget, rect = c.getBoundingClientRect(), ctx = c.getContext('2d')
    ctx.beginPath(); ctx.moveTo((e.clientX - rect.left) * c.width / rect.width, (e.clientY - rect.top) * c.height / rect.height)
    c.setPointerCapture(e.pointerId)
  }
  const draw = e => {
    if (!drawMode || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const c = e.currentTarget, rect = c.getBoundingClientRect(), ctx = c.getContext('2d')
    if (c === pptCanvasRef.current) annotationDirty.current = true
    ctx.strokeStyle = '#725cff'; ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.lineTo((e.clientX - rect.left) * c.width / rect.width, (e.clientY - rect.top) * c.height / rect.height); ctx.stroke()
  }

  const startQuestion = (source, question = slideQuestions[(state.slide || 0) % slideQuestions.length]) => {
    const id = Date.now(), run = { id, source, question, status: 'answering', startedAt: id, endAt: id + 15000, answers: [] }
    setPanel(null)
    setQuestionVisible(true)
    broadcast({ activity: 'question', question, questionRun: run }, source === 'snapshot' ? '已截取黑板内容并自动生成问题，学生开始作答。' : '已识别老师的语音提问，学生开始作答。')

  }
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || run.status !== 'answering') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analyzeAt: Date.now() + 1800, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  const dropQuestion = e => {
    e.preventDefault(); setDragTarget(false); setDraggingQuestion(false)
    if (e.dataTransfer.getData('text/plain') !== 'question') return
    setSnapshotting(true)
    setTimeout(() => { setSnapshotting(false); startQuestion('snapshot') }, 650)
  }
  const prepareDiscussion = () => {
    setPanel(null)
    setQuestionVisible(true)
    broadcast({ activity: 'discussion', questionRun: createDiscussion(students, state.discussionQuestion || defaultDiscussionQuestion) }, '讨论题已就绪，学生可以选择小组；请编辑问题后点击开始讨论。')
  }
  const editDiscussion = question => updateState(current => {
    const run = current.questionRun
    if (run?.kind !== 'discussion' || run.status !== 'selecting') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, question } }
  })

  return <div className="app-shell teacher-page">
    <Topbar title={teacherPage === 'class' ? '班级管理' : '教师教学工作台'} onHome={onHome} actions={<>
      <button className="ghost teacher-nav" onClick={() => { setSelectedTool(null); setTeacherPage(state.phase === 'class' ? 'classroom' : 'materials') }}><Icon name="book" /> 教学工作台</button>
      <button className="ghost teacher-nav" onClick={() => setTeacherPage('class')}><Icon name="users" /> 班级管理</button>
      <button className="ghost teacher-nav" onClick={() => setTeacherPage('materials')}><Icon name="folder" /> 资料管理</button>
      <GeographyToolMenu onSelect={tool => { setTeacherPage('classroom'); setSelectedTool(tool) }} />
      {state.phase !== 'class' ? <button className="primary" disabled={!material} onClick={startClass}>开始上课</button> : <><span className="live"><i />授课中</span><button className="danger" onClick={endClass}>结束上课</button></>}
      <button className="avatar">范</button>
    </>} />
    <div hidden={teacherPage !== 'classroom'} className={`teacher-grid ${agentCollapsed ? 'agent-collapsed' : ''}`}>
      <section className="stage-card">
        <div className="stage-status"><span><i /> {state.phase === 'before' ? '课前准备' : state.phase === 'after' ? '课堂已结束' : '课堂进行中'}</span><b>{selectedTool?.name || material?.name || '请上传课中课件'}</b></div>
        <div className={`slide ${dragTarget ? 'question-drop-target' : ''}`} onDragEnter={() => setDragTarget(true)} onDragOver={e => e.preventDefault()} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setDragTarget(false)} onDrop={dropQuestion}>
          <UploadedPresentation material={material} page={materialPage} onTurn={(direction, total) => updateState(current => turnMaterialPage(current, material.id, direction, total))} showControls={!selectedTool && drawMode !== 'board'} />
          {draggingQuestion && <div className="question-drop-layer" />} 
          <canvas ref={pptCanvasRef} width="1400" height="800" className={`canvas annotation ${drawMode === 'ppt' ? 'active' : ''}`} onPointerDown={beginDraw} onPointerMove={draw} onPointerUp={e => e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId)} />
          <canvas ref={boardCanvasRef} width="1400" height="800" className={`canvas whiteboard ${drawMode === 'board' ? 'active' : ''}`} onPointerDown={beginDraw} onPointerMove={draw} onPointerUp={e => e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId)} />
          {drawMode === 'board' && <div className="whiteboard-title"><Icon name="pen" /> 空白板 · 独立书写</div>}
          <button className={`whiteboard-toggle ${drawMode === 'board' ? 'open' : ''}`} onClick={() => setDrawMode(mode => mode === 'board' ? null : 'board')} aria-label={drawMode === 'board' ? '收起白板' : '展开白板'}><Icon name={drawMode === 'board' ? 'next' : 'back'} /><span>{drawMode === 'board' ? '收起白板' : '展开白板'}</span></button>
          <button className={`annotation-toggle ${drawMode === 'ppt' ? 'selected' : ''}`} title={drawMode === 'ppt' ? '关闭批注' : 'PPT 批注'} aria-label={drawMode === 'ppt' ? '关闭批注' : 'PPT 批注'} onClick={() => setDrawMode(mode => mode === 'ppt' ? null : 'ppt')}><Icon name={drawMode === 'ppt' ? 'close' : 'pen'} /></button>
          {dragTarget && <div className="drop-hint"><Icon name="camera" /><b>松开截取黑板</b><span>AI 将根据快照自动生成问题</span></div>}
          {snapshotting && <div className="snapshot-flash"><Icon name="camera" /> 已截取黑板，正在生成问题…</div>}
          {teacherPage === 'classroom' && ['question', 'discussion'].includes(state.activity) && state.questionRun && questionVisible && panel !== 'question' && (state.questionRun.status === 'selecting' ? <DiscussionSetup run={state.questionRun} onEdit={editDiscussion} onStart={() => updateState(current => startDiscussion(current, state.questionRun.id))} onClose={() => setQuestionVisible(false)} /> : <TeacherQuestion run={state.questionRun} onStop={stopQuestion} onClose={() => setQuestionVisible(false)} />)}
          {panel === 'question' && <QuestionRecorder onClose={() => setPanel(null)} onSubmit={question => startQuestion('voice', question)} />}
          {selectedTool && <GeographyTools key={selectedTool.name} selected={selectedTool} />}
        </div>
        <StageControls hideAsk={panel === 'question' || (questionVisible && !!state.questionRun && ['question', 'discussion'].includes(state.activity))} usingTool={!!selectedTool} phase={state.phase} onAsk={() => { setQuestionVisible(true); setPanel('question') }} onDiscussion={prepareDiscussion} onDragStart={() => setDraggingQuestion(true)} onDragEnd={() => { setDraggingQuestion(false); setDragTarget(false) }} onClear={drawMode ? () => { (drawMode === 'board' ? boardCanvasRef : pptCanvasRef).current?.getContext('2d').clearRect(0, 0, 1400, 800); if (drawMode === 'ppt') annotationDirty.current = false } : null} clearLabel={drawMode === 'board' ? '清空白板' : '清空 PPT 标注'} onReturn={() => { setSelectedTool(null); setPanel(null); setDrawMode(null); setQuestionVisible(false); setTeacherPage('classroom') }}>
          {['question', 'discussion'].includes(state.activity) && state.questionRun && !questionVisible && <button onClick={() => setQuestionVisible(true)}><Icon name="chat" />{state.activity === 'discussion' ? '查看讨论' : '查看提问'}</button>}
        </StageControls>
      </section>
      <Agent messages={messages} input={input} setInput={setInput} send={send} onReport={() => setPanel('report')} collapsed={agentCollapsed} onToggle={() => setAgentCollapsed(value => !value)} />
    </div>
    {teacherPage === 'class' && <ClassManager students={students} setStudents={setStudents} />}
    {['materials', 'preview', 'discussion', 'review'].includes(teacherPage) && <MaterialWorkspace state={state} students={students} updateState={updateState} view={teacherPage} onView={view => { setPanel(null); setTeacherPage(view) }} />}
    {panel === 'report' && <Report state={state} messages={messages} onClose={() => setPanel(null)} />}
  </div>
}

function StageControls({ hideAsk = false, usingTool, phase, onAsk, onDiscussion, onReturn, onDragStart, onDragEnd, onClear, clearLabel, children }) {
  return <div className="stage-controls">
    {!usingTool && <div className="stage-left-actions">{children}</div>}
    {!usingTool && !hideAsk && <div className="stage-question-controls"><div className="ask-control"><button className="ask-button" draggable title="点击录音，或拖到黑板快照出题" aria-label="发起提问" onDragStart={e => { e.dataTransfer.setData('text/plain', 'question'); onDragStart?.() }} onDragEnd={onDragEnd} onClick={onAsk}><Icon name="question" /></button><small>点击录音 · 拖拽快照</small></div></div>}
    <div className="stage-right-actions">{!usingTool && <button disabled={phase !== 'class'} onClick={onDiscussion}><Icon name="chat" /> 小组讨论</button>}{!usingTool && onClear && <button onClick={onClear}>{clearLabel}</button>}<button onClick={onReturn}><Icon name="back" /> 返回课中</button></div>
  </div>
}

function GeographyToolMenu({ onSelect, tools = geographyTools }) {
  return <details className="geography-tool-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus() } }}>
    <summary className="ghost teacher-nav"><Icon name="folder" /> 地理工具集 <Icon name="down" /></summary>
    <div className="geography-tool-options">{tools.map(tool => <button key={tool.name} onClick={event => { event.currentTarget.closest('details').open = false; onSelect(tool) }}>{tool.name}</button>)}{!tools.length && <p>暂无 H5 工具</p>}</div>
  </details>
}

function GeographyTools({ selected }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setContent(''); setError('')
    if (selected) selected.load().then(html => { if (!cancelled) setContent(html) }).catch(() => { if (!cancelled) setError('工具加载失败，请返回工具集后重试。') })
    return () => { cancelled = true }
  }, [selected])
  return <section className="geography-tools" aria-label="地理工具 Canvas">
    {content ? <iframe title={`地理工具：${selected.name}`} srcDoc={content} allow="fullscreen" /> : <p role="status">{error || '正在加载工具…'}</p>}
  </section>
}

function TeacherQuestion({ run, onStop, onClose }) {
  const seconds = useCountdown(run.endAt)
  const isDiscussion = run.kind === 'discussion'
  const source = isDiscussion ? '资源预生成 · 小组讨论' : run.source === 'snapshot' ? 'AI 快照生成' : '教师录音提问'
  return <section className={`teacher-question ${run.status === 'result' ? 'result' : ''}`}><header><small>{source} · {run.status === 'result' ? isDiscussion ? '讨论总结' : '分析结果' : isDiscussion ? '小组回答' : '课堂提问'}</small><b>{run.status === 'answering' ? `${seconds}s` : run.status === 'analyzing' ? '分析中' : '已完成'}</b><button className="circle-button" aria-label={isDiscussion ? '关闭讨论展示' : '关闭提问展示'} onClick={onClose}><Icon name="close" /></button></header><h2>{run.question}</h2>
    {run.status === 'analyzing' ? <div className="teacher-analyzing"><span className="analysis-spinner" /><p>正在分析 {run.answers.filter(answer => answer.text.trim()).length} {isDiscussion ? '个小组' : '位学生'}的回答…</p></div> : run.status === 'result' ? isDiscussion ? <DiscussionSummary run={run} /> : <><div className="teacher-result-score"><strong>82%</strong><span>核心要点命中率</span></div><dl><div><dt>共性问题</dt><dd>对二氧化碳形成碳酸的中间过程描述不完整。</dd></div><div><dt>知识延展</dt><dd>强化“吸收 CO₂ → 形成碳酸 → 溶解碳酸钙”三步链路。</dd></div></dl></> : <><div className="teacher-answer-list">{isDiscussion ? run.groups.map(group => { const answer = run.answers.find(answer => answer.id === group.id); return <p key={group.id}><strong>{group.number}组 · {group.name}</strong><small>小组长：{group.leaderName}{answer?.active && ' · 正在录音'}</small><span>{answer?.text || '等待回答…'}</span></p> }) : run.answers.length ? run.answers.map(answer => <p key={answer.id}><strong>{answer.name}{answer.active && ' · 实时回答'}</strong><span>{answer.text}</span></p>) : <p className="empty">等待学生回答…</p>}</div><button onClick={onStop}><Icon name="stop" /> {isDiscussion ? '结束讨论并总结' : '停止作答并分析'}</button></>}
  </section>
}

function DiscussionSetup({ run, onEdit, onStart, onClose }) {
  const voiceBase = useRef('')
  const [voiceMode, setVoiceMode] = useState('append')
  const voice = useVoiceCapture(transcript => onEdit(`${voiceBase.current}${transcript}`))
  const toggleVoice = () => {
    if (voice.active) voice.stop()
    else { voiceBase.current = voiceMode === 'append' && run.question ? `${run.question.trim()}\n` : ''; voice.start() }
  }
  return <section className="teacher-question discussion-setup">
    <header><small>资源预生成 · 小组讨论</small><button className="circle-button" aria-label="关闭讨论设置" onClick={onClose}><Icon name="close" /></button></header><h2>编辑讨论内容</h2>
    <label className="discussion-label">讨论问题<textarea value={run.question} onChange={event => { if (voice.active || voice.pending) voice.stop(); onEdit(event.target.value) }} placeholder="请输入讨论问题；手动编辑会停止语音输入，避免覆盖文字" /></label>
    <div className="discussion-actions"><select aria-label="语音编辑方式" value={voiceMode} disabled={voice.active || voice.pending} onChange={event => setVoiceMode(event.target.value)}><option value="append">语音追加补充</option><option value="replace">语音替换问题</option></select><button className={voice.active ? 'danger' : 'ghost'} disabled={voice.pending} onClick={toggleVoice}><Icon name={voice.active ? 'stop' : 'mic'} />{voice.pending ? '等待麦克风授权…' : voice.active ? '停止语音输入' : '语音输入'}</button><p>转写内容可继续手动编辑。语音识别可能使用浏览器的在线服务。</p></div>
    {voice.error && <p role="status" className="voice-error">{voice.error}</p>}
    <div className="group-preview">{run.groups.map(group => <p key={group.id}><strong>{group.number}组 · {group.name}</strong><span>小组长：{group.leaderName}</span><small>已进入 {Object.values(run.members).filter(id => id === group.id).length} 人</small></p>)}</div>
    {!run.groups.length && <p>班级暂无学生，请先添加学生。</p>}
    <button className="primary" disabled={!run.question.trim() || !run.groups.length || voice.pending} onClick={() => { voice.stop(); onStart() }}>开始讨论 · 5 分钟</button>
  </section>
}

function DiscussionSummary({ run }) {
  const summary = run.summary || summarizeDiscussion(run)
  return <div className="discussion-summary"><h3>讨论总结 · 演示整理</h3><p><strong>{summary.title}</strong></p><p>{summary.text}</p><dl>{summary.groups.map(group => <div key={group.id}><dt>{group.number}组 · {group.name}　小组长：{group.leaderName}</dt><dd>{group.answer}</dd></div>)}</dl></div>
}

function QuestionRecorder({ onClose, onSubmit }) {
  const [elapsed, setElapsed] = useState(0)
  const [text, setText] = useState('')
  const voiceBase = useRef('')
  const voice = useVoiceCapture(transcript => setText(`${voiceBase.current}${transcript}`))
  useEffect(() => { voice.start(); return () => voice.stop() }, [])
  useEffect(() => {
    if (!voice.active) return
    const timer = setInterval(() => setElapsed(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [voice.active])
  return <section className="canvas-recorder"><header className="modal-head"><h2>录制老师提问</h2><button className="circle-button" aria-label="关闭录音" onClick={onClose}><Icon name="close" /></button></header><div className="recorder"><button className="recording-mic" disabled={voice.pending} aria-label={voice.active ? '停止提问录音' : '开始提问录音'} onClick={() => { if (voice.active) voice.stop(); else { voiceBase.current = text ? `${text}\n` : ''; voice.start() } }}><Icon name={voice.active ? 'stop' : 'mic'} /></button><p>{voice.pending ? '等待麦克风授权…' : voice.active ? '正在录音' : '录音已停止'}　{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</p>{voice.active && <div className="sound-wave">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ animationDelay: `${i * .06}s` }} />)}</div>}
    {voice.error && <p className="voice-error" role="status">{voice.error}</p>}
    <label className="discussion-label">提问内容<textarea value={text} readOnly={voice.active || voice.pending} onChange={event => setText(event.target.value)} placeholder="录音实时转写；停止录音后可修改问题或输入文字" /></label>
    {voice.audioUrl && <div className="recorded-audio"><audio controls src={voice.audioUrl} /></div>}
    <button className="primary wide" disabled={voice.pending || !text.trim()} onClick={() => { voice.stop(); onSubmit(text.trim()) }}><Icon name={voice.active ? 'stop' : 'send'} />{voice.active ? '结束录音并发起提问' : '发起提问'}</button></div></section>
}

function Agent({ messages, input, setInput, send, onReport, collapsed, onToggle }) {
  if (collapsed) return <aside className="agent-rail"><button onClick={onToggle} aria-label="展开课堂助教"><Icon name="back" /><Icon name="robot" /><span>课堂助教 Agent</span></button></aside>
  return <aside className="agent-card"><div className="agent-head"><span className="agent-icon"><Icon name="robot" /></span><div><h2>课堂助教 Agent</h2><p><i /> 在线 · 正在跟随课堂</p></div><button className="circle-button agent-toggle" aria-label="收起课堂助教" onClick={onToggle}><Icon name="next" /></button></div>
    <div className="agent-summary"><Icon name="spark" /> 当前课堂参与度 <strong>92%</strong></div>
    <div className="messages">{messages.map((m, i) => <div key={i} className={`message ${m.from}`}><p>{m.text}</p><small>{m.time}</small></div>)}</div>
    <div className="quick"><button onClick={onReport}>生成课堂报告</button><button onClick={() => setInput('总结学生动态')}>总结学生动态</button></div>
    <div className="composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="询问课堂或学生学习动态…" /><button onClick={send}><Icon name="send" /></button></div>
  </aside>
}

function ClassManager({ students, setStudents }) {
  const [editing, setEditing] = useState(null)
  const nextId = String(Math.max(8000, ...students.map(s => Number(s.id))) + 1).padStart(5, '0')
  const save = e => {
    e.preventDefault(); const name = new FormData(e.currentTarget).get('name').trim(); if (!name) return
    setStudents(s => editing?.id ? s.map(x => x.id === editing.id ? { ...x, name } : x) : [...s, { id: nextId, name, score: 0, status: '待完成预习' }]); setEditing(null)
  }
  return <main className="management-page"><section className="management-card"><h1>班级管理</h1><p className="modal-sub">六年级三班 · {students.length} 名学生</p><div className="student-cards">{students.map(s => <button key={s.id} onClick={() => setEditing(s)}><span>{s.name.slice(-1)}</span><strong>{s.name}</strong><small>学号 {s.id}{s.group && ` · ${s.group}组`}</small><em>{s.status}</em></button>)}<button className="add-student" onClick={() => setEditing({})}><Icon name="plus" /><strong>添加学生</strong><small>学号自动生成</small></button></div>
    {editing && <form className="inline-form" onSubmit={save}><label>学生姓名<input name="name" defaultValue={editing.name} autoFocus placeholder="请输入姓名" /></label><label>学号<input value={editing.id || nextId} disabled /></label><button className="primary">保存</button>{editing.id && <button type="button" className="danger-text" onClick={() => { setStudents(s => s.filter(x => x.id !== editing.id)); setEditing(null) }}>删除学生</button>}</form>}
  </section></main>
}

function MaterialWorkspace({ state, students, updateState, view = 'materials', onView }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const materials = state.materials || []
  const selected = state.analysisMaterialIds || []
  const packSent = !!state.publishedLearningPack && JSON.stringify(state.learningPack) === JSON.stringify(state.publishedLearningPack)
  const isPdf = material => material.type === 'application/pdf' || /\.pdf$/i.test(material.name)
  const parse = current => {
    if (!current.analysisMaterialIds?.length) return current
    const pack = createLearningPack()
    return { ...current, updatedAt: Date.now(), resourcesReady: true, learningPack: pack, learningAnswers: simulateLearningAnswers(pack, students, current.learningAnswers), discussionQuestion: defaultDiscussionQuestion, parsedMaterialIds: current.analysisMaterialIds }
  }
  const upload = async event => {
    const input = event.currentTarget, files = Array.from(input.files)
    if (!files.length) return
    setUploading(true); setError('')
    try {
      const uploaded = await saveMaterials(files)
      updateState(current => ({ ...current, materials: [...(current.materials || []), ...uploaded], updatedAt: Date.now() }))
    } catch (error) { setError(error.message || '资料保存失败，请重试。') }
    finally { input.value = ''; setUploading(false) }
  }
  const toggle = id => updateState(current => ({ ...current, updatedAt: Date.now(), analysisMaterialIds: current.analysisMaterialIds?.includes(id) ? current.analysisMaterialIds.filter(item => item !== id) : [...(current.analysisMaterialIds || []), id] }))
  return <main className="material-workspace"><section className="material-library">
    <small className="workspace-eyebrow">课程文件夹</small><h1>准备今天的课堂</h1><p className="modal-sub">上传资料后，选择用于 AI 解析的文件。PDF 可设为课中展示课件。</p>
    <label className={`upload-button ${uploading ? 'disabled' : ''}`}><Icon name="upload" />{uploading ? '正在上传…' : '上传资料到课程文件夹'}<input type="file" multiple disabled={uploading} accept=".ppt,.pptx,.pdf,.doc,.docx,.txt,.md,image/*" onChange={upload} /></label>
    {error && <p className="voice-error" role="alert">{error}</p>}
    <div className="course-files">{materials.map(material => <article key={material.id} className={selected.includes(material.id) ? 'selected' : ''}>
      <label className="analysis-check"><input type="checkbox" checked={selected.includes(material.id)} onChange={() => toggle(material.id)} /><span className="file-icon"><Icon name="folder" /></span><span><strong>{material.name}</strong><small>教师上传 · 点击选择用于解析</small></span></label>
      {isPdf(material) ? <label className="material-select"><input type="radio" name="class-material" checked={state.materialId === material.id} onChange={() => updateState(current => ({ ...current, materialId: material.id, updatedAt: Date.now() }))} />课中展示</label> : <small className="analysis-only">仅用于解析</small>}
    </article>)}</div>
    {!materials.length && <div className="upload-empty"><Icon name="upload" /><h2>课程文件夹为空</h2><p>支持 PDF、Word、PPT、文本和图片资料。</p></div>}
  </section><section className="material-editor">
    <nav className="material-tabs">{[['preview', '课前预习'], ['discussion', '课中讨论'], ['review', '课后复习']].map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} disabled={!state.learningPack} onClick={() => onView(key)}>{label}</button>)}<div className="material-tab-actions"><button className={`publish-pack ${packSent ? 'sent' : ''}`} disabled={!state.learningPack || packSent} onClick={() => updateState(current => publishLearningPack(current))}><Icon name={packSent ? 'check' : 'send'} />{packSent ? '已发送' : '发送学生端'}</button><button className="class-preview" disabled={!state.learningPack} onClick={() => onView('classroom')}><Icon name="screen" />课中预览</button></div></nav>
    {!state.learningPack || view === 'materials' ? <div className="analysis-start"><Icon name="spark" /><h2>选择资料后生成教学内容</h2><p>将生成课前预习资料与测验、课中小组讨论题、课后复习资料与测验。</p><button className="primary" disabled={!selected.length || uploading} onClick={() => { updateState(current => parse(current)); onView('preview') }}><Icon name="spark" /> AI 解析所选资料{selected.length ? `（${selected.length}）` : ''}</button></div> : view === 'discussion' ? <DiscussionContentEditor question={state.discussionQuestion} onSave={question => updateState(current => ({ ...current, discussionQuestion: question, updatedAt: Date.now() }))} /> : <LearningContentEditor key={view} stage={view} content={state.learningPack[view]} onSave={content => updateState(current => ({ ...current, learningPack: { ...current.learningPack, [view]: content }, updatedAt: Date.now() }))} />}
  </section></main>
}

function LearningContentEditor({ stage, content, onSave }) {
  const [draft, setDraft] = useState(content), [saved, setSaved] = useState(false)
  useEffect(() => {
    const incoming = JSON.stringify(content)
    if (incoming !== JSON.stringify(draft)) { setDraft(content); setSaved(false) }
  }, [content])
  const updateExercise = (index, patch) => setDraft(current => ({ ...current, exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise) }))
  const updateOption = (exerciseIndex, optionIndex, value) => setDraft(current => ({ ...current, exercises: current.exercises.map((exercise, i) => i === exerciseIndex ? { ...exercise, options: exercise.options.map((option, j) => j === optionIndex ? value : option) } : exercise) }))
  const addExercise = () => {
    setSaved(false)
    setDraft(current => ({ ...current, exercises: [...current.exercises, { id: `${stage}-${Date.now()}`, question: '', options: ['', '', ''], answer: '' }] }))
  }
  return <form className="content-editor" onSubmit={event => { event.preventDefault(); onSave(draft); setSaved(true) }}>
    <header><div><small>{stage === 'preview' ? '课前学习材料' : '课后巩固材料'}</small><h2>{draft.title}资料 + 测验</h2></div><div className="editor-actions"><button className="primary">{saved ? '已保存 ✓' : '保存修改'}</button></div></header>
    <label>资料标题<input required value={draft.title} onChange={event => { setSaved(false); setDraft(current => ({ ...current, title: event.target.value })) }} /></label>
    <label>学习任务<textarea required value={draft.task} onChange={event => { setSaved(false); setDraft(current => ({ ...current, task: event.target.value })) }} /></label>
    <div className="exercise-heading"><h3>测验题目</h3><button type="button" className="ghost add-exercise" onClick={addExercise}><Icon name="plus" /> 新增题目</button></div>
    {draft.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>第 {index + 1} 题</legend>
      <label>题目<input required value={exercise.question} onChange={event => { setSaved(false); updateExercise(index, { question: event.target.value }) }} /></label>
      <div className="option-inputs"><span>选项</span>{exercise.options.map((option, optionIndex) => <label key={optionIndex}>选项 {optionIndex + 1}<input required value={option} onChange={event => { setSaved(false); updateOption(index, optionIndex, event.target.value) }} /></label>)}</div>
      <label>参考答案<input required value={exercise.answer} onChange={event => { setSaved(false); updateExercise(index, { answer: event.target.value }) }} /></label>
    </fieldset>)}
  </form>
}

function DiscussionContentEditor({ question, onSave }) {
  const [draft, setDraft] = useState(question), [saved, setSaved] = useState(false)
  useEffect(() => { setDraft(question); setSaved(false) }, [question])
  return <form className="content-editor discussion-content-editor" onSubmit={event => { event.preventDefault(); onSave(draft.trim()); setSaved(true) }}><header><div><small>课中互动</small><h2>小组讨论题目</h2></div><button className="primary" disabled={!draft.trim()}>{saved ? '已保存 ✓' : '保存修改'}</button></header><label>讨论问题<textarea value={draft} onChange={event => { setDraft(event.target.value); setSaved(false) }} /></label><p>开始小组讨论时将使用这里保存的问题，教师仍可在课堂中再次调整。</p></form>
}

function UploadedPresentation({ material, page = 1, onTurn, showControls = true }) {
  const asset = useMaterial(material?.id)
  if (!material) return <div className="presentation-empty"><h2>等待教师上传课中展示资料</h2><p>教师原始课件将在这里展示，不自动生成 PPT。</p></div>
  if (asset.error) return <div className="presentation-empty"><h2>{material.name}</h2><p role="alert">{asset.error}</p></div>
  if (!asset.url) return <div className="presentation-empty">正在读取原始课件…</div>
  if (material.type?.startsWith('image/')) return <img className="uploaded-image" src={asset.url} alt={material.name} />
  if (/\.pdf$/i.test(material.name) || material.type === 'application/pdf') return <PdfPresentation key={material.id} url={asset.url} name={material.name} page={page} onTurn={onTurn} showControls={showControls} />
  return <div className="presentation-empty"><Icon name="folder" /><h2>{material.name}</h2><p>此原始文件不能在浏览器内直接展示。请将课件导出为 PDF 或图片后重新上传。</p><a className="primary" href={asset.url} download={material.name}>下载原始资料</a></div>
}

function PdfPresentation({ url, name, page, onTurn, showControls }) {
  const container = useRef(null), canvas = useRef(null)
  const [pdf, setPdf] = useState(null), [size, setSize] = useState(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false, loading
    setPdf(null); setError(''); setBusy(true)
    import('./pdf-renderer.js').then(module => {
      if (cancelled) return
      loading = module.loadPdf(url)
      return loading.promise.then(document => { if (!cancelled) setPdf({ document, render: module.renderPdfPage }) })
    }).catch(error => { if (!cancelled) { setError(error.message || 'PDF 读取失败'); setBusy(false) } })
    return () => { cancelled = true; loading?.destroy() }
  }, [url])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!pdf || !size) return
    setBusy(true); setError('')
    const job = pdf.render(pdf.document, Math.min(page, pdf.document.numPages), canvas.current, size)
    let cancelled = false
    job.promise.then(() => { if (!cancelled) setBusy(false) }).catch(error => {
      if (!cancelled) { setError(error.message || 'PDF 页面显示失败'); setBusy(false) }
    })
    return () => { cancelled = true; job.cancel() }
  }, [pdf, page, size])
  const total = pdf?.document.numPages
  return <div className="pdf-presentation" ref={container} aria-label={`课中展示：${name} · 第 ${page} 页`} aria-busy={busy}>
    <canvas ref={canvas} className="pdf-page" />
    {error ? <p className="pdf-status" role="alert">{error}</p> : busy && <p className="pdf-status" role="status">正在显示第 {page} 页…</p>}
    {onTurn && showControls && <CanvasPagination page={page} total={total} busy={busy || !!error || !total} onTurn={direction => onTurn(direction, total)} />}
  </div>
}

function CanvasPagination({ page, onTurn, total = Infinity, busy = false }) {
  return <nav className="canvas-pagination" aria-label="课件翻页">
    <button disabled={busy || page <= 1} aria-label="上一页" title="上一页" onClick={() => onTurn(-1)}><Icon name="back" /></button>
    <button disabled={busy || page >= total} aria-label="下一页" title="下一页" onClick={() => onTurn(1)}><Icon name="next" /></button>
  </nav>
}

function LearningOverview({ stage, state, students }) {
  const content = state.learningPack[stage]
  return <section className="learning-overview"><div className="learning-content"><small>AI 模拟生成 · {content.title}</small><h2>{content.title}任务</h2><p>{content.task}</p><ol>{content.exercises.map(exercise => <li key={exercise.id}><strong>{exercise.question}</strong><p>{exercise.options.join(' / ')}</p><small>参考答案：{exercise.answer}</small></li>)}</ol></div><h2>每位学生的答题情况</h2><div className="learning-students">{students.map(student => {
    const answers = state.learningAnswers?.[stage]?.[student.id] || {}
    const submitted = content.exercises.filter(exercise => answers[exercise.id])
    const correct = submitted.filter(exercise => answers[exercise.id].text === exercise.answer)
    const feedback = state.learningFeedback?.[stage]?.[student.id]
    return <article key={student.id}><header><strong>{student.name}</strong><small>学号 {student.id}</small><b>{submitted.length ? `${submitted.length}/${content.exercises.length} 已答 · ${correct.length} 题正确` : '未提交'}</b></header>{content.exercises.map((exercise, index) => <p key={exercise.id}><span>第 {index + 1} 题</span><strong>{answers[exercise.id]?.text || '未作答'}</strong><em>{answers[exercise.id] ? answers[exercise.id].text === exercise.answer ? '正确' : '待订正' : '待完成'}</em></p>)}<small>{submitted.length ? submitted.some(exercise => answers[exercise.id].simulated) ? '模拟答题记录' : '学生实际提交' : '等待学生提交'}</small>{feedback?.reportedAt && <div className="learning-feedback"><strong>AI 学伴分析</strong><p>{feedback.summary}</p>{feedback.items.map((item, index) => <p key={index}>{item.guidance}</p>)}</div>}</article>
  })}</div>{!students.length && <p>班级暂无学生。</p>}</section>
}

function LearningExercises({ stage, state, student, updateState }) {
  const content = state.publishedLearningPack?.[stage]
  const submitted = state.learningAnswers?.[stage]?.[student.id] || {}
  const [responses, setResponses] = useState(() => Object.fromEntries(Object.entries(submitted).map(([id, answer]) => [id, answer.text])))
  const [saved, setSaved] = useState(false)
  if (!content) return <div className="task-content"><h1>等待教师发送学习资料</h1><p>教师发送后，{stage === 'preview' ? '课前预习' : '课后复习'}资料与测验会出现在这里。</p></div>
  return <div className="learning-exercises"><small>AI 模拟生成 · {content.title}</small><h1>{content.title}</h1><p>{content.task}</p><form onSubmit={event => { event.preventDefault(); updateState(current => submitLearningAnswers(current, stage, student.id, responses)); setSaved(true) }}>{content.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>{index + 1}. {exercise.question}</legend>{exercise.options.map(option => <label key={option}><input type="radio" name={exercise.id} required value={option} checked={responses[exercise.id] === option} onChange={() => { setResponses(current => ({ ...current, [exercise.id]: option })); setSaved(false) }} />{option}</label>)}{submitted[exercise.id] && <small>上次回答：{submitted[exercise.id].text} · {submitted[exercise.id].text === exercise.answer ? '正确' : '待订正'}{submitted[exercise.id].simulated && '（模拟记录）'}</small>}</fieldset>)}<button className="primary" disabled={content.exercises.some(exercise => !responses[exercise.id])}>{saved ? '已提交 ✓' : '提交习题'}</button>{saved && <p role="status">已提交，AI 学伴的分析指导请查看右侧学伴窗口。</p>}</form></div>
}

function Report({ state, messages, onClose }) {
  return <Modal title="课堂总结报告" onClose={onClose}><div className="report" id="report"><Brand compact /><h1>《神奇的喀斯特地貌》课堂总结</h1><p>课程状态：{state.phase === 'after' ? '已结束' : '进行中'}　教师上传资料：{state.materials?.length || 0} 份</p>
    <div className="report-stats"><div><b>92%</b><span>课堂参与度</span></div><div><b>88%</b><span>知识点掌握</span></div><div><b>3</b><span>学习建议</span></div></div>
    <h3>课堂助教总结</h3><p>学生整体参与积极，能够描述雨水与石灰岩的作用过程。建议继续区分“溶蚀”与“沉积”两个阶段。</p>
    <h3>学伴 Agent 总结</h3><p>结合课前预习与课后习题记录，关注学生对二氧化碳、碳酸钙及溶蚀、沉积过程的理解。</p>
    <h3>教学建议</h3><ol className="teaching-suggestions"><li>用“吸收 CO₂ → 形成碳酸 → 溶解碳酸钙”三步链路强化溶蚀过程，并请学生复述。</li><li>结合溶洞、钟乳石图片，对比“溶蚀”与“沉积”的发生条件和地貌结果。</li><li>对中间过程表达不完整的学生安排针对性追问，课后用简短练习检查理解。</li></ol>
    <h3>课堂记录</h3>{messages.slice(-4).map((m, i) => <p key={i}>• {m.text}</p>)}
  </div><button className="primary wide no-print" onClick={() => window.print()}><Icon name="download" /> 下载 / 打印 PDF</button></Modal>
}

function StudentLogin({ students, onLogin, onHome }) {
  const [error, setError] = useState('')
  const submit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); const student = students.find(s => s.id === data.id && s.name === data.name); student ? onLogin(student) : setError('姓名或学号不匹配，请重新输入') }
  return <main className="login-page"><button className="back-home" onClick={onHome}><Icon name="back" /> 返回控制台</button><section className="login-card"><Brand /><div className="login-art"><span><Icon name="cap" /></span></div><h1>欢迎回到智慧课堂</h1><p>输入你的信息，开启今天的学习旅程</p><form onSubmit={submit}><label>姓名<input name="name" placeholder="例如：李奕贤" /></label><label>学号<input name="id" inputMode="numeric" placeholder="例如：08001" /></label>{error && <p className="form-error">{error}</p>}<button className="primary wide">进入课堂 <Icon name="next" /></button></form><small>演示账号：李奕贤 / 08001</small></section></main>
}

function Student({ student, onHome, state, updateState }) {
  const [tab, setTab] = useState(state.phase === 'after' ? 'review' : state.phase === 'before' ? 'preview' : 'class')
  const [answer, setAnswer] = useState('')
  const [sent, setSent] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  useEffect(() => setTab(state.phase === 'after' ? 'review' : state.phase === 'before' ? 'preview' : 'class'), [state.phase])
  const activity = state.activity === 'question' ? { title: '课堂提问', text: state.question } : state.activity === 'discussion' ? { title: '小组讨论', text: state.discussion } : { title: '课堂进行中，请看大屏', text: '请观看教师上传的课中资料' }
  const notifications = state.learningNotifications || []
  const unread = notifications.some(item => item.sentAt > (state.learningNotificationReads?.[student.id] || 0))
  const openNotifications = () => {
    setShowNotifications(value => !value)
    if (!showNotifications && notifications.length) updateState(current => ({ ...current, learningNotificationReads: { ...current.learningNotificationReads, [student.id]: Math.max(...notifications.map(item => item.sentAt)) } }))
  }
  return <div className="app-shell student-page"><Topbar title={`学生端 · ${student.name}`} onHome={onHome} actions={<><div className="student-notifications"><button className="notification-button" aria-label="学习资料通知" onClick={openNotifications}><Icon name="bell" />{unread && <i />}</button>{showNotifications && <div className="notification-panel"><strong>学习资料通知</strong>{notifications.length ? notifications.map(item => <button key={item.id} onClick={() => { setTab(item.stage); setShowNotifications(false) }}><b>{item.title}</b><small>{item.stage === 'preview' ? '课前预习' : '课后复习'} · {new Date(item.sentAt).toLocaleString('zh-CN')}</small></button>) : <p>暂无新消息</p>}</div>}</div><span className="student-tag">{student.id}</span><button className="avatar">{student.name.slice(-1)}</button></>} />
    <nav className="student-tabs">{[['preview','课前预习'],['class','课堂互动'],['review','课后复习']].map(([id, label]) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>
    <div className="student-grid"><section className="activity-card"><div className="section-label">{tab === 'preview' ? '课前预习' : tab === 'review' ? '课后复习' : '课堂互动'}<span>{state.phase === 'class' ? '● 与教师端同步' : ''}</span></div>
      {tab === 'preview' && <LearningExercises key="preview" stage="preview" state={state} student={student} updateState={updateState} />}
      {tab === 'class' && state.activity === 'discussion' && state.questionRun?.kind === 'discussion' ? <StudentDiscussion key={state.questionRun.id} run={state.questionRun} student={student} updateState={updateState} stateMinutes={state.discussionMinutes} /> : tab === 'class' && state.activity === 'question' && state.questionRun ? <StudentQuestion key={state.questionRun.id} run={state.questionRun} student={student} updateState={updateState} /> : tab === 'class' && <div className="task-content"><span className="pulse-ring" /><small>{activity.title}</small><h1>{activity.text}</h1><p>{state.activity === 'screen' ? '教师发起互动后，题目或小组任务会自动出现在这里' : '说出你的想法，学伴会帮你组织表达。'}</p>{state.activity !== 'screen' && <div className="answer-box"><textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" /><button className="primary" onClick={() => answer.trim() && setSent(true)}>{sent ? '已提交 ✓' : '提交回答'}</button></div>}</div>}
      {tab === 'review' && <LearningExercises key="review" stage="review" state={state} student={student} updateState={updateState} />}
    </section><StudyBuddy student={student} stage={tab} state={state} updateState={updateState} /></div>
  </div>
}

function StudentDiscussion({ run, student, updateState, stateMinutes }) {
  const group = run.groups.find(group => group.id === run.members[student.id])
  const isLeader = group?.leaderId === student.id
  const [draftMinutes, setDraftMinutes] = useState(() => stateMinutes?.[`${run.id}:${group?.id}`]?.text || '')
  const [stopped, setStopped] = useState(false)
  const transcript = useRef('')
  const voiceBase = useRef('')
  const voice = useVoiceCapture(text => { transcript.current = `${voiceBase.current}${text}` })
  const seconds = useCountdown(run.endAt || Date.now())
  const stopRecording = () => {
    voice.stop()
    setDraftMinutes(formatDiscussionMinutes(run.question, group.number, transcript.current) || draftMinutes)
    setStopped(true)
  }
  const startRecording = () => {
    voiceBase.current = transcript.current ? `${transcript.current}\n` : ''
    setStopped(false)
    voice.start()
  }
  useEffect(() => {
    if (isLeader && ['selecting', 'answering'].includes(run.status)) startRecording()
    return () => voice.stop()
  }, [group?.id, isLeader])
  useEffect(() => { if (!['selecting', 'answering'].includes(run.status)) voice.stop() }, [run.status])
  useEffect(() => {
    if (voice.error && !voice.active && !voice.pending) setStopped(true)
  }, [voice.error, voice.active, voice.pending])
  useEffect(() => {
    if (isLeader && run.status === 'answering') updateState(current => {
      const submitted = current.questionRun?.answers.find(answer => answer.id === group.id)?.text || ''
      return setGroupAnswer(current, run.id, student.id, group.id, submitted, voice.active)
    })
  }, [run.status, group?.id, isLeader, voice.active])

  if (run.status === 'analyzing') return <div className="student-question-state"><span className="analysis-spinner" /><h1>小组回答分析中</h1><p>{group ? `正在整理${group.number}组的观点…` : '等待教师公布讨论结果。'}</p></div>
  if (run.status === 'result') {
    if (!group) return <div className="student-discussion"><h2>{run.question}</h2><p>本次讨论已结束，你未加入小组。</p></div>
    const ownRun = { ...run, groups: [group], answers: run.answers.filter(answer => answer.id === group.id) }
    return <div className="student-discussion"><div className="discussion-member-head"><strong>{group.number}组 · {group.name}</strong><span>小组长：{group.leaderName}</span></div><h2>{run.question}</h2><DiscussionSummary run={{ ...ownRun, summary: summarizeDiscussion(ownRun) }} /></div>
  }
  if (!group) return <div className="student-discussion"><small>小组讨论 · 选择小组</small><h1>请选择你要进入的小组</h1><p>{run.question}</p><div className="group-selection">{run.groups.map(group => <button key={group.id} onClick={() => updateState(current => joinDiscussion(current, run.id, student.id, group.id))}><span className="group-number">{group.number}组</span><strong>{group.name}</strong><span>小组长：{group.leaderName}</span><small>{group.leaderId === student.id ? '我是小组长 · 进入后自动申请录音' : '以组员身份进入 · 麦克风禁音'}</small></button>)}</div>{!run.groups.length && <p>等待教师配置小组。</p>}</div>
  const response = run.answers.find(answer => answer.id === group.id)
  const minutes = stateMinutes?.[`${run.id}:${group.id}`]
  return <div className="student-discussion">
    <div className="discussion-member-head"><strong>{group.number}组 · {group.name}</strong><span>小组长：{group.leaderName}</span><b>{isLeader ? '小组长' : '组员 · 禁音'}</b></div>
    <h2>{run.question}</h2><p>{run.status === 'selecting' ? '等待教师开始讨论；组长可先组织观点。' : `讨论进行中 · 剩余 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</p>
    {isLeader ? <>
      <button className={`student-mic ${voice.active ? 'listening' : ''}`} disabled={voice.pending} aria-label={voice.active ? '停止小组录音' : '开始小组录音'} onClick={voice.active ? stopRecording : startRecording}><Icon name={voice.active ? 'stop' : 'mic'} /></button>
      <strong className="mic-label">{voice.pending ? '等待麦克风授权…' : voice.active ? '正在录音 · 停止后生成会议纪要' : '录音已停止 · 可点击重新开启'}</strong>
      {voice.error && <p className="voice-error" role="status">{voice.error}</p>}
      {voice.active || voice.pending ? <p role="status">录音中，停止录音后显示可编辑的会议纪要。</p> : (stopped || draftMinutes) && <>
        <label className="discussion-label">会议纪要<textarea value={draftMinutes} aria-label="会议纪要" onChange={event => setDraftMinutes(event.target.value)} placeholder="未获得语音转写，请补充会议纪要后提交" /></label>
        <div className="discussion-actions"><button className="primary" disabled={!draftMinutes.trim() || run.status !== 'answering' || minutes?.text === draftMinutes.trim()} onClick={() => updateState(current => submitDiscussionMinutes(current, run.id, student.id, group.id, draftMinutes))}>{minutes?.text === draftMinutes.trim() ? '已提交 ✓' : '提交'}</button><p>{run.status === 'selecting' ? '教师开始讨论后可提交会议纪要。' : minutes?.text === draftMinutes.trim() ? '会议纪要已提交至教师 Agent。' : '确认或修改会议纪要后，点击提交发送给教师 Agent。'}</p></div>
      </>}
      <p className="voice-privacy">录音文件仅保留本机；语音识别可能使用浏览器的在线服务。</p>
      {voice.audioUrl && <div className="recorded-audio"><audio controls src={voice.audioUrl} /><a href={voice.audioUrl} download={`小组${group.number}-讨论录音`}>下载本次录音（仅本机）</a></div>}
    </> : <><div className="muted-notice"><Icon name="stop" /><strong>麦克风已禁用</strong><p>由小组长录音并整理会议纪要，提交后可查看本组纪要。</p></div><div className="my-transcript"><small>本组会议纪要</small><p>{response?.text || '等待小组长提交会议纪要…'}</p></div></>}
    {minutes && !isLeader && <div className="learning-feedback" role="status"><strong>会议纪要已提交至教师 Agent</strong></div>}
  </div>
}

function StudentQuestion({ run, student, updateState }) {
  const [text, setText] = useState(() => run.answers.find(answer => answer.id === student.id)?.text || '')
  const voiceBase = useRef('')
  const voice = useVoiceCapture(transcript => setText(`${voiceBase.current}${transcript}`))
  const seconds = useCountdown(run.endAt)
  useEffect(() => { if (run.status !== 'answering') voice.stop() }, [run.status])
  useEffect(() => {
    if (run.status === 'answering') updateState(current => setQuestionAnswer(current, run.id, student, text, voice.active))
  }, [run.status, text, voice.active])
  if (run.status === 'analyzing') return <div className="student-question-state"><span className="analysis-spinner" /><h1>回答分析中</h1><p>学伴正在整理全班同学的回答…</p></div>
  if (run.status === 'result') return <div className="student-question-state"><span className="result-check"><Icon name="check" /></span><small>本次作答已完成</small><h1>谢谢你的回答</h1><p>老师正在带领大家查看共性问题与建议。</p></div>
  return <div className="student-question-state"><div className="student-timer"><span>请作答</span><b>{seconds}</b><small>秒</small></div><h1>{run.question}</h1><p>点击麦克风录音，转写内容自动同步给教师</p><button className={`student-mic ${voice.active ? 'listening' : ''}`} disabled={voice.pending} onClick={() => { if (voice.active) voice.stop(); else { voiceBase.current = text ? `${text}\n` : ''; voice.start() } }} aria-label={voice.active ? '停止回答' : '开始回答'}><Icon name={voice.active ? 'stop' : 'mic'} /></button><strong className="mic-label">{voice.pending ? '等待麦克风授权…' : voice.active ? '正在录音 · 点击停止' : '点击开始回答'}</strong>
    {voice.error && <p className="voice-error" role="status">{voice.error}</p>}
    <label className="discussion-label">我的回答<textarea value={text} readOnly={voice.active || voice.pending} onChange={event => setText(event.target.value)} placeholder="停止录音后可修改转写或输入文字，自动同步给教师" /></label>
    {voice.audioUrl && <div className="recorded-audio"><audio controls src={voice.audioUrl} /><a href={voice.audioUrl} download="课堂回答录音">下载本次录音（仅本机）</a></div>}
  </div>
}

function StudyBuddy({ student, stage, state, updateState }) {
  const feedback = state?.learningFeedback?.[stage]?.[student.id]
  useEffect(() => {
    if (feedback && !feedback.reportedAt) updateState(current => reportLearningFeedback(current, stage, student.id, feedback.id))
  }, [stage, student.id, feedback?.id, feedback?.reportedAt])
  const [input, setInput] = useState('')
  const [chat, setChat] = useState([{ from: 'bot', text: `${student.name}你好！关于“喀斯特地貌”，我会用提问帮你自己找到答案。` }])
  const send = text => { const value = (text || input).trim(); if (!value) return; setChat(c => [...c, { from: 'me', text: value }, { from: 'bot', text: '很好的思路！再想一步：水里的二氧化碳在其中起到了什么作用？' }]); setInput('') }
  return <aside className="buddy-card"><div className="agent-head"><span className="agent-icon"><Icon name="robot" /></span><div><h2>AI 学伴</h2><p><i /> 启发式引导 · 不直接给答案</p></div></div><div className="messages">{feedback && <div className="message bot learning-feedback" role="status"><small>习题分析与指导</small><p>{feedback.summary}</p>{feedback.items.map((item, index) => <p key={index}>{item.guidance}</p>)}<small>{feedback.reportedAt ? '分析结果已同步给教师 Agent' : '指导已生成，正在同步给教师 Agent…'}</small></div>}{chat.map((m, i) => <div className={`message ${m.from}`} key={i}><p>{m.text}</p></div>)}</div><div className="quick"><button onClick={() => send('为什么会形成溶洞？')}>为什么会形成溶洞？</button><button onClick={() => send('引导我分析这道题')}>引导我分析</button></div><div className="composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="说说你的想法…" /><button onClick={() => send()}><Icon name="send" /></button></div></aside>
}

function BigScreen({ onHome, state, updateState }) {
  const material = state.materials?.find(material => material.id === state.materialId && (material.type === 'application/pdf' || /\.pdf$/i.test(material.name)))
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || run.status !== 'answering') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analyzeAt: Date.now() + 1800, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  return <main className="big-screen"><header><Brand compact /><div><i /> {state.phase === 'class' ? '课堂进行中' : state.phase === 'after' ? '课堂已结束' : '课前准备'}　<span>{material?.name}</span></div><button onClick={onHome}><Icon name="close" /></button></header>{['question', 'discussion'].includes(state.activity) && state.questionRun ? <ScreenQuestion run={state.questionRun} onStop={stopQuestion} /> : <section className="screen-presentation"><UploadedPresentation material={material} page={getMaterialPage(state, material?.id)} /></section>}</main>
}

function ScreenQuestion({ run, onStop }) {
  const seconds = useCountdown(run.endAt)
  if (run.kind === 'discussion') return <ScreenDiscussion run={run} onStop={onStop} />
  if (run.status === 'analyzing') return <section className="screen-analysis"><div className="screen-glow" /><span className="analysis-spinner" /><small>AI 课堂助教</small><h1>回答分析中…</h1><p>正在汇总 {run.answers.length || 2} 位同学的表达和共性问题</p></section>
  if (run.status === 'result') return <section className="screen-result"><div className="screen-glow" /><small>作答分析完成</small><h1>大家抓住了“水与岩石作用”的主线</h1><div className="result-layout"><div className="result-score"><b>82<small>%</small></b><span>核心要点命中率</span></div><div className="result-insights"><article><small>共性问题</small><p>多数同学能提到“雨水”和“石灰岩”，但对二氧化碳形成碳酸这一中间过程描述不完整。</p></article><article><small>教学建议</small><p>用“吸收 CO₂ → 形成碳酸 → 溶解碳酸钙”三步链路再做一次口头强化。</p></article></div></div></section>
  const activeAnswers = run.answers.filter(x => x.active)
  return <section className="screen-answering"><div className="screen-glow" /><div className="answering-head"><div><small>课堂提问</small><h1>请作答</h1></div><div className="screen-countdown"><b>{seconds}</b><span>秒</span></div><button onClick={onStop}><Icon name="stop" /> 停止作答</button></div><h2>{run.question}</h2><div className="live-answers">{activeAnswers.length ? activeAnswers.map(answer => <article key={answer.id}><div><span>{answer.name.slice(-1)}</span><p><b>{answer.name}</b><small><i /> 麦克风已开启 · 实时转写</small></p></div><blockquote>{answer.text}</blockquote><div className="mini-wave">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div></article>) : <div className="waiting-answer"><Icon name="mic" /><p>等待同学开启麦克风…</p></div>}</div></section>
}

function ScreenDiscussion({ run, onStop }) {
  const seconds = useCountdown(run.endAt || Date.now())
  if (run.status === 'analyzing') return <section className="screen-analysis"><span className="analysis-spinner" /><h1>小组回答分析中…</h1><p>正在整理各组观点与讨论总结</p></section>
  if (run.status === 'result') return <section className="screen-result screen-discussion"><small>小组讨论完成</small><h1>{run.question}</h1><DiscussionSummary run={run} /></section>
  return <section className="screen-answering"><div className="screen-glow" /><div className="answering-head"><div><small>小组讨论</small><h1>{run.status === 'selecting' ? '请选择小组' : '讨论进行中'}</h1></div>{run.status === 'answering' && <><div className="screen-countdown"><b>{seconds}</b><span>秒</span></div><button onClick={onStop}><Icon name="stop" /> 结束讨论</button></>}</div><h2>{run.question}</h2><div className="live-answers">{run.groups.map(group => { const answer = run.answers.find(answer => answer.id === group.id); return <article key={group.id}><div><span>{group.number}</span><p><b>{group.number}组 · {group.name}</b><small>小组长：{group.leaderName} · {answer?.active ? '正在录音' : run.status === 'selecting' ? `已进入 ${Object.values(run.members).filter(id => id === group.id).length} 人` : '麦克风关闭'}</small></p></div><blockquote>{run.status === 'selecting' ? '等待教师开始讨论…' : answer?.text || '等待本组回答…'}</blockquote></article> })}</div></section>
}

function App() {
  const [view, setView] = useState(() => new URLSearchParams(location.search).get('view') || 'console')
  const [student, setStudent] = useState(null)
  const [students, setStudents] = useStoredState('wh-students', seedStudents)
  useEffect(() => { setStudents(migrateStudents) }, [])
  const [state, setState] = useStoredState('wh-classroom', { phase: 'before', slide: 0, activity: 'screen', resourcesReady: false })
  const [messages, setMessages] = useStoredState('wh-messages', initialMessages)
  const channel = useMemo(() => 'BroadcastChannel' in window ? new BroadcastChannel('wh-classroom') : null, [])
  const updateState = next => setState(current => {
    const value = typeof next === 'function' ? next(current) : next
    if (value !== current) channel?.postMessage(value)
    return value
  })
  useEffect(() => { if (!channel) return; channel.onmessage = e => setState(e.data); return () => channel.close() }, [channel, setState])
  useEffect(() => {
    const run = state.questionRun
    if (!run || !['answering', 'analyzing'].includes(run.status)) return
    const due = run.status === 'answering' ? run.endAt : run.analyzeAt
    const timer = setTimeout(() => updateState(current => {
      const active = current.questionRun
      if (active?.id !== run.id || active.status !== run.status) return current
      const questionRun = run.status === 'answering'
        ? { ...active, status: 'analyzing', analyzeAt: Date.now() + 1800, answers: active.answers.map(x => ({ ...x, active: false })) }
        : { ...active, status: 'result', finishedAt: Date.now(), ...(active.kind === 'discussion' ? { summary: summarizeDiscussion(active) } : {}) }
      return { ...current, updatedAt: Date.now(), questionRun }
    }), Math.max(0, due - Date.now()))
    return () => clearTimeout(timer)
  }, [state.questionRun?.id, state.questionRun?.status, state.questionRun?.endAt, state.questionRun?.analyzeAt])
  const navigate = next => { setView(next); const url = next === 'console' ? location.pathname : `${location.pathname}?view=${next}`; history.replaceState({}, '', url) }
  if (view === 'teacher') return <Teacher onHome={() => navigate('console')} state={state} updateState={updateState} students={students} setStudents={setStudents} messages={messages} setMessages={setMessages} />
  if (view === 'student') return student ? <Student student={student} onHome={() => navigate('console')} state={state} updateState={updateState} /> : <StudentLogin students={students} onLogin={setStudent} onHome={() => navigate('console')} />
  if (view === 'screen') return <BigScreen onHome={() => navigate('console')} state={state} updateState={updateState} />
  return <Console onEnter={navigate} />
}

createRoot(document.getElementById('root')).render(<App />)
