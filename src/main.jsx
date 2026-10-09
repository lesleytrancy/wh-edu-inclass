import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, GraduationCap, Monitor, Bot, FolderOpen, Upload, Sparkles, Users, Pencil, CircleHelp, MessagesSquare, Send, ArrowLeft, ArrowRight, Check, Plus, X, Download, Mic, Camera, Square, ChevronDown, Bell, UserRound } from 'lucide-react'
import 'pptx-react-viewer/styles'
import './styles.css'
import { composeQuestions, matchingQuestions } from './question-bank.js'
import { seedStudents, migrateStudents } from './students.js'
import { createDiscussion, defaultDiscussionQuestion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion, submitDiscussionMinutes, formatDiscussionMinutes } from './discussion.js'
import { setQuestionAnswer } from './questions.js'
import { useVoiceCapture } from './useVoiceCapture.js'
import { simulateLearningAnswers, submitLearningAnswers, saveLearningFeedback, reportLearningFeedback, publishLearningPack, updateResourceContent, resourcesConfirmed, studentStageAvailable } from './learning.js'
import { saveMaterials, getMaterialFiles, syncLocalMaterials, useMaterial, getMaterialPage, turnMaterialPage, isPowerPoint, isPresentation } from './materials.js'
import { analyzeClassroomAnswers, askAgent, generateLearningPack, generateSnapshotQuestion, analyzeLearningAnswers } from './ai.js'
import ClassroomReport, { AILoading } from './ClassroomReport.jsx'
import { setPresentationPage } from './pptx-state.js'
import AnalysisReports, { StudentReport, PreLearningReport } from './AnalysisReports.jsx'
import { addReportNotification, reportNotifications } from './reports.js'
import { generateTeacherInsight, regenerateContent, resetDemoClassroom } from './ai.js'
import { clearDemoBrowserData } from './reset-demo.js'
import { captureStageSnapshot } from './snapshot.js'
import { teacherAccounts, findSection, updateSection, addSection, removeSection, loginTeacher, loadTeacherLibrary, saveTeacherLibrary, logoutTeacher } from './teacher-library.js'

const PowerPointPresentation = React.lazy(() => import('./PowerPointPresentation.jsx'))

class AppErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return <main className="presentation-empty"><h1>页面出现异常</h1><p role="alert">{this.state.error.message || '课堂页面加载失败'}</p><button className="primary" onClick={() => location.reload()}>刷新页面</button></main>
    return this.props.children
  }
}

const geographyTools = Object.entries(import.meta.glob('../tools/*.html', { query: '?raw', import: 'default' })).map(([path, load]) => ({ name: path.split('/').pop().replace(/\.html$/i, ''), load })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

const initialMessages = [
  { from: 'agent', text: '你好，我是课堂助教。请先上传教师课件，我会基于资料生成课前预习、课后复习及习题。', time: '09:28' },
]

const icons = {
  book: BookOpen, cap: GraduationCap, screen: Monitor, robot: Bot,
  folder: FolderOpen, upload: Upload, spark: Sparkles, users: Users,
  pen: Pencil, question: CircleHelp, chat: MessagesSquare, send: Send,
  back: ArrowLeft, next: ArrowRight, check: Check, plus: Plus, close: X,
  download: Download, mic: Mic, camera: Camera, stop: Square, down: ChevronDown, bell: Bell, user: UserRound,
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

function Console({ onEnter, onReset }) {
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const reset = async () => {
    if (resetting) return
    setResetting(true); setResetError('')
    try { await onReset() }
    catch (error) { setResetError(error.message || '重置失败，请重试。'); setResetting(false) }
  }
  return <main className="console-page">
    <div className="ambient one" /><div className="ambient two" />
    <section className="console-wrap">
      <Brand />
      <div className="version-pill">V2.0 · 三端联动控制台</div>
      <h1>武侯课教智慧课堂</h1>
      <p className="lead">连接教师、学生与教室大屏，让 AI 参与课堂的每个关键节点。</p>
      <div className="connection"><span />课堂同步通道已就绪 <small>本机与局域网 · 演示教室</small></div>
      <div className="portal-grid">
        <Portal icon="book" title="教师端" text="课件控制、发起答题、小组讨论、白板与 AI 助教" action="进入教师教学工作台" onClick={() => onEnter('teacher')} />
        <Portal icon="cap" title="学生端" text="接收课件提示、答题、讨论任务与查看学习记录" action="打开学生端" tone="blue" onClick={() => onEnter('student')} />
        <Portal icon="screen" title="教室大屏" text="同步课件、互动数据、小组讨论进度和课堂结论" action="打开大屏" tone="mint" onClick={() => onEnter('screen')} />
      </div>
      <p className="tip">提示：在不同标签页打开三个端，即可体验课堂状态实时同步</p>
      <button type="button" className="console-reset" disabled={resetting} onClick={reset}>{resetting ? '正在重置…' : '一键重置演示状态'}</button>
      {resetError && <p role="alert" className="voice-error">{resetError}</p>}
    </section>
  </main>
}

function Portal({ icon, title, text, action, tone = '', onClick }) {
  return <button className={`portal ${tone}`} onClick={onClick}>
    <span className="portal-icon"><Icon name={icon} /></span>
    <strong>{title}</strong><p>{text}</p><span className="portal-action">{action} <Icon name="next" /></span>
  </button>
}

function Topbar({ title, onHome, actions, collapsible = false }) {
  const [collapsed, setCollapsed] = useState(false)
  if (collapsible && collapsed) return <button type="button" className="topbar-reopen" aria-label="展开头部工具栏" aria-expanded="false" onClick={() => setCollapsed(false)}><Icon name="down" /> 展开头部工具栏</button>
  return <header className="topbar"><button className="brand-button" onClick={onHome}><Brand compact /></button><span className="crumb">/ {title}</span><div className="top-actions">{actions}</div>{collapsible && <button type="button" className="topbar-toggle" aria-label="收起头部工具栏" aria-expanded="true" onClick={() => setCollapsed(true)}><Icon name="back" /><span>收起头部工具栏</span></button>}</header>
}

function UserMenu({ user, onLogout }) {
  return <details className="user-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.open = false }}><summary className="avatar" aria-label="用户信息"><Icon name="user" /></summary><div className="user-popover"><strong>{user.name}</strong><p>{user.username ? `教师账号：${user.username}` : `学生学号：${user.id}`}</p><button className="ghost" onClick={onLogout}>退出登录</button></div></details>
}
function TeacherNotifications({ state, teacher, updateState, onOpen }) {
  const [open, setOpen] = useState(false)
  const notifications = reportNotifications(state)
  const readIds = state.reportNotificationReads?.[teacher.username] || []
  const unread = notifications.some(item => !readIds.includes(item.id))
  return <div className="student-notifications"><button className="notification-button" aria-label="报告消息通知" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) updateState(current => ({ ...current, reportNotificationReads: { ...current.reportNotificationReads, [teacher.username]: notifications.map(item => item.id) } })) }}><Icon name="bell" />{unread && <i />}</button>{open && <div className="notification-panel"><strong>报告消息</strong>{notifications.length ? notifications.map(item => <button key={item.id} onClick={() => { onOpen(item.tab, item.sectionId); setOpen(false) }}><b>{item.title}</b><small>{new Date(item.sentAt).toLocaleString('zh-CN')}</small></button>) : <p>暂无新消息</p>}</div>}</div>
}

function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><div className="modal-head"><h2>{title}</h2><button type="button" className="circle-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close" /></button></div>{children}</section></div>
}

