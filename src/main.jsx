import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { createDiscussion, defaultDiscussionQuestion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion } from './discussion.js'
import { useVoiceCapture } from './useVoiceCapture.js'
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers } from './learning.js'
import { saveMaterials, useMaterial } from './materials.js'

const geographyTools = Object.entries(import.meta.glob('../tools/*.html', { query: '?raw', import: 'default' })).map(([path, load]) => ({ name: path.split('/').pop().replace(/\.html$/i, ''), load })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

const seedStudents = [
  { id: '08001', name: '林小满', score: 92, status: '已完成预习' },
  { id: '08002', name: '周子航', score: 88, status: '已完成预习' },
  { id: '08003', name: '陈雨桐', score: 96, status: '互动积极' },
]

const initialMessages = [
  { from: 'agent', text: '你好，我是课堂助教。请先上传教师课件，系统将模拟生成课前预习、课后复习及习题。', time: '09:28' },
]

const slideQuestions = [
  '雨水是怎样一步步塑造喀斯特地貌的？',
  '二氧化碳在石灰岩溶蚀过程中起了什么作用？',
  '钟乳石为什么会从洞顶向下生长？',
]

const icons = {
  book: '▤', cap: '◇', screen: '▣', robot: '✦', folder: '▱', upload: '↑', spark: '✣', users: '♙', pen: '✎', question: '?', chat: '◌', send: '➤', back: '←', next: '→', check: '✓', plus: '+', close: '×', download: '⇩', mic: '♫', camera: '▣', stop: '■'
}

function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

function Icon({ name }) { return <span className="icon" aria-hidden="true">{icons[name]}</span> }

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
  const [snapshotting, setSnapshotting] = useState(false)
  const [selectedTool, setSelectedTool] = useState(null)
  const pptCanvasRef = useRef(null)
  const boardCanvasRef = useRef(null)
  const materials = state.materials || []
  const material = materials.find(material => material.id === state.materialId) || materials[0]
  useEffect(() => { pptCanvasRef.current?.getContext('2d').clearRect(0, 0, 1400, 800) }, [material?.id])
  useEffect(() => {
    const run = state.questionRun
    if (run?.kind === 'discussion' && run.status === 'result') setMessages(messages => messages.some(message => message.discussionRunId === run.id) ? messages : [...messages, { from: 'agent', discussionRunId: run.id, text: `小组讨论已结束。${(run.summary || summarizeDiscussion(run)).title}，各组回答与讨论总结已展示。`, time: '刚刚' }])
  }, [state.questionRun?.id, state.questionRun?.status])

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
    ctx.strokeStyle = '#725cff'; ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.lineTo((e.clientX - rect.left) * c.width / rect.width, (e.clientY - rect.top) * c.height / rect.height); ctx.stroke()
  }

  const startQuestion = (source, question = slideQuestions[state.slide]) => {
    const id = Date.now(), run = { id, source, question, status: 'answering', startedAt: id, endAt: id + 15000, answers: [] }
    setPanel(null)
    setQuestionVisible(true)
    broadcast({ activity: 'question', question, questionRun: run }, source === 'snapshot' ? '已截取黑板内容并自动生成问题，学生开始作答。' : '已识别老师的语音提问，学生开始作答。')
    const mock = (delay, answer) => setTimeout(() => updateState(current => {
      const active = current.questionRun
      if (active?.id !== id || active.status !== 'answering' || active.answers.some(x => x.id === answer.id)) return current
      return { ...current, updatedAt: Date.now(), questionRun: { ...active, answers: [...active.answers, answer] } }
    }), delay)
    mock(2200, { id: '08002', name: '周子航', text: '雨水沿着石灰岩裂隙往下渗……', active: true })
    mock(5200, { id: '08003', name: '陈雨桐', text: '水里的二氧化碳会溶解碳酸钙，慢慢形成溶洞。', active: true })
  }
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || run.status !== 'answering') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analyzeAt: Date.now() + 1800, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  const dropQuestion = e => {
    e.preventDefault(); setDragTarget(false); setSnapshotting(true)
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
      {state.phase !== 'class' ? <button className="primary" disabled={!materials.length} onClick={startClass}>开始上课</button> : <><span className="live"><i />授课中</span><button className="danger" onClick={endClass}>结束上课</button></>}
      <button className="avatar">师</button>
    </>} />
    <div hidden={teacherPage !== 'classroom'} className={`teacher-grid ${agentCollapsed ? 'agent-collapsed' : ''}`}>
      <section className="stage-card">
        <div className="stage-status"><span><i /> {state.phase === 'before' ? '课前准备' : state.phase === 'after' ? '课堂已结束' : '课堂进行中'}</span><b>{selectedTool?.name || material?.name || '请上传课中课件'}</b></div>
        <div className={`slide ${dragTarget ? 'question-drop-target' : ''}`} onDragEnter={() => setDragTarget(true)} onDragOver={e => e.preventDefault()} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setDragTarget(false)} onDrop={dropQuestion}>
          <UploadedPresentation material={material} />
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
        <StageControls usingTool={!!selectedTool} phase={state.phase} onAsk={() => setPanel('question')} onDiscussion={prepareDiscussion} onReturn={() => { setSelectedTool(null); setPanel(null); setTeacherPage('classroom') }}>
          {drawMode && <button onClick={() => (drawMode === 'board' ? boardCanvasRef : pptCanvasRef).current.getContext('2d').clearRect(0, 0, 1400, 800)}>清空</button>}
          {['question', 'discussion'].includes(state.activity) && state.questionRun && !questionVisible && <button onClick={() => setQuestionVisible(true)}>{state.activity === 'discussion' ? '查看讨论' : '查看提问'}</button>}
        </StageControls>
      </section>
      <Agent messages={messages} input={input} setInput={setInput} send={send} onReport={() => setPanel('report')} collapsed={agentCollapsed} onToggle={() => setAgentCollapsed(value => !value)} />
    </div>
    {teacherPage === 'class' && <ClassManager students={students} setStudents={setStudents} />}
    {['materials', 'preview', 'review'].includes(teacherPage) && <MaterialWorkspace state={state} students={students} updateState={updateState} view={teacherPage} onView={view => { setPanel(null); setTeacherPage(view) }} />}
    {panel === 'report' && <Report state={state} messages={messages} onClose={() => setPanel(null)} />}
  </div>
}

function StageControls({ usingTool, phase, onAsk, onDiscussion, onReturn, children }) {
  return <div className="stage-controls">
    {!usingTool && <div className="stage-question-controls">{children}<div className="ask-control"><button className="ask-button" draggable title="点击录音，或拖到黑板快照出题" aria-label="发起提问" onDragStart={e => e.dataTransfer.setData('text/plain', 'question')} onClick={onAsk}><Icon name="question" /></button><small>点击录音 · 拖拽快照</small></div></div>}
    <div className="stage-right-actions">{!usingTool && <button disabled={phase !== 'class'} onClick={onDiscussion}><Icon name="chat" /> 小组讨论</button>}<button onClick={onReturn}><Icon name="back" /> 返回课中</button></div>
  </div>
}

function GeographyToolMenu({ onSelect, tools = geographyTools }) {
  return <details className="geography-tool-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus() } }}>
    <summary className="ghost teacher-nav"><Icon name="folder" /> 地理工具集 <span aria-hidden="true">▾</span></summary>
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
    {run.status === 'analyzing' ? <div className="teacher-analyzing"><span className="analysis-spinner" /><p>正在分析 {run.answers.filter(answer => answer.text.trim()).length} {isDiscussion ? '个小组' : '位学生'}的回答…</p></div> : run.status === 'result' ? isDiscussion ? <DiscussionSummary run={run} /> : <><div className="teacher-result-score"><strong>82%</strong><span>核心要点命中率</span></div><dl><div><dt>共性问题</dt><dd>对二氧化碳形成碳酸的中间过程描述不完整。</dd></div><div><dt>知识延展</dt><dd>强化“吸收 CO₂ → 形成碳酸 → 溶解碳酸钙”三步链路。</dd></div></dl></> : <><div className="teacher-answer-list">{isDiscussion ? run.groups.map(group => { const answer = run.answers.find(answer => answer.id === group.id); return <p key={group.id}><strong>{group.number}组 · {group.name}</strong><small>小组长：{group.leaderName}{answer?.active && ' · 正在录音'}</small><span>{answer?.text || '等待组长回答…'}</span></p> }) : run.answers.length ? run.answers.map(answer => <p key={answer.id}><strong>{answer.name}{answer.active && ' · 实时回答'}</strong><span>{answer.text}</span></p>) : <p className="empty">等待学生回答…</p>}</div><button onClick={onStop}><Icon name="stop" /> {isDiscussion ? '结束讨论并总结' : '停止作答并分析'}</button></>}
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
  useEffect(() => { const timer = setInterval(() => setElapsed(x => x + 1), 1000); return () => clearInterval(timer) }, [])
  const transcript = elapsed < 1 ? '正在聆听…' : elapsed < 3 ? '雨水是怎样一步步……' : '雨水是怎样一步步塑造喀斯特地貌的？'
  return <section className="canvas-recorder"><header className="modal-head"><h2>录制老师提问</h2><button className="circle-button" aria-label="关闭录音" onClick={onClose}><Icon name="close" /></button></header><div className="recorder"><div className="recording-mic"><Icon name="mic" /></div><p><i /> 正在录音　{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</p><div className="sound-wave">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ animationDelay: `${i * .06}s` }} />)}</div><small>AI 实时转写</small><blockquote>{transcript}</blockquote><button className="primary wide" onClick={() => onSubmit('雨水是怎样一步步塑造喀斯特地貌的？')}><Icon name="stop" /> 结束录音并发起提问</button></div></section>
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
  return <main className="management-page"><section className="management-card"><h1>班级管理</h1><p className="modal-sub">六年级三班 · {students.length} 名学生</p><div className="student-cards">{students.map(s => <button key={s.id} onClick={() => setEditing(s)}><span>{s.name.slice(-1)}</span><strong>{s.name}</strong><small>学号 {s.id}</small><em>{s.status}</em></button>)}<button className="add-student" onClick={() => setEditing({})}><Icon name="plus" /><strong>添加学生</strong><small>学号自动生成</small></button></div>
    {editing && <form className="inline-form" onSubmit={save}><label>学生姓名<input name="name" defaultValue={editing.name} autoFocus placeholder="请输入姓名" /></label><label>学号<input value={editing.id || nextId} disabled /></label><button className="primary">保存</button>{editing.id && <button type="button" className="danger-text" onClick={() => { setStudents(s => s.filter(x => x.id !== editing.id)); setEditing(null) }}>删除学生</button>}</form>}
  </section></main>
}