function Teacher({ onHome, onLogout, teacher, library, setLibrary, libraryError, state, updateState, students, setStudents, messages, setMessages, messagesClearedAt, setMessagesClearedAt }) {
  const [panel, setPanel] = useState(null)
  const [teacherPage, setTeacherPage] = useState('materials')
  const [reportTab, setReportTab] = useState('pre')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const openReports = (tab = 'pre') => { setReportTab(tab); setTeacherPage('reports') }
  const [questionVisible, setQuestionVisible] = useState(true)
  const [agentCollapsed, setAgentCollapsed] = useState(false)
  const [input, setInput] = useState('')
  const [agentBusy, setAgentBusy] = useState(false)
  const [drawMode, setDrawMode] = useState(null)
  const [dragTarget, setDragTarget] = useState(false)
  const [draggingQuestion, setDraggingQuestion] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [startingClass, setStartingClass] = useState(false)
  const presentationRef = useRef(null)
  const [presentationHeader, setPresentationHeader] = useState(null)
  const [selectedTool, setSelectedTool] = useState(null)
  const [toolGeneratorOpen, setToolGeneratorOpen] = useState(false)
  const [generatedTools, setGeneratedTools] = useStoredState('wh-generated-geography-tools', [])
  const pptCanvasRef = useRef(null)
  const boardCanvasRef = useRef(null)
  const pageAnnotations = useRef(new Map())
  const annotationDirty = useRef(false)
  const materials = state.materials || []
  const material = materials.find(material => material.id === state.materialId && isPresentation(material))
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
    if (run?.kind === 'discussion' && run.status === 'result' && (run.finishedAt || 0) > messagesClearedAt) setMessages(messages => messages.some(message => message.discussionRunId === run.id) ? messages : [...messages, { from: 'agent', discussionRunId: run.id, text: `小组讨论已结束。${(run.summary || summarizeDiscussion(run)).title}，各组回答与讨论总结已展示。`, time: '刚刚' }])
  }, [state.questionRun?.id, state.questionRun?.status, messagesClearedAt])

  const insightInput = JSON.stringify({ feedback: state.learningFeedback, utterances: state.studentUtterances, run: state.questionRun, minutes: state.discussionMinutes })
  useEffect(() => {
    const context = JSON.parse(insightInput)
    const feedback = Object.values(context.feedback || {}).flatMap(stage => Object.values(stage)).filter(item => item.reportedAt > messagesClearedAt)
    const utterances = (context.utterances || []).filter(item => item.at > messagesClearedAt)
    const answers = (context.run?.answers || []).filter(item => item.text?.trim())
    if (!feedback.length && !utterances.length && !answers.length && !Object.keys(context.minutes || {}).length) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await generateTeacherInsight({ feedback: feedback.map(item => ({ studentId: item.studentId, items: item.items })), utterances, question: context.run?.question, answers, minutes: context.minutes })
        if (!cancelled) setMessages(current => [...current.filter(item => !item.teacherInsight), { from: 'agent', teacherInsight: true, text: `AI 学伴分析\n${result.conclusion}\n教学建议：\n${result.suggestions.join('\n')}`, time: '刚刚' }])
      } catch (error) {
        if (!cancelled) setMessages(current => [...current.filter(item => !item.teacherInsight), { from: 'agent', teacherInsight: true, text: error.message, time: '刚刚' }])
      }
    }, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [insightInput, messagesClearedAt])

  useEffect(() => {
    const minutes = Object.values(state.discussionMinutes || {})
    if (!minutes.length) return
    setMessages(current => {
      const additions = minutes.filter(item => item.submittedAt > messagesClearedAt && !current.some(message => message.discussionMinutesId === `${item.runId}:${item.groupId}:${item.id}`)).map(item => ({
        from: 'agent', discussionMinutesId: `${item.runId}:${item.groupId}:${item.id}`, text: `收到小组会议纪要\n${item.text}`,
        time: new Date(item.submittedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }))
      return additions.length ? [...current, ...additions] : current
    })
  }, [state.discussionMinutes, messagesClearedAt])

  const broadcast = (patch, agentText) => {
    const next = { ...state, ...patch, updatedAt: Date.now() }
    updateState(next)
    if (agentText) setMessages(m => [...m, { from: 'agent', text: agentText, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }])
  }

  const startClass = async () => {
    if (startingClass) return
    setStartingClass(true)
    try {
    const savedMaterial = await presentationRef.current?.saveIfDirty()
    setPanel(null)
    setSelectedTool(null)
    setTeacherPage('classroom')
    broadcast({ ...(savedMaterial ? { materials: state.materials.map(item => item.id === savedMaterial.id ? savedMaterial : item) } : {}), classStartedAt: state.phase === 'class' ? state.classStartedAt : Date.now(), classEndedAt: null, ...(state.phase === 'after' ? { questionHistory: [], activityHistory: [], studentUtterances: [], discussionMinutes: {} } : {}), phase: 'class', activity: 'screen', questionRun: null, classroomReport: null, ...(state.phase === 'after' ? { slide: 0 } : {}) }, '课程已开始。全班预习完成率 100%，重点关注“碳酸溶蚀”的理解。')
    } catch (error) { setSnapshotError(`课件保存失败，尚未开始上课：${error.message}`) } finally { setStartingClass(false) }
  }
  const endClass = () => {
    setPanel('report')
    broadcast({ classEndedAt: Date.now(), phase: 'after', activity: 'review', questionRun: null }, '课堂已结束，正在生成课堂诊断报告。')
  }
  const send = async () => {
    const message = input.trim()
    if (!message || agentBusy) return
    setMessages(m => [...m, { from: 'me', text: message, time: '刚刚' }])
    setInput('')
    setAgentBusy(true)
    try {
      const result = await askAgent({ message, role: 'teacher' })
      setMessages(m => [...m, { from: 'agent', text: result.answer, sourceRefs: result.sourceRefs, time: '刚刚' }])
    } catch {
      setMessages(m => [...m, { from: 'agent', text: 'AI 服务暂不可用，请重试。', time: '刚刚' }])
    } finally { setAgentBusy(false) }
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

  const startQuestion = (source, question) => {
    if (!question?.trim()) return
    const id = Date.now(), run = { id, source, question, status: 'answering', startedAt: id, endAt: id + 5 * 60 * 1000, answers: [] }
    setPanel(null)
    setQuestionVisible(true)
    broadcast({ activity: 'question', question, questionRun: run }, source === 'snapshot' ? '已截取黑板内容并自动生成问题，学生开始作答。' : '已识别老师的语音提问，学生开始作答。')

  }
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || !['answering', 'result'].includes(run.status)) return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analysisError: null, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  const dropQuestion = async e => {
    e.preventDefault(); setDragTarget(false); setDraggingQuestion(false)
    if (e.dataTransfer.getData('text/plain') !== 'question') return
    setSnapshotting(true); setSnapshotError('')
    try {
      const stage = e.currentTarget
      const overlay = drawMode === 'board' ? boardCanvasRef.current : pptCanvasRef.current
      const imageData = await captureStageSnapshot(stage, overlay)
      const result = await generateSnapshotQuestion({ imageData, materialName: material?.name || '课堂白板', page: materialPage })
      startQuestion('snapshot', result.question)
    } catch (error) {
      const message = error.message || '快照解析失败，请重试。'
      setSnapshotError(message)
      setMessages(current => [...current, { from: 'agent', text: message, time: '刚刚' }])
    } finally { setSnapshotting(false) }
  }
  const prepareDiscussion = () => {
    setPanel(null)
    setQuestionVisible(true)
    broadcast({ activity: 'discussion', questionRun: createDiscussion(students, state.publishedDiscussionQuestion || state.discussionQuestion || defaultDiscussionQuestion) }, '讨论题已就绪，学生可以选择小组；请编辑问题后点击开始讨论。')
  }
  const editDiscussion = question => updateState(current => {
    const run = current.questionRun
    if (run?.kind !== 'discussion' || run.status !== 'selecting') return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, question } }
  })

  return <div className="app-shell teacher-page">
    <Topbar collapsible title={teacherPage === 'class' ? '班级管理' : teacherPage === 'classroom' ? '教师工作台' : teacherPage === 'reports' ? '分析报告' : '资源管理'} onHome={onHome} actions={<>
      <button className="ghost teacher-nav" onClick={() => setTeacherPage('class')}><Icon name="users" /> 班级管理</button>
      <button className="ghost teacher-nav" onClick={() => setTeacherPage('materials')}><Icon name="folder" /> 资源管理</button>
      <GeographyToolMenu generatedNames={generatedTools} onGenerate={() => setToolGeneratorOpen(true)} onSelect={tool => { setTeacherPage('classroom'); setSelectedTool(tool) }} />
      {state.phase !== 'class' ? <button className="primary" disabled={!material || startingClass} onClick={startClass}>{startingClass ? '正在准备课件…' : '开始上课'}</button> : <><span className="live"><i />授课中</span><button className="danger" onClick={endClass}>结束上课</button></>}
      <UserMenu user={teacher} onLogout={onLogout} /><TeacherNotifications state={state} teacher={teacher} updateState={updateState} onOpen={(tab, sectionId) => { if (sectionId && findSection(library, sectionId)) setLibrary(current => ({ ...current, selectedSectionId: sectionId })); openReports(tab) }} />
    </>} />
    {libraryError && <p className="teacher-save-error" role="alert">{libraryError}</p>}
    <div className={`teacher-global-grid ${agentCollapsed ? 'agent-collapsed' : ''}`}><div className="teacher-main-content">
    <div hidden={teacherPage !== 'classroom'} className={`teacher-grid ${agentCollapsed ? 'agent-collapsed' : ''}`}>
      <section className="stage-card">
        <div className="stage-status"><span><i /> {state.phase === 'before' ? '课前准备' : state.phase === 'after' ? '课堂已结束' : '课堂进行中'}</span>{!isPowerPoint(material) || selectedTool ? <b>{selectedTool?.name || material?.name || '请上传课中课件'}</b> : null}<div className="ppt-header-slot" hidden={!isPowerPoint(material) || !!selectedTool} ref={setPresentationHeader} /></div>
        <div className={`slide ${dragTarget ? 'question-drop-target' : ''}`} onDragEnter={() => setDragTarget(true)} onDragOver={e => e.preventDefault()} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setDragTarget(false)} onDrop={dropQuestion}>
          <UploadedPresentation material={material} phase={state.phase} presentationRef={presentationRef} headerTarget={presentationHeader} onSavePresentation={saved => setLibrary(current => updateSection(current, state.sectionId, section => ({ ...section, materials: section.materials.map(item => item.id === saved.id ? saved : item) })))} onPageChange={(page, total) => updateState(current => setPresentationPage(current, material.id, page, total))} page={materialPage} onTurn={(direction, total) => updateState(current => turnMaterialPage(current, material.id, direction, total))} showControls={!selectedTool && drawMode !== 'board'} />
          {draggingQuestion && <div className="question-drop-layer" />} 
          <canvas ref={pptCanvasRef} width="1400" height="800" className={`canvas annotation ${drawMode === 'ppt' ? 'active' : ''}`} onPointerDown={beginDraw} onPointerMove={draw} onPointerUp={e => e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId)} />
          <canvas ref={boardCanvasRef} width="1400" height="800" className={`canvas whiteboard ${drawMode === 'board' ? 'active' : ''}`} onPointerDown={beginDraw} onPointerMove={draw} onPointerUp={e => e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId)} />
          {drawMode === 'board' && <div className="whiteboard-title"><Icon name="pen" /> 空白板 · 独立书写</div>}
          <button className={`whiteboard-toggle ${drawMode === 'board' ? 'open' : ''}`} onClick={() => setDrawMode(mode => mode === 'board' ? null : 'board')} aria-label={drawMode === 'board' ? '收起白板' : '展开白板'}><Icon name={drawMode === 'board' ? 'next' : 'back'} /><span>{drawMode === 'board' ? '收起白板' : '展开白板'}</span></button>
          <button className={`annotation-toggle ${drawMode === 'ppt' ? 'selected' : ''}`} title={drawMode === 'ppt' ? '关闭批注' : 'PPT 批注'} aria-label={drawMode === 'ppt' ? '关闭批注' : 'PPT 批注'} onClick={() => setDrawMode(mode => mode === 'ppt' ? null : 'ppt')}><Icon name={drawMode === 'ppt' ? 'close' : 'pen'} /></button>
          {dragTarget && <div className="drop-hint"><Icon name="camera" /><b>松开截取黑板</b><span>AI 将根据快照自动生成问题</span></div>}
          {snapshotting && <div className="snapshot-flash"><Icon name="camera" /> 已截取黑板，正在生成问题…</div>}
          {snapshotError && !snapshotting && <div className="snapshot-error" role="alert">{snapshotError}<button onClick={() => setSnapshotError('')}>关闭</button></div>}
          {teacherPage === 'classroom' && ['question', 'discussion'].includes(state.activity) && state.questionRun && questionVisible && panel !== 'question' && (state.questionRun.status === 'selecting' ? <DiscussionSetup run={state.questionRun} onEdit={editDiscussion} onStart={() => updateState(current => startDiscussion(current, state.questionRun.id))} onClose={() => setQuestionVisible(false)} /> : <TeacherQuestion run={state.questionRun} onStop={stopQuestion} onClose={() => setQuestionVisible(false)} />)}
          {panel === 'question' && <QuestionRecorder onClose={() => setPanel(null)} onSubmit={question => startQuestion('voice', question)} />}
          {selectedTool && <GeographyTools key={selectedTool.name} selected={selectedTool} />}
        </div>
        <StageControls hideAsk={panel === 'question' || (questionVisible && !!state.questionRun && ['question', 'discussion'].includes(state.activity))} usingTool={!!selectedTool} phase={state.phase} onAsk={() => { setQuestionVisible(true); setPanel('question') }} onDiscussion={prepareDiscussion} onDragStart={() => setDraggingQuestion(true)} onDragEnd={() => { setDraggingQuestion(false); setDragTarget(false) }} onClear={drawMode ? () => { (drawMode === 'board' ? boardCanvasRef : pptCanvasRef).current?.getContext('2d').clearRect(0, 0, 1400, 800); if (drawMode === 'ppt') annotationDirty.current = false } : null} clearLabel={drawMode === 'board' ? '清空白板' : '清空 PPT 标注'} onReturn={() => { setSelectedTool(null); setPanel(null); setDrawMode(null); setQuestionVisible(false); setTeacherPage('classroom') }}>
          {['question', 'discussion'].includes(state.activity) && state.questionRun && !questionVisible && <button onClick={() => setQuestionVisible(true)}><Icon name="chat" />{state.activity === 'discussion' ? '查看讨论' : '查看提问'}</button>}
        </StageControls>
      </section>

    </div>
    {teacherPage === 'class' && <ClassManager students={students} setStudents={setStudents} onReports={() => openReports()} onStudent={setSelectedStudent} />}
    {['materials', 'preview', 'discussion', 'review', 'pre-report'].includes(teacherPage) && <MaterialWorkspace state={state} students={students} updateState={updateState} library={library} setLibrary={setLibrary} view={teacherPage} onView={view => { setPanel(null); setTeacherPage(view) }} />}
    {teacherPage === 'reports' && <AnalysisReports state={state} students={students} tab={reportTab} onTab={setReportTab} />}
    </div>
      <Agent messages={messages} input={input} setInput={setInput} send={send} onClear={() => { setMessagesClearedAt(Date.now()); setMessages([]) }} onReport={() => setPanel('report')} collapsed={agentCollapsed} onToggle={() => setAgentCollapsed(value => !value)} />
    </div>
    {selectedStudent && <Modal title="学生学情分析" onClose={() => setSelectedStudent(null)}><StudentReport state={state} student={selectedStudent} /></Modal>}
    {toolGeneratorOpen && <GeographyToolGenerator onClose={() => setToolGeneratorOpen(false)} onGenerated={name => setGeneratedTools(current => [...new Set([...current, name])])} />}
    {panel === 'report' && <Report state={state} onGenerated={report => updateState(current => addReportNotification({ ...current, classroomReport: report }, 'quality', '课堂质量报告已生成'))} onClose={() => setPanel(null)} />}
  </div>
}