function MaterialWorkspace({ state, students, updateState, view = 'materials', onView }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const materials = state.materials || []
  const parse = current => {
    const pack = current.learningPack || createLearningPack()
    return { ...current, updatedAt: Date.now(), resourcesReady: true, learningPack: pack, learningAnswers: simulateLearningAnswers(pack, students, current.learningAnswers), discussionQuestion: current.discussionQuestion || defaultDiscussionQuestion }
  }
  const upload = async event => {
    const input = event.currentTarget, files = Array.from(input.files)
    if (!files.length) return
    setUploading(true); setError('')
    try {
      const uploaded = await saveMaterials(files)
      updateState(current => parse({ ...current, materials: [...(current.materials || []), ...uploaded], materialId: current.materialId || uploaded[0].id }))
    } catch (error) { setError(error.message || '资料保存失败，请重试。') }
    finally { input.value = ''; setUploading(false) }
  }
  return <main className="material-workspace"><section className="management-card">
    <small className="workspace-eyebrow">课前准备 · 教师原始资料</small><h1>准备今天的课堂</h1><p className="modal-sub">上传教师课件后自动模拟解析，生成预习、复习与习题；不会生成 PPT。</p>
    <div className="workspace-actions"><label className={`upload-button ${uploading ? 'disabled' : ''}`}><Icon name="upload" />{uploading ? '上传并解析中…' : '上传资料'}<input type="file" multiple disabled={uploading} accept=".ppt,.pptx,.pdf,.doc,.docx,.txt,.md,image/*" onChange={upload} /></label><button className="ghost" disabled={!materials.length || uploading} onClick={() => updateState(current => parse(current))}><Icon name="spark" /> 自动解析</button><button className={view === 'preview' ? 'primary' : 'ghost'} disabled={!state.learningPack} onClick={() => onView('preview')}>查看课前预习</button><button className="ghost" disabled={!materials.length || uploading} onClick={() => onView('classroom')}>查看课中展示</button><button className={view === 'review' ? 'primary' : 'ghost'} disabled={!state.learningPack} onClick={() => onView('review')}>查看课后复习</button></div>
    {error && <p className="voice-error" role="alert">{error}</p>}
    {materials.length ? <div className="file-list">{materials.map(material => <div key={material.id}><span className="file-icon"><Icon name="folder" /></span><p><strong>{material.name}</strong><small>教师上传 · 原始文件已保存本机</small></p><label className="material-select"><input type="radio" name="class-material" checked={(state.materialId || materials[0].id) === material.id} onChange={() => updateState(current => ({ ...current, materialId: material.id, updatedAt: Date.now() }))} />课中展示</label></div>)}</div> : <div className="upload-empty"><Icon name="upload" /><h2>先上传备课资料与课中课件</h2><p>PDF / 图片可直接展示；PPT / PPTX 请导出 PDF 后上传以便在 Canvas 中批注。</p></div>}
    {state.learningPack && view === 'materials' && <div className="parse-grid">{['课前预习 + 2 道习题', '课后复习 + 2 道习题', '小组讨论题', '教师原始课件 · 不生成 PPT'].map(text => <div key={text}><Icon name="check" /><strong>{text}</strong><small>模拟解析已完成</small></div>)}</div>}
    {['preview', 'review'].includes(view) && state.learningPack && <LearningOverview stage={view} state={state} students={students} />}
  </section></main>
}