function StageControls({ hideAsk = false, usingTool, phase, onAsk, onDiscussion, onReturn, onDragStart, onDragEnd, onClear, clearLabel, children }) {
  return <div className="stage-controls">
    {!usingTool && <div className="stage-left-actions">{children}</div>}
    {!usingTool && !hideAsk && <div className="stage-question-controls"><div className="ask-control"><button className="ask-button" draggable title="点击录音，或拖到黑板快照出题" aria-label="发起提问" onDragStart={e => { e.dataTransfer.setData('text/plain', 'question'); onDragStart?.() }} onDragEnd={onDragEnd} onClick={onAsk}><Icon name="question" /></button><small>点击录音 · 拖拽快照</small></div></div>}
    <div className="stage-right-actions">{!usingTool && <button disabled={phase !== 'class'} onClick={onDiscussion}><Icon name="chat" /> 小组讨论</button>}{!usingTool && onClear && <button onClick={onClear}>{clearLabel}</button>}<button onClick={onReturn}><Icon name="back" /> 返回课中</button></div>
  </div>
}

function GeographyToolMenu({ onSelect, onGenerate, generatedNames = [], tools = geographyTools }) {
  const visibleTools = tools.filter(tool => tool.name !== '喀斯特地貌' || generatedNames.includes(tool.name))
  return <details className="geography-tool-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus() } }}>
    <summary className="ghost teacher-nav"><Icon name="folder" /> 工具集 <Icon name="down" /></summary>
    <div className="geography-tool-options"><button className="geography-generate" onClick={event => { event.currentTarget.closest('details').open = false; onGenerate() }}><Icon name="spark" /> 智能生成</button>{visibleTools.map(tool => <button key={tool.name} onClick={event => { event.currentTarget.closest('details').open = false; onSelect(tool) }}>{tool.name}</button>)}{!visibleTools.length && <p>暂无 H5 工具</p>}</div>
  </details>
}