function UploadedPresentation({ material }) {
  const asset = useMaterial(material?.id)
  if (!material) return <div className="presentation-empty"><h2>等待教师上传课中展示资料</h2><p>教师原始课件将在这里展示，不自动生成 PPT。</p></div>
  if (asset.error) return <div className="presentation-empty"><h2>{material.name}</h2><p role="alert">{asset.error}</p></div>
  if (!asset.url) return <div className="presentation-empty">正在读取原始课件…</div>
  if (material.type?.startsWith('image/')) return <img className="uploaded-image" src={asset.url} alt={material.name} />
  if (/\.pdf$/i.test(material.name) || material.type === 'application/pdf') return <iframe className="uploaded-document" src={asset.url} title={`课中展示：${material.name}`} />
  return <div className="presentation-empty"><Icon name="folder" /><h2>{material.name}</h2><p>此原始文件不能在浏览器内直接展示。请将课件导出为 PDF 或图片后重新上传。</p><a className="primary" href={asset.url} download={material.name}>下载原始资料</a></div>
}

function LearningOverview({ stage, state, students }) {
  const content = state.learningPack[stage]
  return <section className="learning-overview"><div className="learning-content"><small>AI 模拟生成 · {content.title}</small><h2>{content.title}任务</h2><p>{content.task}</p><ol>{content.exercises.map(exercise => <li key={exercise.id}><strong>{exercise.question}</strong><p>{exercise.options.join(' / ')}</p><small>参考答案：{exercise.answer}</small></li>)}</ol></div><h2>每位学生的答题情况</h2><div className="learning-students">{students.map(student => {
    const answers = state.learningAnswers?.[stage]?.[student.id] || {}
    const submitted = content.exercises.filter(exercise => answers[exercise.id])
    const correct = submitted.filter(exercise => answers[exercise.id].text === exercise.answer)
    return <article key={student.id}><header><strong>{student.name}</strong><small>学号 {student.id}</small><b>{submitted.length ? `${submitted.length}/${content.exercises.length} 已答 · ${correct.length} 题正确` : '未提交'}</b></header>{content.exercises.map((exercise, index) => <p key={exercise.id}><span>第 {index + 1} 题</span><strong>{answers[exercise.id]?.text || '未作答'}</strong><em>{answers[exercise.id] ? answers[exercise.id].text === exercise.answer ? '正确' : '待订正' : '待完成'}</em></p>)}<small>{submitted.length ? submitted.some(exercise => answers[exercise.id].simulated) ? '模拟答题记录' : '学生实际提交' : '等待学生提交'}</small></article>
  })}</div>{!students.length && <p>班级暂无学生。</p>}</section>
}