function GeographyToolGenerator({ onClose, onGenerated }) {
  const [requirement, setRequirement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const submit = event => {
    event.preventDefault()
    const request = requirement.trim()
    if (!request || loading) return
    if (!/喀斯特|karst/i.test(request)) { setError('当前演示支持“喀斯特地貌”工具，请输入相关需求。'); return }
    setError(''); setLoading(true)
    timer.current = setTimeout(() => { onGenerated('喀斯特地貌'); setLoading(false); onClose() }, 1200)
  }
  return <Modal title="智能生成地理工具" onClose={onClose}><form className="geography-generator" onSubmit={submit}><p>描述需要的工具，生成后会加入地理工具集。</p><label htmlFor="geography-tool-request">工具需求</label><textarea id="geography-tool-request" value={requirement} disabled={loading} onChange={event => { setRequirement(event.target.value); setError('') }} placeholder="例如：喀斯特地貌" rows={4} />{error && <p role="alert" className="voice-error">{error}</p>}{loading && <div role="status" className="geography-generating"><span className="analysis-spinner" /> 正在生成喀斯特地貌工具…</div>}<button className="primary" disabled={loading || !requirement.trim()}>{loading ? '生成中…' : '生成工具'}</button></form></Modal>
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
    {run.status === 'analyzing' ? <div className="teacher-analyzing"><span className="analysis-spinner" /><p>正在分析 {run.answers.filter(answer => answer.text.trim()).length} {isDiscussion ? '个小组' : '位学生'}的回答…</p></div> : run.status === 'result' ? isDiscussion ? <DiscussionSummary run={run} /> : <QuestionAnalysis run={run} /> : <><div className="teacher-answer-list">{isDiscussion ? run.groups.map(group => { const answer = run.answers.find(answer => answer.id === group.id); return <p key={group.id}><strong>{group.number}组 · {group.name}</strong><small>小组长：{group.leaderName}{answer?.active && ' · 正在录音'}</small><span>{answer?.text || '等待回答…'}</span></p> }) : run.answers.length ? run.answers.map(answer => <p key={answer.id}><strong>{answer.name}{answer.active && ' · 实时回答'}</strong><span>{answer.text}</span></p>) : <p className="empty">等待学生回答…</p>}</div><button onClick={onStop}><Icon name="stop" /> {isDiscussion ? '结束讨论并总结' : '停止作答并分析'}</button></>}
    {run.status === 'result' && !run.analysis && <button onClick={onStop}>重新分析回答</button>}
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
    <button className="primary" disabled={!run.question.trim() || !run.groups.length || voice.pending} onClick={() => { voice.stop(); onStart() }}>开始讨论 · 20 分钟</button>
  </section>
}

function QuestionAnalysis({ run }) {
  const result = run.analysis
  return <div className="question-analysis">{result ? <><h3>总体结论</h3><p>{result.summary}</p><dl><div><dt>共性问题</dt><dd>{result.commonIssue}</dd></div><div><dt>教学建议</dt><dd>{result.extension}</dd></div></dl></> : <p>{run.analysisError || '此记录尚无 AI 分析，请发起新的课堂提问。'}</p>}</div>
}

function DiscussionSummary({ run }) {
  const summary = run.summary || summarizeDiscussion(run)
  return <div className="discussion-summary"><h3>讨论总结</h3>{run.analysis && <QuestionAnalysis run={run} />}{run.analysisError && <p role="alert">{run.analysisError}</p>}<p><strong>{summary.title}</strong></p><p>{summary.text}</p><dl>{summary.groups.map(group => <div key={group.id}><dt>{group.number}组 · {group.name}　小组长：{group.leaderName}</dt><dd>{group.answer}</dd></div>)}</dl></div>
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

function Agent({ messages, input, setInput, send, onClear, onReport, collapsed, onToggle }) {
  if (collapsed) return <aside className="agent-rail"><button onClick={onToggle} aria-label="展开课堂助教"><Icon name="back" /><Icon name="robot" /><span>课堂助教 Agent</span></button></aside>
  return <aside className="agent-card"><div className="agent-head"><span className="agent-icon"><Icon name="robot" /></span><div><h2>课堂助教 Agent</h2><p><i /> 在线 · 正在跟随课堂</p></div><button className="ghost agent-clear" disabled={!messages.length} onClick={onClear}>清空</button><button className="circle-button agent-toggle" aria-label="收起课堂助教" onClick={onToggle}><Icon name="next" /></button></div>
    <div className="agent-summary"><Icon name="spark" /> 当前课堂参与度 <strong>92%</strong></div>
    <div className="messages">{messages.map((m, i) => <div key={i} className={`message ${m.from}`}><p>{m.text}</p>{m.sourceRefs?.length > 0 && <small>依据：{m.sourceRefs.map(ref => ref.name).join('、')}</small>}<small>{m.time}</small></div>)}</div>
    <div className="quick"><button onClick={onReport}>生成课堂报告</button><button onClick={() => setInput('总结学生动态')}>总结学生动态</button></div>
    <div className="composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="询问课堂或学生学习动态…" /><button onClick={send}><Icon name="send" /></button></div>
  </aside>
}

function ClassManager({ students, setStudents, onReports, onStudent }) {
  const [editing, setEditing] = useState(null)
  const [calling, setCalling] = useState(false)
  const [highlightedId, setHighlightedId] = useState(null)
  const lastId = useRef(null)
  useEffect(() => {
    if (!calling || !students.length) return
    const timer = setInterval(() => {
      const candidates = students.filter(student => student.id !== lastId.current)
      const pool = candidates.length ? candidates : students
      const id = pool[Math.floor(Math.random() * pool.length)].id
      lastId.current = id
      setHighlightedId(id)
    }, 100)
    return () => clearInterval(timer)
  }, [calling, students])
  const toggleCalling = () => {
    if (!students.length) return
    if (calling) { setCalling(false); return }
    setEditing(null)
    const id = students[Math.floor(Math.random() * students.length)].id
    lastId.current = id; setHighlightedId(id); setCalling(true)
  }
  const nextId = String(Math.max(8000, ...students.map(s => Number(s.id))) + 1).padStart(5, '0')
  const save = e => {
    e.preventDefault(); const name = new FormData(e.currentTarget).get('name').trim(); if (!name) return
    setStudents(s => editing?.id ? s.map(x => x.id === editing.id ? { ...x, name } : x) : [...s, { id: nextId, name, score: 0, status: '待完成预习' }]); setEditing(null)
  }
  return <main className="management-page"><section className="management-card"><div className="management-heading"><h1>班级管理</h1><button className="primary" onClick={onReports}><Icon name="book" />分析报告</button></div><p className="modal-sub">六年级三班 · {students.length} 名学生</p><div className="student-cards class-student-grid">{students.map(s => <article key={s.id} className={`class-student-card ${highlightedId === s.id ? 'rollcall-highlight' : ''}`}><button type="button" className="student-card-edit" aria-label={`编辑${s.name}的信息`} title="编辑学生信息" onClick={() => { setCalling(false); setEditing(s) }}><Icon name="pen" /></button><button type="button" className="student-card-profile" onClick={() => { setCalling(false); onStudent(s) }}><span>{s.name.slice(-1)}</span><strong>{s.name}</strong><small>学号 {s.id}{s.group && ` · ${s.group}组`}</small><em>{s.status}</em></button></article>)}<button className="add-student" onClick={() => { setCalling(false); setEditing({}) }}><Icon name="plus" /><strong>添加学生</strong><small>学号自动生成</small></button></div>

    {editing && <form key={editing.id || 'new-student'} className="inline-form" onSubmit={save}><label>学生姓名<input name="name" defaultValue={editing.name} autoFocus placeholder="请输入姓名" /></label><label>学号<input value={editing.id || nextId} disabled /></label><button className="primary">保存</button>{editing.id && <button type="button" className="danger-text" onClick={() => { setStudents(s => s.filter(x => x.id !== editing.id)); setEditing(null); if (highlightedId === editing.id) setHighlightedId(null) }}>删除学生</button>}<button type="button" className="ghost" onClick={() => setEditing(null)}>取消</button></form>}
  </section><button type="button" className={`rollcall-button ${calling ? 'rolling' : ''}`} disabled={!students.length} onClick={toggleCalling}><Icon name="users" />{calling ? '停止点名' : '点名回答'}</button></main>
}

function MaterialWorkspace({ state, students, updateState, library, setLibrary, view: requestedView = 'materials', onView }) {
  const view = requestedView === 'materials' && state.learningPack ? 'preview' : requestedView
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const section = findSection(library)
  const materials = section?.materials || []
  const selected = state.analysisMaterialIds || []
  const allConfirmed = resourcesConfirmed(state)
  const packSent = allConfirmed && !!state.publishedLearningPack && JSON.stringify(state.learningPack) === JSON.stringify(state.publishedLearningPack) && JSON.stringify(state.discussions || []) === JSON.stringify(state.publishedDiscussions || []) && state.discussionQuestion === state.publishedDiscussionQuestion
  const parse = async () => {
    if (!selected.length || analyzing) return
    setAnalyzing(true); setError('')
    let result, pack, discussionQuestion, sourceRefs = [], fallback = false
    try {
      const files = await getMaterialFiles(materials.filter(material => selected.includes(material.id)))
      result = await generateLearningPack(files)
      if (![result?.preview, result?.review].every(content => content?.title && Array.isArray(content.tasks) && content.tasks.length >= 3)) throw new Error('AI 返回的学习任务不足三条')
      pack = { preview: { ...result.preview, exercises: [] }, review: { ...result.review, exercises: [] } }
      discussionQuestion = result.discussionQuestion || defaultDiscussionQuestion
      sourceRefs = result.sourceRefs || []
      fallback = !!result.fallback
    } catch (reason) {
      setError(reason.message || 'AI 服务暂不可用，请重试。'); setAnalyzing(false); return
    }
    updateState(current => ({ ...current, updatedAt: Date.now(), resourcesReady: true, resourceConfirmations: {}, learningPack: pack, discussions: result.discussions || [], questionBank: [], learningAnswers: simulateLearningAnswers(pack, students, current.learningAnswers), discussionQuestion, sourceRefs, sourceImages: result.sourceImages || [], aiFallback: fallback, parsedMaterialIds: selected, reportNotifications: addReportNotification(current, 'pre', '课前报告已生成').reportNotifications }))
    setAnalyzing(false); onView('preview')
  }
  const regenerate = async () => {
    if (analyzing) return
    setAnalyzing(true); setError('')
    updateState(current => updateResourceContent(current, view))
    try {
      const materialIds = (state.sourceRefs || []).map(ref => ref.resourceId).filter(Boolean)
      if (view === 'discussion') {
        const existing = state.discussions?.length ? state.discussions : [{ id: crypto.randomUUID(), question: state.discussionQuestion }]
        const results = await Promise.all(existing.map(item => regenerateContent('discussion', item, materialIds)))
        const discussions = results.map((result, index) => ({ ...result.discussion, id: existing[index].id }))
        updateState(current => ({ ...current, updatedAt: Date.now(), discussions, discussionQuestion: discussions.map(item => item.question).join('\n\n'), aiFallback: current.aiFallback || results.some(result => result.fallback) }))
      } else {
        const result = await regenerateContent(view, state.learningPack[view], materialIds)
        updateState(current => ({ ...current, updatedAt: Date.now(), aiFallback: current.aiFallback || !!result.fallback, learningPack: { ...current.learningPack, [view]: { ...result, exercises: current.learningPack[view].exercises } } }))
      }
    } catch (reason) { setError(reason.message) } finally { setAnalyzing(false) }
  }
  const upload = async event => {
    const input = event.currentTarget, files = Array.from(input.files)
    if (!files.length) return
    const sectionId = section.id
    setUploading(true); setError('')
    try {
      const uploaded = await saveMaterials(files)
      setLibrary(current => updateSection(current, sectionId, item => ({ ...item, materials: [...item.materials, ...uploaded] })))
    } catch (error) { setError(error.message || '资料保存失败，请重试。') }
    finally { input.value = ''; setUploading(false) }
  }
  const toggle = id => updateState(current => ({ ...current, updatedAt: Date.now(), analysisMaterialIds: current.analysisMaterialIds?.includes(id) ? current.analysisMaterialIds.filter(item => item !== id) : [...(current.analysisMaterialIds || []), id] }))
  return <main className="material-workspace"><section className="material-library">
    <CourseTree library={library} setLibrary={setLibrary} state={state} />
    <LessonTitle key={section?.id} section={section} onSave={title => setLibrary(current => updateSection(current, current.selectedSectionId, item => ({ ...item, title, ...(item.name.startsWith('新建小节 ') ? { name: title } : {}) })))} />
    <div className="resource-actions"><label className={`upload-button ${uploading ? 'disabled' : ''}`}><Icon name="upload" />{uploading ? '正在上传…' : '资源上传'}<input type="file" multiple disabled={uploading} accept=".ppt,.pptx,.pdf,.doc,.docx,.txt,.md,image/*" onChange={upload} /></label><a className="primary resource-link" href="https://feed-studio.stringx.top/admin/projects">资源生成</a>{state.learningPack && <><button className="ghost" disabled={!selected.length || uploading || analyzing} onClick={parse}><Icon name="spark" />解析所选资料</button></>}</div>
    {error && <p className="voice-error" role="alert">{error}</p>}
    <div className="course-files">{materials.map(material => <article key={material.id} className={selected.includes(material.id) ? 'selected' : ''}>
      <label className="analysis-check"><input type="checkbox" checked={selected.includes(material.id)} onChange={() => toggle(material.id)} /><span className="file-icon"><Icon name="folder" /></span><span><strong>{material.name}</strong><small>教师上传 · 点击选择用于解析</small></span></label>
      {isPresentation(material) ? <label className="material-select"><input type="radio" name="class-material" checked={state.materialId === material.id} onChange={() => updateState(current => ({ ...current, materialId: material.id, updatedAt: Date.now() }))} />课中展示</label> : <small className="analysis-only">仅用于解析</small>}
    </article>)}</div>
    {!materials.length && <div className="upload-empty"><Icon name="upload" /><h2>课程文件夹为空</h2><p>支持 PDF、Word、PPT、文本和图片资料。</p></div>}
  </section><section className="material-editor">
    <nav className="material-tabs">{[['preview', '课前预习'], ['discussion', '课中讨论'], ['review', '课后复习']].map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} disabled={!state.learningPack} onClick={() => onView(key)}>{label}{state.resourceConfirmations?.[key] && <span className="resource-confirmed"><Icon name="check" />已确认</span>}</button>)}<div className="material-tab-actions"><button className={`publish-pack ${packSent ? 'sent' : ''}`} disabled={!allConfirmed || packSent || analyzing} onClick={() => updateState(current => publishLearningPack(current))}><Icon name={packSent ? 'check' : 'send'} />{packSent ? '已发送' : '发送至学生端'}</button><button className="class-preview" disabled={!state.materialId} onClick={() => onView('classroom')}><Icon name="screen" />课中预览</button></div></nav>
    {state.aiFallback && state.learningPack && <p className="demo-content-note" role="status">演示内容：AI 生成超时，已使用预设学习包</p>}
    {analyzing ? <AILoading /> : view === 'pre-report' ? <PreClassReport state={state} students={students} /> : !state.learningPack || view === 'materials' ? <div className="analysis-start"><Icon name="spark" /><h2>选择资料后生成教学内容</h2><p>将依据所选资料生成至少三条课前预习任务、课中讨论及至少三条课后复习任务。测验题通过“生成题目”单独生成。</p><button className="primary" disabled={!selected.length || uploading || analyzing} onClick={parse}><Icon name="spark" /> {analyzing ? 'AI 正在解析资料…' : `AI 解析所选资料${selected.length ? `（${selected.length}）` : ''}`}</button></div> : view === 'discussion' ? <DiscussionContentEditor saved={!!state.resourceConfirmations?.discussion} onChange={content => updateState(current => updateResourceContent(current, 'discussion', content))} onRegenerate={regenerate} question={state.discussionQuestion} discussions={state.discussions} materialIds={(state.sourceRefs || []).map(ref => ref.resourceId)} onSave={content => updateState(current => updateResourceContent(current, 'discussion', content, true))} /> : <LearningContentEditor saved={!!state.resourceConfirmations?.[view]} onChange={content => updateState(current => updateResourceContent(current, view, content))} onRegenerate={regenerate} key={view} stage={view} content={state.learningPack[view]} onSave={content => updateState(current => updateResourceContent(current, view, content, true))} />}
  </section></main>
}