function LearningExercises({ stage, state, student, updateState }) {
  const content = state.learningPack?.[stage]
  const submitted = state.learningAnswers?.[stage]?.[student.id] || {}
  const [responses, setResponses] = useState(() => Object.fromEntries(Object.entries(submitted).map(([id, answer]) => [id, answer.text])))
  const [saved, setSaved] = useState(false)
  if (!content) return <div className="task-content"><h1>等待教师上传并解析资料</h1><p>生成后，{stage === 'preview' ? '课前预习' : '课后复习'}任务与习题会自动出现在这里。</p></div>
  return <div className="learning-exercises"><small>AI 模拟生成 · {content.title}</small><h1>{content.title}</h1><p>{content.task}</p><form onSubmit={event => { event.preventDefault(); updateState(current => submitLearningAnswers(current, stage, student.id, responses)); setSaved(true) }}>{content.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>{index + 1}. {exercise.question}</legend>{exercise.options.map(option => <label key={option}><input type="radio" name={exercise.id} required value={option} checked={responses[exercise.id] === option} onChange={() => { setResponses(current => ({ ...current, [exercise.id]: option })); setSaved(false) }} />{option}</label>)}{submitted[exercise.id] && <small>上次回答：{submitted[exercise.id].text} · {submitted[exercise.id].text === exercise.answer ? '正确' : '待订正'}{submitted[exercise.id].simulated && '（模拟记录）'}</small>}</fieldset>)}<button className="primary" disabled={content.exercises.some(exercise => !responses[exercise.id])}>{saved ? '已提交 ✓' : '提交习题'}</button>{saved && <p role="status">答题结果已同步给教师。</p>}</form></div>
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
  return <main className="login-page"><button className="back-home" onClick={onHome}><Icon name="back" /> 返回控制台</button><section className="login-card"><Brand /><div className="login-art"><span><Icon name="cap" /></span></div><h1>欢迎回到智慧课堂</h1><p>输入你的信息，开启今天的学习旅程</p><form onSubmit={submit}><label>姓名<input name="name" placeholder="例如：林小满" /></label><label>学号<input name="id" inputMode="numeric" placeholder="例如：08001" /></label>{error && <p className="form-error">{error}</p>}<button className="primary wide">进入课堂 <Icon name="next" /></button></form><small>演示账号：林小满 / 08001</small></section></main>
}

function Student({ student, onHome, state, updateState }) {
  const [tab, setTab] = useState(state.phase === 'after' ? 'review' : state.phase === 'before' ? 'preview' : 'class')
  const [answer, setAnswer] = useState('')
  const [sent, setSent] = useState(false)
  const [listening, setListening] = useState(false)
  useEffect(() => setTab(state.phase === 'after' ? 'review' : state.phase === 'before' ? 'preview' : 'class'), [state.phase])
  useEffect(() => { if (state.questionRun?.status !== 'answering' || state.questionRun?.kind === 'discussion') setListening(false) }, [state.questionRun?.status, state.questionRun?.kind])
  const activity = state.activity === 'question' ? { title: '课堂提问', text: state.question } : state.activity === 'discussion' ? { title: '小组讨论', text: state.discussion } : { title: '课堂进行中，请看大屏', text: '请观看教师上传的课中资料' }
  const toggleMic = () => {
    const run = state.questionRun
    if (!run || run.status !== 'answering' || run.kind === 'discussion') return
    const active = !listening
    setListening(active)
    updateState(current => {
      const currentRun = current.questionRun
      if (currentRun?.id !== run.id) return current
      const previous = currentRun.answers.find(x => x.id === student.id)
      const response = { id: student.id, name: student.name, text: previous?.text || '雨水会沿着石灰岩的裂隙向下渗透……', active }
      return { ...current, updatedAt: Date.now(), questionRun: { ...currentRun, answers: [...currentRun.answers.filter(x => x.id !== student.id), response] } }
    })
    if (active) setTimeout(() => updateState(current => {
      const currentRun = current.questionRun
      if (currentRun?.id !== run.id || currentRun.status !== 'answering') return current
      return { ...current, updatedAt: Date.now(), questionRun: { ...currentRun, answers: currentRun.answers.map(x => x.id === student.id ? { ...x, text: '雨水吸收二氧化碳后形成碳酸，沿裂隙渗透并慢慢溶解石灰岩。' } : x) } }
    }), 1300)
  }
  return <div className="app-shell student-page"><Topbar title={`学生端 · ${student.name}`} onHome={onHome} actions={<><span className="student-tag">{student.id}</span><button className="avatar">{student.name.slice(-1)}</button></>} />
    <nav className="student-tabs">{[['preview','课前预习'],['class','课堂互动'],['review','课后复习']].map(([id, label]) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>
    <div className="student-grid"><section className="activity-card"><div className="section-label">{tab === 'preview' ? '课前预习' : tab === 'review' ? '课后复习' : '课堂互动'}<span>{state.phase === 'class' ? '● 与教师端同步' : ''}</span></div>
      {tab === 'preview' && <LearningExercises key="preview" stage="preview" state={state} student={student} updateState={updateState} />}
      {tab === 'class' && state.activity === 'discussion' && state.questionRun?.kind === 'discussion' ? <StudentDiscussion key={state.questionRun.id} run={state.questionRun} student={student} updateState={updateState} /> : tab === 'class' && state.activity === 'question' && state.questionRun ? <StudentQuestion run={state.questionRun} student={student} listening={listening} onMic={toggleMic} /> : tab === 'class' && <div className="task-content"><span className="pulse-ring" /><small>{activity.title}</small><h1>{activity.text}</h1><p>{state.activity === 'screen' ? '教师发起互动后，题目或小组任务会自动出现在这里' : '说出你的想法，学伴会帮你组织表达。'}</p>{state.activity !== 'screen' && <div className="answer-box"><textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" /><button className="primary" onClick={() => answer.trim() && setSent(true)}>{sent ? '已提交 ✓' : '提交回答'}</button></div>}</div>}
      {tab === 'review' && <LearningExercises key="review" stage="review" state={state} student={student} updateState={updateState} />}
    </section><StudyBuddy student={student} /></div>
  </div>
}

function StudentDiscussion({ run, student, updateState }) {
  const group = run.groups.find(group => group.id === run.members[student.id])
  const isLeader = group?.leaderId === student.id
  const [text, setText] = useState(() => run.answers.find(answer => answer.id === group?.id)?.text || '')
  const voiceBase = useRef('')
  const voice = useVoiceCapture(transcript => setText(`${voiceBase.current}${transcript}`))
  const seconds = useCountdown(run.endAt || Date.now())
  useEffect(() => {
    if (isLeader && ['selecting', 'answering'].includes(run.status)) { voiceBase.current = text ? `${text}\n` : ''; voice.start() }
    return () => voice.stop()
  }, [group?.id, isLeader])
  useEffect(() => { if (!['selecting', 'answering'].includes(run.status)) voice.stop() }, [run.status])
  useEffect(() => {
    if (isLeader && run.status === 'answering') updateState(current => setGroupAnswer(current, run.id, student.id, group.id, text, voice.active))
  }, [run.status, group?.id, isLeader, text, voice.active])

  if (run.status === 'analyzing') return <div className="student-question-state"><span className="analysis-spinner" /><h1>小组回答分析中</h1><p>正在整理各组观点…</p></div>
  if (run.status === 'result') return <div className="student-discussion"><h2>{run.question}</h2><DiscussionSummary run={run} /></div>
  if (!group) return <div className="student-discussion"><small>小组讨论 · 选择小组</small><h1>请选择你要进入的小组</h1><p>{run.question}</p><div className="group-selection">{run.groups.map(group => <button key={group.id} onClick={() => updateState(current => joinDiscussion(current, run.id, student.id, group.id))}><span className="group-number">{group.number}组</span><strong>{group.name}</strong><span>小组长：{group.leaderName}</span><small>{group.leaderId === student.id ? '我是小组长 · 进入后自动申请录音' : '以组员身份进入 · 麦克风禁音'}</small></button>)}</div>{!run.groups.length && <p>等待教师配置小组。</p>}</div>
  const response = run.answers.find(answer => answer.id === group.id)
  return <div className="student-discussion">
    <div className="discussion-member-head"><strong>{group.number}组 · {group.name}</strong><span>小组长：{group.leaderName}</span><b>{isLeader ? '小组长' : '组员 · 禁音'}</b></div>
    <h2>{run.question}</h2><p>{run.status === 'selecting' ? '等待教师开始讨论；组长可先组织观点。' : `讨论进行中 · 剩余 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</p>
    {isLeader ? <>
      <button className={`student-mic ${voice.active ? 'listening' : ''}`} disabled={voice.pending} aria-label={voice.active ? '停止小组录音' : '开始小组录音'} onClick={() => { if (voice.active) voice.stop(); else { voiceBase.current = text ? `${text}\n` : ''; voice.start() } }}><Icon name={voice.active ? 'stop' : 'mic'} /></button>
      <strong className="mic-label">{voice.pending ? '等待麦克风授权…' : voice.active ? '正在录音 · 仅组长发言' : '录音已停止 · 可点击重新开启'}</strong>
      {voice.error && <p className="voice-error" role="status">{voice.error}</p>}
      <label className="discussion-label">本组回答 · 语音转写或文字补充<textarea value={text} onChange={event => { if (voice.active || voice.pending) voice.stop(); setText(event.target.value) }} placeholder="开始讨论后自动同步；手动修改会停止录音，以免转写覆盖文字" /></label>
      <p className="voice-privacy">录音文件仅保留本机；语音识别可能使用浏览器的在线服务。</p>
      {voice.audioUrl && <div className="recorded-audio"><audio controls src={voice.audioUrl} /><a href={voice.audioUrl} download={`小组${group.number}-讨论录音`}>下载本次录音（仅本机）</a></div>}
    </> : <><div className="muted-notice"><Icon name="stop" /><strong>麦克风已禁用</strong><p>由小组长代表本组发言，你可以查看本组的实时回答。</p></div><div className="my-transcript"><small>本组实时回答</small><p>{response?.text || '等待小组长发言…'}</p></div></>}
  </div>
}

function StudentQuestion({ run, student, listening, onMic }) {
  const seconds = useCountdown(run.endAt)
  const response = run.answers.find(x => x.id === student.id)
  if (run.status === 'analyzing') return <div className="student-question-state"><span className="analysis-spinner" /><h1>回答分析中</h1><p>学伴正在整理全班同学的回答…</p></div>
  if (run.status === 'result') return <div className="student-question-state"><span className="result-check"><Icon name="check" /></span><small>本次作答已完成</small><h1>谢谢你的回答</h1><p>老师正在带领大家查看共性问题与建议。</p></div>
  return <div className="student-question-state"><div className="student-timer"><span>请作答</span><b>{seconds}</b><small>秒</small></div><h1>{run.question}</h1><p>点击麦克风后直接说出你的答案</p><button className={`student-mic ${listening ? 'listening' : ''}`} onClick={onMic} aria-label={listening ? '停止回答' : '开始回答'}><Icon name={listening ? 'stop' : 'mic'} /></button><strong className="mic-label">{listening ? '正在收音 · 点击停止' : response ? '继续回答' : '点击开始回答'}</strong>{response && <div className="my-transcript"><small>我的回答{listening && '· 实时转写中'}</small><p>{response.text}</p></div>}</div>
}

function StudyBuddy({ student }) {
  const [input, setInput] = useState('')
  const [chat, setChat] = useState([{ from: 'bot', text: `${student.name}你好！关于“喀斯特地貌”，我会用提问帮你自己找到答案。` }])
  const send = text => { const value = (text || input).trim(); if (!value) return; setChat(c => [...c, { from: 'me', text: value }, { from: 'bot', text: '很好的思路！再想一步：水里的二氧化碳在其中起到了什么作用？' }]); setInput('') }
  return <aside className="buddy-card"><div className="agent-head"><span className="agent-icon"><Icon name="robot" /></span><div><h2>AI 学伴</h2><p><i /> 启发式引导 · 不直接给答案</p></div></div><div className="messages">{chat.map((m, i) => <div className={`message ${m.from}`} key={i}><p>{m.text}</p></div>)}</div><div className="quick"><button onClick={() => send('为什么会形成溶洞？')}>为什么会形成溶洞？</button><button onClick={() => send('引导我分析这道题')}>引导我分析</button></div><div className="composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="说说你的想法…" /><button onClick={() => send()}><Icon name="send" /></button></div></aside>
}

function BigScreen({ onHome, state, updateState }) {
  const material = state.materials?.find(material => material.id === state.materialId) || state.materials?.[0]
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || run.status !== 'answering') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analyzeAt: Date.now() + 1800, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  return <main className="big-screen"><header><Brand compact /><div><i /> {state.phase === 'class' ? '课堂进行中' : state.phase === 'after' ? '课堂已结束' : '课前准备'}　<span>{material?.name}</span></div><button onClick={onHome}><Icon name="close" /></button></header>{['question', 'discussion'].includes(state.activity) && state.questionRun ? <ScreenQuestion run={state.questionRun} onStop={stopQuestion} /> : <section className="screen-presentation"><UploadedPresentation material={material} /></section>}</main>
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