function LessonTitle({ section, onSave }) {
  const [draft, setDraft] = useState(section?.title || '')
  const save = () => { const title = draft.trim() || section.name; setDraft(title); if (title !== section.title) onSave(title) }
  return <div className="lesson-title"><label htmlFor="lesson-title">课堂标题 <Icon name="pen" /></label><input id="lesson-title" aria-label="课堂标题" value={draft} onChange={event => setDraft(event.target.value)} onBlur={save} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} /></div>
}

function CourseTree({ library, setLibrary, state }) {
  const [open, setOpen] = useState(true)
  const selectedBook = library.books.find(book => book.chapters.some(chapter => chapter.sections.some(section => section.id === library.selectedSectionId)))
  const selectedChapter = selectedBook?.chapters.find(chapter => chapter.sections.some(section => section.id === library.selectedSectionId))
  const [openBooks, setOpenBooks] = useState(() => new Set([selectedBook?.id || 'book-0']))
  const [openChapters, setOpenChapters] = useState(() => new Set([selectedChapter?.id || 'chapter-0-0']))
  const toggle = (setter, id) => setter(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const total = library.books.flatMap(book => book.chapters.flatMap(chapter => chapter.sections)).length
  return <div className="course-tree"><button type="button" className="course-tree-heading" aria-expanded={open} onClick={() => setOpen(value => !value)}><Icon name="folder" />课程文件夹<Icon name="down" /></button>
    {open && <div className="course-tree-list">{library.books.map(book => <div className="course-book" key={book.id}><button type="button" className="tree-node book-node" aria-expanded={openBooks.has(book.id)} onClick={() => toggle(setOpenBooks, book.id)}><Icon name="down" />{book.name}</button>
      {openBooks.has(book.id) && book.chapters.map(chapter => <div className="course-chapter" key={chapter.id}><div className="chapter-row"><button type="button" className="tree-node chapter-node" aria-expanded={openChapters.has(chapter.id)} onClick={() => toggle(setOpenChapters, chapter.id)}><Icon name="down" />{chapter.name}<CourseProgress sections={chapter.sections} state={state} /></button><button type="button" className="tree-icon-button" title={`在${chapter.name}新增小节`} aria-label={`在${chapter.name}新增小节`} onClick={() => { setOpenChapters(current => new Set(current).add(chapter.id)); setLibrary(current => addSection(current, chapter.id)) }}><Icon name="plus" /></button></div>
        {openChapters.has(chapter.id) && chapter.sections.map(section => <div className={`section-row ${section.id === library.selectedSectionId ? 'active' : ''}`} key={section.id}><button type="button" className="tree-node section-node" onClick={() => setLibrary(current => ({ ...current, selectedSectionId: section.id }))}>{section.name}<CourseProgress section={section} state={state} /></button><button type="button" className="tree-icon-button remove" title={`删除${section.name}`} aria-label={`删除${section.name}`} disabled={total <= 1} onClick={() => { if (window.confirm(`删除“${section.name}”文件夹及其资料记录？`)) setLibrary(current => removeSection(current, section.id)) }}><Icon name="close" /></button></div>)}
      </div>)}</div>)}</div>}
  </div>
}

function CourseProgress({ section, sections, state }) {
  const statusOf = item => {
    const published = item.id === state.sectionId ? state.publishedLearningPack : item.teachingState?.publishedLearningPack
    return !item.materials?.length ? 'empty' : published ? 'sent' : 'pending'
  }
  const statuses = (sections || [section]).map(statusOf)
  const status = statuses.every(value => value === 'empty') ? 'empty' : statuses.every(value => value === 'sent') ? 'sent' : 'pending'
  const label = { empty: '无资源', pending: '有资源，未全部发送到学生端', sent: '已发送到学生端' }[status]
  return <span className={`course-progress ${status}`} role="img" aria-label={label} title={label} />
}

function QuestionImages({ exercise }) {
  return <>{exercise.context && <p className="question-context">{exercise.context}</p>}{exercise.images?.length > 0 && <div className="question-images">{exercise.images.map((src, index) => <img key={src} src={src} alt={`第 ${exercise.number || ''} 题原图 ${index + 1}`} loading="lazy" />)}</div>}</>
}

function QuestionGenerator({ stage, onGenerate, onClose }) {
  const [bank, setBank] = useState(null), [error, setError] = useState(''), [uploadingBank, setUploadingBank] = useState(false)
  const [banks, setBanks] = useStoredState('wh-question-banks', [])
  const [difficulty, setDifficulty] = useState('all'), [types, setTypes] = useState(['single', 'fill', 'comprehensive']), [count, setCount] = useState(3)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/question-bank/geography.json', { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('题库读取失败'); return response.json() }).then(setBank).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [])
  const uploadBank = async event => {
    const input = event.currentTarget, file = input.files?.[0]
    if (!file) return
    setUploadingBank(true); setError('')
    try {
      const body = new FormData(); body.append('file', file)
      const response = await fetch('/api/question-banks/upload', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || '题库解析失败')
      setBanks(current => [...current, result]); setBank(result)
    } catch (reason) { setError(reason.message) } finally { setUploadingBank(false); input.value = '' }
  }
  const available = bank ? matchingQuestions(bank, { difficulty, types }).length : 0
  return <Modal title="生成题目" onClose={onClose}><div className="question-generator">
    <label>选择题库<select disabled={!bank || uploadingBank} value={bank?.id || ''} onChange={event => { const selected = banks.find(item => item.id === event.target.value); if (selected) setBank(selected); else fetch('/question-bank/geography.json').then(response => response.json()).then(setBank).catch(reason => setError(reason.message)) }}><option value="geo-20261008">2026年10月08日地理作业</option>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="editor-actions"><label className={`upload-button ${uploadingBank ? 'disabled' : ''}`}><Icon name="upload" />{uploadingBank ? '正在解析题库…' : '上传题库'}<input type="file" accept=".json,.docx,.pdf,.pptx,.txt,.md" disabled={uploadingBank} onChange={uploadBank} /></label><a className="primary resource-link" href="https://feed-studio.stringx.top/" target="_blank" rel="noreferrer">AI资源生成</a></div>
    <label>题目数量<input type="number" min="1" max={available || 1} value={count} onChange={event => setCount(Number(event.target.value))} /></label>
    <label>题目难度<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="all">不限难度</option><option value="easy">简单（系数 ≥ 0.75）</option><option value="medium">中等（0.55 ≤ 系数 ＜ 0.75）</option><option value="hard">困难（系数 ＜ 0.55）</option></select></label>
    <fieldset className="question-type-options"><legend>题目类型（可多选）</legend>{[['single', '单选题'], ['fill', '填空题'], ['comprehensive', '综合题']].map(([type, label]) => <label key={type}><input type="checkbox" checked={types.includes(type)} onChange={event => setTypes(current => event.target.checked ? [...current, type] : current.filter(item => item !== type))} />{label}</label>)}</fieldset>
    <p>符合条件且含原图的题目：{available} 道。生成后替换当前测验，保留原题答案与解析。点击保存后可发送学生端。</p>
    {error && <p className="voice-error" role="alert">{error}</p>}
    <button type="button" className="primary" disabled={uploadingBank || !bank || !available || !Number.isInteger(count) || count < 1 || count > available} onClick={() => { try { onGenerate(composeQuestions(bank, { difficulty, types }, count, stage)); onClose() } catch (reason) { setError(reason.message) } }}>生成题目</button>
  </div></Modal>
}

function PreClassReport({ state, students }) {
  return <section className="pre-report"><PreLearningReport state={state} students={students} /></section>
}

function LearningContentEditor({ saved, stage, content, onSave, onChange, onRegenerate }) {
  const [draft, setDraftState] = useState(content), [generating, setGenerating] = useState(false)
  const setDraft = change => {
    const next = typeof change === 'function' ? change(draft) : change
    setDraftState(next); onChange(next)
  }
  useEffect(() => {
    const incoming = JSON.stringify(content)
    if (incoming !== JSON.stringify(draft)) setDraftState(content)
  }, [content])
  const updateExercise = (index, patch) => setDraft(current => ({ ...current, exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise) }))
  const updateOption = (exerciseIndex, optionIndex, value) => setDraft(current => ({ ...current, exercises: current.exercises.map((exercise, i) => i === exerciseIndex ? { ...exercise, options: exercise.options.map((option, j) => j === optionIndex ? value : option) } : exercise) }))
  const addExercise = () => {
    setDraft(current => ({ ...current, exercises: [...current.exercises, { id: `${stage}-${Date.now()}`, question: '', options: ['', '', ''], answer: '' }] }))
  }
  return <form className="content-editor" onSubmit={event => { event.preventDefault(); if (draft.task.split(/\n/).filter(line => line.trim()).length < 3) { event.currentTarget.querySelector('textarea').setCustomValidity('学习任务至少三条，每行一条'); event.currentTarget.reportValidity(); return } onSave({ ...draft, tasks: draft.task.split(/\n/).map(line => line.replace(/^\s*\d+[.、．]\s*/, '').trim()).filter(Boolean) }) }}>
    <header><div><small>{stage === 'preview' ? '课前学习材料' : '课后巩固材料'}</small><h2>{draft.title}资料 + 测验</h2></div><div className="editor-actions"><button className="primary" disabled={saved}>{saved ? '已保存' : '保存'}</button><button type="button" className="ghost" onClick={onRegenerate}>重新生成</button></div></header>
    <label>资料标题<input required value={draft.title} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })) }} /></label>
    <label>学习任务（至少三条，每行一条）<textarea required value={draft.task} onChange={event => { event.target.setCustomValidity(''); setDraft(current => ({ ...current, task: event.target.value })) }} /></label>
    <div className="exercise-heading"><h3>测验题目</h3><button type="button" className="ghost" onClick={() => setGenerating(true)}><Icon name="spark" /> 生成题目</button><button type="button" className="ghost add-exercise" onClick={addExercise}><Icon name="plus" /> 新增题目</button></div>
    {draft.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>第 {index + 1} 题</legend>
      <QuestionImages exercise={exercise} /><label>题目<textarea required value={exercise.question} onChange={event => { updateExercise(index, { question: event.target.value }) }} /></label>
      <div className="option-inputs"><span>{exercise.type && exercise.type !== 'single' ? '题内选项' : '选项'}</span>{exercise.options.map((option, optionIndex) => <label key={optionIndex}>选项 {optionIndex + 1}<input required value={option} onChange={event => { updateOption(index, optionIndex, event.target.value) }} /></label>)}</div>
      <label>参考答案<textarea required value={exercise.answer} onChange={event => { updateExercise(index, { answer: event.target.value }) }} /></label>{exercise.explanation && <details className="question-explanation"><summary>答案解析 · 难度系数 {exercise.difficultyCoefficient}</summary><p>{exercise.explanation}</p></details>}
    </fieldset>)}
    {generating && <QuestionGenerator stage={stage} onClose={() => setGenerating(false)} onGenerate={exercises => { setDraft(current => ({ ...current, exercises })) }} />}
  </form>
}

function DiscussionContentEditor({ saved, question, discussions, materialIds, onSave, onChange, onRegenerate }) {
  const initial = () => discussions?.length ? discussions : [{ id: 'legacy-discussion', question: question || '', analysis: '', goal: '' }]
  const [draft, setDraftState] = useState(initial), [busyId, setBusyId] = useState(null), [error, setError] = useState('')
  const setDraft = change => {
    const next = typeof change === 'function' ? change(draft) : change
    setDraftState(next); onChange(next)
  }
  useEffect(() => { setDraftState(initial()) }, [question, discussions])
  const update = (id, patch) => { setDraft(current => current.map(item => item.id === id ? { ...item, ...patch } : item)) }
  const generate = async item => {
    setBusyId(item.id); setError(''); onChange(draft)
    try {
      const result = await regenerateContent('discussion', item, materialIds)
      update(item.id, result.discussion)
    } catch (reason) { setError(reason.message) } finally { setBusyId(null) }
  }
  return <form className="content-editor discussion-content-editor" onSubmit={event => { event.preventDefault(); onSave(draft) }}>
    <header><div><small>课中互动</small><h2>小组讨论题目</h2></div><div className="editor-actions"><button className="primary" disabled={saved || !!busyId || draft.some(item => !item.question.trim() || !item.analysis.trim() || !item.goal.trim())}>{saved ? '已保存' : '保存'}</button><button type="button" className="ghost" disabled={!!busyId} onClick={onRegenerate}>重新生成</button><button type="button" className="ghost" onClick={() => { setDraft(current => [...current, { id: crypto.randomUUID(), question: '', analysis: '', goal: '' }]) }}><Icon name="plus" /> 新建讨论题目</button></div></header>
    {error && <p className="voice-error" role="alert">{error}</p>}
    {draft.map((item, index) => <fieldset key={item.id}><legend>讨论题 {index + 1}</legend><label>问题<div className="discussion-input"><textarea required value={item.question} placeholder="输入讨论方向，或点击 AI 生成，基于所选资源生成讨论题" onChange={event => update(item.id, { question: event.target.value })} /><button type="button" className="ghost discussion-ai-button" disabled={!!busyId} onClick={() => generate(item)}><Icon name="spark" />{busyId === item.id ? '正在生成…' : 'AI生成'}</button></div></label><label>解析<textarea required value={item.analysis} onChange={event => update(item.id, { analysis: event.target.value })} /></label><label>讨论目标<textarea required value={item.goal} onChange={event => update(item.id, { goal: event.target.value })} /></label>{draft.length > 1 && <button type="button" className="ghost" disabled={!!busyId} onClick={() => { setDraft(current => current.filter(other => other.id !== item.id)) }}>删除讨论题</button>}</fieldset>)}
    <p>保存后，课堂小组讨论将使用这些问题。</p>
  </form>
}

function UploadedPresentation({ material, page = 1, phase = 'before', onTurn, onPageChange, onSavePresentation, presentationRef, headerTarget, showControls = true }) {
  const asset = useMaterial(material?.id, material?.revision)
  if (!material) return <div className="presentation-empty"><h2>等待教师上传课中展示资料</h2><p>教师原始课件将在这里展示，不自动生成 PPT。</p></div>
  if (isPowerPoint(material)) return <React.Suspense fallback={<div className="presentation-empty">正在加载 PPT 播放器…</div>}><PowerPointPresentation ref={presentationRef} key={material.id} material={material} phase={phase} page={page} editable={!!onTurn} headerTarget={headerTarget} showControls={showControls} onPageChange={onPageChange} onSave={onSavePresentation} /></React.Suspense>
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
  return <section className="learning-overview"><div className="learning-content"><small>AI 基于课程资料生成 · {content.title}</small><h2>{content.title}任务</h2><p>{content.task}</p><ol>{content.exercises.map(exercise => <li key={exercise.id}><strong>{exercise.question}</strong><p>{exercise.options.join(' / ')}</p><small>参考答案：{exercise.answer}</small></li>)}</ol></div><h2>每位学生的答题情况</h2><div className="learning-students">{students.map(student => {
    const answers = Object.fromEntries(Object.entries(state.learningAnswers?.[stage]?.[student.id] || {}).filter(([, answer]) => !answer.simulated))
    const submitted = content.exercises.filter(exercise => answers[exercise.id])
    const correct = submitted.filter(exercise => answers[exercise.id].text === exercise.answer)
    const feedback = state.learningFeedback?.[stage]?.[student.id]
    return <article key={student.id}><header><strong>{student.name}</strong><small>学号 {student.id}</small><b>{submitted.length ? `${submitted.length}/${content.exercises.length} 已答 · ${correct.length} 题正确` : '未提交'}</b></header>{content.exercises.map((exercise, index) => <p key={exercise.id}><span>第 {index + 1} 题</span><strong>{answers[exercise.id]?.text || '未作答'}</strong><em>{answers[exercise.id] ? answers[exercise.id].text === exercise.answer ? '正确' : '待订正' : '待完成'}</em></p>)}<small>{submitted.length ? '学生实际提交' : '等待学生提交'}</small>{feedback?.reportedAt && <div className="learning-feedback"><strong>AI 学伴分析</strong><p>教师侧总结与教学建议请查看右侧 AI 助教的「AI 学伴分析」。</p></div>}</article>
  })}</div>{!students.length && <p>班级暂无学生。</p>}</section>
}

function LearningExercises({ stage, state, student, updateState }) {
  const content = state.publishedLearningPack?.[stage]
  const submitted = Object.fromEntries(Object.entries(state.learningAnswers?.[stage]?.[student.id] || {}).filter(([, answer]) => !answer.simulated))
  const [responses, setResponses] = useState(() => Object.fromEntries(Object.entries(submitted).map(([id, answer]) => [id, answer.text])))
  const [saved, setSaved] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const submit = async event => {
    event.preventDefault(); setSaved(true); setAnalyzing(true); setAnalysisError('')
    updateState(current => submitLearningAnswers(current, stage, student.id, responses))
    try {
      const result = await analyzeLearningAnswers({ stage, studentId: student.id, content, responses })
      updateState(current => saveLearningFeedback(current, stage, student.id, result))
    } catch (error) { setAnalysisError(error.message || 'AI 习题分析暂不可用，请稍后重试。') }
    finally { setAnalyzing(false) }
  }
  if (!content) return <div className="task-content"><h1>等待教师发送学习资料</h1><p>教师发送后，{stage === 'preview' ? '课前预习' : '课后复习'}资料与测验会出现在这里。</p></div>
  return <div className="learning-exercises"><small>{state.publishedLearningFallback ? '喀斯特地貌演示预设' : 'AI 基于课程资料生成'} · {content.title}</small><h1>{content.title}</h1><p className="learning-task-text">{content.task}</p>{!content.exercises.length && <p>当前仅有学习任务，等待教师生成并发送测验题。</p>}<form onSubmit={submit}>{content.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>{index + 1}. {exercise.question}</legend><QuestionImages exercise={exercise} />{exercise.type && exercise.type !== 'single' && exercise.options.length > 0 && <p>{exercise.options.join('　')}</p>}{(!exercise.type || exercise.type === 'single') ? exercise.options.map(option => <label key={option}><input type="radio" name={exercise.id} required value={option} checked={responses[exercise.id] === option} onChange={() => { setResponses(current => ({ ...current, [exercise.id]: option })); setSaved(false) }} />{option}</label>) : <label>你的回答<textarea required value={responses[exercise.id] || ''} onChange={event => { setResponses(current => ({ ...current, [exercise.id]: event.target.value })); setSaved(false) }} /></label>}{submitted[exercise.id] && <small>上次回答：{submitted[exercise.id].text} · {submitted[exercise.id].text === exercise.answer ? '正确' : '待订正'}</small>}</fieldset>)}<button className="primary" disabled={analyzing || !content.exercises.length || content.exercises.some(exercise => !responses[exercise.id])}>{analyzing ? 'AI 正在分析…' : saved ? '重新提交' : '提交习题'}</button>{saved && !analyzing && !analysisError && <p role="status">真实作答已提交，AI 分析显示在右侧当前对话下方。</p>}{analysisError && <p className="voice-error" role="alert">作答已保存，但{analysisError}</p>}</form></div>
}

function Report({ state, onGenerated, onClose }) {
  return <Modal title="课堂总结报告" onClose={onClose}><ClassroomReport state={state} onGenerated={onGenerated} /></Modal>
}

function StudentLogin({ students, onLogin, onHome }) {
  const [error, setError] = useState('')
  const submit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); const student = students.find(s => s.id === data.id && s.name === data.name); student ? onLogin(student) : setError('姓名或学号不匹配，请重新输入') }
  return <main className="login-page"><button className="back-home" onClick={onHome}><Icon name="back" /> 返回控制台</button><section className="login-card"><Brand /><div className="login-art"><span><Icon name="cap" /></span></div><h1>欢迎回到智慧课堂</h1><p>输入你的信息，开启今天的学习旅程</p><form onSubmit={submit}><label>姓名<input name="name" placeholder="例如：李奕贤" /></label><label>学号<input name="id" inputMode="numeric" placeholder="例如：08001" /></label>{error && <p className="form-error">{error}</p>}<button className="primary wide">进入课堂 <Icon name="next" /></button></form><small>演示账号：李奕贤 / 08001</small></section></main>
}

function Student({ student, onHome, onLogout = onHome, state, updateState }) {
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
  return <div className="app-shell student-page"><Topbar title={`学生端 · ${student.name}`} onHome={onHome} actions={<><div className="student-notifications"><button className="notification-button" aria-label="学习资料通知" onClick={openNotifications}><Icon name="bell" />{unread && <i />}</button>{showNotifications && <div className="notification-panel"><strong>学习资料通知</strong>{notifications.length ? notifications.map(item => <button key={item.id} disabled={!studentStageAvailable(state.phase, item.stage)} onClick={() => { setTab(item.stage); setShowNotifications(false) }}><b>{item.title}</b><small>{item.stage === 'preview' ? '课前预习' : '课后复习'} · {new Date(item.sentAt).toLocaleString('zh-CN')}</small></button>) : <p>暂无新消息</p>}</div>}</div><UserMenu user={student} onLogout={onLogout} /></>} />
    <nav className="student-tabs">{[['preview','课前预习'],['class','课堂互动'],['review','课后复习'],['growth','成长报告']].map(([id, label]) => <button className={tab === id ? 'active' : ''} disabled={id !== 'growth' && !studentStageAvailable(state.phase, id)} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>
    <div className="student-grid"><section className="activity-card"><div className="section-label">{tab === 'growth' ? '成长报告' : tab === 'preview' ? '课前预习' : tab === 'review' ? '课后复习' : '课堂互动'}<span>{state.phase === 'class' ? '● 与教师端同步' : ''}</span></div>
      {tab === 'growth' && <StudentReport state={state} student={student} />}
      {tab === 'preview' && <LearningExercises key="preview" stage="preview" state={state} student={student} updateState={updateState} />}
      {tab === 'class' && state.activity === 'discussion' && state.questionRun?.kind === 'discussion' ? <StudentDiscussion key={state.questionRun.id} run={state.questionRun} student={student} updateState={updateState} stateMinutes={state.discussionMinutes} /> : tab === 'class' && state.activity === 'question' && state.questionRun ? <StudentQuestion key={state.questionRun.id} run={state.questionRun} student={student} updateState={updateState} points={state.studentPoints?.[student.id] || 0} /> : tab === 'class' && <div className="task-content"><span className="pulse-ring" /><small>{activity.title}</small><h1>{activity.text}</h1><p>{state.activity === 'screen' ? '教师发起互动后，题目或小组任务会自动出现在这里' : '说出你的想法，学伴会帮你组织表达。'}</p>{state.activity !== 'screen' && <div className="answer-box"><textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" /><button className="primary" onClick={() => answer.trim() && setSent(true)}>{sent ? '已提交 ✓' : '提交回答'}</button></div>}</div>}
      {tab === 'review' && <LearningExercises key="review" stage="review" state={state} student={student} updateState={updateState} />}
    </section><StudyBuddy student={student} stage={tab === 'growth' ? 'review' : tab} state={state} updateState={updateState} /></div>
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

function StudentQuestion({ run, student, updateState, points = 0 }) {
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
  return <div className="student-question-state"><div className="student-timer"><span>请作答</span><b>{seconds}</b><small>秒</small></div><h1>{run.question}</h1><p>点击麦克风录音，转写内容自动同步给教师</p><div className="answer-reward" role="status">本题回答积分：+1 · 累计积分：{points}</div><button className={`student-mic ${voice.active ? 'listening' : ''}`} disabled={voice.pending} onClick={() => { if (voice.active) voice.stop(); else { voiceBase.current = text ? `${text}\n` : ''; voice.start() } }} aria-label={voice.active ? '停止回答' : '开始回答'}><Icon name={voice.active ? 'stop' : 'mic'} /></button><strong className="mic-label">{voice.pending ? '等待麦克风授权…' : voice.active ? '正在录音 · 点击停止' : '点击开始回答'}</strong>
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
  const [busy, setBusy] = useState(false)
  const [chat, setChat] = useState([{ from: 'bot', text: `${student.name}你好！关于“喀斯特地貌”，我会用提问帮你自己找到答案。` }])
  const send = async text => {
    const value = (text || input).trim()
    if (!value || busy) return
    updateState(current => ({ ...current, studentUtterances: [...(current.studentUtterances || []), { studentId: student.id, name: student.name, stage, text: value, at: Date.now() }].slice(-300) }))
    setChat(current => [...current, { from: 'me', text: value }]); setInput(''); setBusy(true)
    try {
      const result = await askAgent({ message: value, role: 'student', studentId: student.id, stage })
      setChat(current => [...current, { from: 'bot', text: result.answer, sourceRefs: result.sourceRefs }])
    } catch {
      setChat(current => [...current, { from: 'bot', text: 'AI 服务暂不可用，请重试。' }])
    } finally { setBusy(false) }
  }
  return <aside className="buddy-card"><div className="agent-head"><span className="agent-icon"><Icon name="robot" /></span><div><h2>AI 学伴</h2><p><i /> 启发式引导 · 不直接给答案</p></div></div><div className="messages">{chat.map((m, i) => <div className={`message ${m.from}`} key={i}><p>{m.text}</p>{m.sourceRefs?.length > 0 && <small>依据：{m.sourceRefs.map(ref => ref.name).join('、')}</small>}</div>)}{feedback && <div className="message bot" role="status"><small>习题分析与指导</small><p>{feedback.summary}\n{feedback.items.map((item, index) => `第 ${index + 1} 题（你的回答：${item.response}）：${item.guidance}`).join('\n')}</p>{feedback.sourceRefs?.length > 0 && <small>依据：{feedback.sourceRefs.map(ref => ref.name).join('、')}</small>}<small>{feedback.reportedAt ? '分析结果已同步给教师 Agent' : '指导已生成，正在同步给教师 Agent…'}</small></div>}</div><div className="quick"><button disabled={busy} onClick={() => send('为什么会形成溶洞？')}>为什么会形成溶洞？</button><button disabled={busy} onClick={() => send('引导我分析这道题')}>引导我分析</button></div><div className="composer"><input disabled={busy} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={busy ? '学伴正在思考…' : '说说你的想法…'} /><button disabled={busy} onClick={() => send()}><Icon name="send" /></button></div></aside>
}

function BigScreen({ onHome, state, updateState }) {
  const material = state.materials?.find(material => material.id === state.materialId && isPresentation(material))
  const stopQuestion = () => updateState(current => {
    const run = current.questionRun
    if (!run || !['answering', 'result'].includes(run.status)) return current
    return { ...current, updatedAt: Date.now(), questionRun: { ...run, status: 'analyzing', analysisError: null, answers: run.answers.map(x => ({ ...x, active: false })) } }
  })
  return <main className="big-screen"><header><Brand compact /><div><i /> {state.phase === 'class' ? '课堂进行中' : state.phase === 'after' ? '课堂已结束' : '课前准备'}　<span>{material?.name}</span></div><button onClick={onHome}><Icon name="close" /></button></header>{['question', 'discussion'].includes(state.activity) && state.questionRun ? <ScreenQuestion run={state.questionRun} onStop={stopQuestion} /> : <section className="screen-presentation"><UploadedPresentation material={material} phase={state.phase} page={getMaterialPage(state, material?.id)} /></section>}</main>
}

function ScreenQuestion({ run, onStop }) {
  const seconds = useCountdown(run.endAt)
  if (run.kind === 'discussion') return <ScreenDiscussion run={run} onStop={onStop} />
  if (run.status === 'analyzing') return <section className="screen-analysis"><div className="screen-glow" /><span className="analysis-spinner" /><small>AI 课堂助教</small><h1>回答分析中…</h1><p>正在汇总 {run.answers.filter(answer => answer.text.trim()).length} 位同学的表达和共性问题</p></section>
  if (run.status === 'result') return <section className="screen-result"><div className="screen-glow" /><small>作答分析完成</small><h1>课堂回答分析</h1><QuestionAnalysis run={run} /></section>
  const activeAnswers = run.answers.filter(x => x.active)
  return <section className="screen-answering"><div className="screen-glow" /><div className="answering-head"><div><small>课堂提问</small><h1>请作答</h1></div><div className="screen-countdown"><b>{seconds}</b><span>秒</span></div><button onClick={onStop}><Icon name="stop" /> 停止作答</button></div><h2>{run.question}</h2><div className="live-answers">{activeAnswers.length ? activeAnswers.map(answer => <article key={answer.id}><div><span>{answer.name.slice(-1)}</span><p><b>{answer.name}</b><small><i /> 麦克风已开启 · 实时转写</small></p></div><blockquote>{answer.text}</blockquote><div className="mini-wave">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div></article>) : <div className="waiting-answer"><Icon name="mic" /><p>等待同学开启麦克风…</p></div>}</div></section>
}

function ScreenDiscussion({ run, onStop }) {
  const seconds = useCountdown(run.endAt || Date.now())
  if (run.status === 'analyzing') return <section className="screen-analysis"><span className="analysis-spinner" /><h1>小组回答分析中…</h1><p>正在整理各组观点与讨论总结</p></section>
  if (run.status === 'result') return <section className="screen-result screen-discussion"><small>小组讨论完成</small><h1>{run.question}</h1><DiscussionSummary run={run} /></section>
  return <section className="screen-answering"><div className="screen-glow" /><div className="answering-head"><div><small>小组讨论</small><h1>{run.status === 'selecting' ? '请选择小组' : '讨论进行中'}</h1></div>{run.status === 'answering' && <><div className="screen-countdown"><b>{seconds}</b><span>秒</span></div><button onClick={onStop}><Icon name="stop" /> 结束讨论</button></>}</div><h2>{run.question}</h2><div className="live-answers">{run.groups.map(group => { const answer = run.answers.find(answer => answer.id === group.id); return <article key={group.id}><div><span>{group.number}</span><p><b>{group.number}组 · {group.name}</b><small>小组长：{group.leaderName} · {answer?.active ? '正在录音' : run.status === 'selecting' ? `已进入 ${Object.values(run.members).filter(id => id === group.id).length} 人` : '麦克风关闭'}</small></p></div><blockquote>{run.status === 'selecting' ? '等待教师开始讨论…' : answer?.text || '等待本组回答…'}</blockquote></article> })}</div></section>
}

function TeacherLogin({ onLogin, onHome, error, busy }) {
  const [username, setUsername] = useState(teacherAccounts[0].username)
  const [password, setPassword] = useState('')
  return <main className="login-page"><button className="back-home" onClick={onHome}><Icon name="back" /> 返回控制台</button><section className="login-card"><Brand /><div className="login-art"><span><Icon name="book" /></span></div><h1>教师登录</h1><form onSubmit={event => { event.preventDefault(); onLogin(username, password) }}><label>教师账号<select value={username} onChange={event => setUsername(event.target.value)}>{teacherAccounts.map(account => <option key={account.username} value={account.username}>{account.name}</option>)}</select></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? '正在登录…' : '进入教师工作台'} <Icon name="next" /></button></form></section></main>
}

function TeacherGate(props) {
  const [token, setToken] = useState(() => localStorage.getItem('wh-teacher-token') || '')
  const [account, setAccount] = useState(null)
  const [library, setLibraryState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saveQueue = useRef(Promise.resolve())
  const previousSection = useRef(null)
  const libraryHydrated = useRef(false)
  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadTeacherLibrary(token).then(data => {
      if (cancelled) return
      const cacheKey = `wh-teacher-pending-library-${data.teacher.username}`
      let pending
      try { pending = JSON.parse(localStorage.getItem(cacheKey)) } catch { /* Ignore invalid local cache. */ }
      libraryHydrated.current = false
      setAccount(data.teacher); setLibraryState(pending || data.library); setError('')
      if (pending) saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveTeacherLibrary(token, pending)).then(() => {
        if (localStorage.getItem(cacheKey) === JSON.stringify(pending)) localStorage.removeItem(cacheKey)
      }).catch(reason => setError(`课程内容保存失败：${reason.message}`))
    }).catch(reason => {
      if (!cancelled) { localStorage.removeItem('wh-teacher-token'); setToken(''); setError(reason.message) }
    })
    return () => { cancelled = true }
  }, [token])
  const saveLibrary = change => setLibraryState(current => {
    const next = typeof change === 'function' ? change(current) : change
    if (next === current) return current
    const cacheKey = `wh-teacher-pending-library-${account.username}`
    const serialized = JSON.stringify(next)
    localStorage.setItem(cacheKey, serialized)
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveTeacherLibrary(token, next)).then(() => {
      if (localStorage.getItem(cacheKey) === serialized) localStorage.removeItem(cacheKey)
      setError('')
    }).catch(reason => setError(`课程内容保存失败：${reason.message}`))
    return next
  })
  useEffect(() => {
    if (!libraryHydrated.current) return
    const previous = props.state.teacherUsername === account?.username && props.state.sectionId === library?.selectedSectionId ? { username: account?.username, sectionId: props.state.sectionId, state: props.state } : previousSection.current
    if (previous && previous.username === account?.username) {
      const teachingState = Object.fromEntries(['classroomReport', 'learningPack', 'resourceConfirmations', 'publishedDiscussions', 'publishedDiscussionQuestion', 'publishedLearningPack', 'publishedLearningFallback', 'learningNotifications', 'resourcesReady', 'discussionQuestion', 'discussions', 'sourceRefs', 'sourceImages', 'questionBank', 'parsedMaterialIds', 'analysisMaterialIds', 'learningAnswers', 'learningFeedback', 'aiFallback'].map(key => [key, previous.state[key]]))
      if (JSON.stringify(findSection(library, previous.sectionId)?.teachingState) !== JSON.stringify(teachingState)) saveLibrary(current => updateSection(current, previous.sectionId, section => ({ ...section, teachingState })))
    }
    previousSection.current = props.state.teacherUsername === account?.username ? { username: account?.username, sectionId: props.state.sectionId, state: props.state } : null
  }, [props.state, account?.username])
  useEffect(() => {
    if (!library) return
    const section = findSection(library)
    if (!section) return
    const restoring = !libraryHydrated.current
    props.updateState(current => {
      const materials = section.materials || []
      const ids = new Set(materials.map(item => item.id))
      if (!restoring && current.teacherUsername === account?.username && current.sectionId === section.id && JSON.stringify(current.materials || []) === JSON.stringify(materials) && current.lessonTitle === section.title) return current
      const switched = current.teacherUsername !== account?.username || current.sectionId !== section.id
      return { ...current, teacherUsername: account.username, sectionId: section.id, lessonTitle: section.title, materials, materialId: ids.has(current.materialId) && !switched ? current.materialId : null, analysisMaterialIds: (current.analysisMaterialIds || []).filter(id => ids.has(id)), ...(switched ? { classroomReport: null, learningPack: null, resourceConfirmations: {}, publishedDiscussions: null, publishedDiscussionQuestion: null, publishedLearningPack: null, resourcesReady: false, phase: 'before', activity: 'screen', questionRun: null, discussions: [], sourceRefs: [], sourceImages: [], questionBank: [], learningAnswers: {}, learningFeedback: {}, aiFallback: false, ...(section.teachingState || {}) } : restoring ? (section.teachingState || {}) : {}), updatedAt: Date.now() }
    })
    libraryHydrated.current = true
  }, [account?.username, library?.selectedSectionId, JSON.stringify(findSection(library)?.materials || []), findSection(library)?.title])
  const login = async (username, password) => {
    setBusy(true); setError('')
    try { const result = await loginTeacher(username, password); localStorage.setItem('wh-teacher-token', result.token); setToken(result.token) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const logout = () => { logoutTeacher(token).catch(console.error); localStorage.removeItem('wh-teacher-token'); setToken(''); setAccount(null); setLibraryState(null) }
  if (!token || error && !library) return <TeacherLogin onLogin={login} onHome={props.onHome} error={error} busy={busy} />
  if (!account || !library) return <main className="login-page">正在读取教师课程文件夹…</main>
  return <Teacher {...props} teacher={account} library={library} setLibrary={saveLibrary} libraryError={error} onLogout={logout} />
}

function App() {
  const [view, setView] = useState(() => new URLSearchParams(location.search).get('view') || 'console')
  const [student, setStudent] = useState(null)
  const [students, setStudents] = useStoredState('wh-students', seedStudents)
  useEffect(() => { setStudents(migrateStudents) }, [])
  const [state, setState] = useStoredState('wh-classroom', { phase: 'before', slide: 0, activity: 'screen', resourcesReady: false })
  const syncedMaterials = useRef(new Set())
  useEffect(() => {
    const pending = (state.materials || []).filter(material => !syncedMaterials.current.has(material.id))
    if (!pending.length) return
    syncLocalMaterials(pending).then(() => pending.forEach(material => syncedMaterials.current.add(material.id))).catch(console.error)
  }, [state.materials])
  const [messages, setMessages] = useStoredState('wh-messages', initialMessages)
  const [messagesClearedAt, setMessagesClearedAt] = useStoredState('wh-messages-cleared-at', 0)
  const channel = useMemo(() => 'BroadcastChannel' in window ? new BroadcastChannel('wh-classroom') : null, [])
  const liveSocket = useRef(null)
  const latestState = useRef(state)
  latestState.current = state
  const updateState = next => setState(current => {
    let value = typeof next === 'function' ? next(current) : next
    if (value !== current) {
      const history = [...(value.questionHistory || [])]
      if (current.questionRun && current.questionRun !== value.questionRun && value.classStartedAt === current.classStartedAt) {
        const index = history.findIndex(run => run.id === current.questionRun.id)
        if (index < 0) history.push(current.questionRun)
        else history[index] = current.questionRun
      }
      value = { ...value, questionHistory: history.slice(-100) }
      if (current.activity !== value.activity || current.phase !== value.phase) value.activityHistory = [...(value.activityHistory || []), { activity: value.activity, phase: value.phase, at: Date.now() }].slice(-300)
    }
    if (value !== current) {
      channel?.postMessage(value)
      if (liveSocket.current?.readyState === WebSocket.OPEN) liveSocket.current.send(JSON.stringify({ type: 'state', state: value }))
    }
    return value
  })
  useEffect(() => { if (!channel) return; channel.onmessage = e => { if (e.data?.type === 'demo.reset') { location.assign(location.pathname); return } setState(e.data) }; return () => channel.close() }, [channel, setState])
  useEffect(() => {
    let stopped = false
    let retry
    const connect = () => {
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/classroom/live`)
      liveSocket.current = socket
      socket.onopen = () => socket.send(JSON.stringify({ type: 'init', role: view, state: latestState.current }))
      socket.onmessage = event => {
        const message = JSON.parse(event.data)
        if (message.type !== 'state') return
        latestState.current = message.state
        setState(message.state)
        channel?.postMessage(message.state)
      }
      socket.onclose = () => { if (!stopped) retry = setTimeout(connect, 1500) }
    }
    connect()
    return () => { stopped = true; clearTimeout(retry); liveSocket.current?.close() }
  }, [channel, setState, view])
  useEffect(() => {
    const run = state.questionRun
    if (!run || run.status !== 'answering') return
    const timer = setTimeout(() => updateState(current => {
      const active = current.questionRun
      if (active?.id !== run.id || active.status !== 'answering') return current
      return { ...current, updatedAt: Date.now(), questionRun: { ...active, status: 'analyzing', analysisError: null, answers: active.answers.map(answer => ({ ...answer, active: false })) } }
    }), Math.max(0, run.endAt - Date.now()))
    return () => clearTimeout(timer)
  }, [state.questionRun?.id, state.questionRun?.status, state.questionRun?.endAt])
  useEffect(() => {
    const run = state.questionRun
    if (view !== 'teacher' || run?.status !== 'analyzing') return
    let cancelled = false
    const finish = (analysis, analysisError = null) => {
      if (cancelled) return
      updateState(current => {
        const active = current.questionRun
        if (active?.id !== run.id || active.status !== 'analyzing') return current
        return { ...current, updatedAt: Date.now(), questionRun: { ...active, status: 'result', finishedAt: Date.now(), analysis, analysisError, ...(active.kind === 'discussion' ? { summary: summarizeDiscussion(active) } : {}) } }
      })
    }
    analyzeClassroomAnswers(run).then(result => finish(result)).catch(error => finish(null, error.message))
    return () => { cancelled = true }
  }, [view, state.questionRun?.id, state.questionRun?.status])
  const resetDemo = async () => {
    await resetDemoClassroom()
    await clearDemoBrowserData()
    channel?.postMessage({ type: 'demo.reset' })
    location.assign(location.pathname)
  }
  const navigate = next => { setView(next); const url = next === 'console' ? location.pathname : `${location.pathname}?view=${next}`; history.replaceState({}, '', url) }
  if (view === 'teacher') return <TeacherGate onHome={() => navigate('console')} state={state} updateState={updateState} students={students} setStudents={setStudents} messages={messages} setMessages={setMessages} messagesClearedAt={messagesClearedAt} setMessagesClearedAt={setMessagesClearedAt} />
  if (view === 'student') return student ? <Student student={student} onLogout={() => setStudent(null)} onHome={() => navigate('console')} state={state} updateState={updateState} /> : <StudentLogin students={students} onLogin={setStudent} onHome={() => navigate('console')} />
  if (view === 'screen') return <BigScreen onHome={() => navigate('console')} state={state} updateState={updateState} />
  return <Console onEnter={navigate} onReset={resetDemo} />
}

createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>)
