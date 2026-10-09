import React, { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { generateClassroomReport } from './ai.js'
import { classroomRuns, sampleNotice } from './reports.js'

export function AILoading({ text = 'AI 正在生成内容…' }) {
  return <div className="ai-loading" role="status" aria-live="polite"><span className="analysis-spinner" /><h2>{text}</h2><p>正在整理资料和课堂记录，请稍候。</p></div>
}
const clock = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export function ReportChart({ title, type, labels, values, timeline = false }) {
  const canvas = useRef(null)
  const available = values.some(value => value !== null) && (type !== 'doughnut' || values.some(value => value > 0))
  useEffect(() => {
    if (!available) return
    const chart = new Chart(canvas.current, { type, data: { labels, datasets: [{ label: title, data: values, backgroundColor: type === 'radar' ? '#9682d844' : ['#9281cc', '#b4ce73', '#7cbecb', '#e5b579', '#d190ae'], borderColor: '#9281cc', borderWidth: 1.5 }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, ...(timeline ? { indexAxis: 'y', scales: { x: { title: { display: true, text: '距开课时间（秒）' }, min: 0 } } } : {}), ...(type === 'radar' ? { scales: { r: { min: 0, max: 100 } } } : {}), plugins: { legend: { display: type === 'doughnut' } } } })
    return () => chart.destroy()
  }, [title, type, JSON.stringify(labels), JSON.stringify(values), available, timeline])
  return <section className="diagnostic-card"><h3>{title}</h3>{available ? <><div className="report-chart"><canvas ref={canvas} role="img" aria-label={`${title}：${labels.map((label, i) => `${label} ${values[i] ?? '数据不足'}`).join('，')}`} /></div><p className="chart-values">{labels.map((label, i) => `${label}：${Array.isArray(values[i]) ? values[i].map(clock).join('–') : values[i] ?? '数据不足'}`).join(' · ')}</p></> : <><p className="sample-report-note">{sampleNotice}</p><ReportChart title={`${title} · 示例数据`} type={type} labels={labels.length ? labels : ['示例']} values={(labels.length ? labels : ['示例']).map((_, i) => timeline ? [i * 300, (i + 1) * 300] : type === 'doughnut' ? 20 : 75 + i % 4 * 5)} timeline={timeline} /></>}</section>
}
const exampleReport = { title: '课堂总结报告', conclusion: '示例分析：学生能识别主要地貌类型，对溶蚀与沉积的联系仍需通过图示进一步理解。', questionCounts: [4, 6, 5, 2, 1], radar: [82, 78, 85, 76, 88], timeline: [{ label: '导入', start: 0, end: 300 }, { label: '概念探究', start: 300, end: 1200 }, { label: '小组讨论', start: 1200, end: 2100 }, { label: '课堂总结', start: 2100, end: 2400 }], mode: '问题引导与合作探究（示例）', transitions: [{ start: 300, label: '从观察转入成因探究' }], suggestions: ['示例建议：增加图示解释任务，引导学生用证据描述形成过程。'], issues: [{ problem: '示例问题：部分回答混淆溶蚀与沉积。', suggestion: '用对比图整理两种过程。' }], limitations: ['当前报告为示例，不能用于评价真实课堂或学生。'] }
export default function ClassroomReport({ state, onGenerated }) {
  const [sample, setSample] = useState(false)
  const [report, setReport] = useState(null), [busy, setBusy] = useState(true), [error, setError] = useState('')
  const snapshot = useRef(state)
  snapshot.current = state
  const generate = async () => {
    setBusy(true); setError('')
    try {
      const source = snapshot.current
      const hasRecords = classroomRuns(source).some(run => (run.answers || []).some(answer => answer.text?.trim())) || Object.values(source.learningAnswers || {}).some(stage => Object.values(stage).some(answers => Object.values(answers).some(answer => !answer.simulated && answer.text?.trim()))) || source.studentUtterances?.length
      if (!hasRecords) { setSample(true); setReport(exampleReport); return }
      const { materials, learningPack, learningAnswers, questionHistory, questionRun, discussionMinutes, studentUtterances, activityHistory, classStartedAt, classEndedAt } = source
      const generated = await generateClassroomReport({ materials: materials?.map(({ name }) => ({ name })), learningPack, learningAnswers, questionHistory: Object.values(Object.fromEntries([...(questionHistory || []), questionRun].filter(Boolean).map(run => [run.id, run]))), discussionMinutes, studentUtterances, activityHistory, classStartedAt, classEndedAt })
      setReport(generated); setSample(!!generated.fallback); onGenerated?.(generated)
    } catch (reason) { setError(reason.message); setSample(true); setReport(exampleReport) } finally { setBusy(false) }
  }
  useEffect(() => { generate() }, [])
  const runs = Object.values(Object.fromEntries([...(state.questionHistory || []), state.questionRun].filter(Boolean).map(run => [run.id, run])))
  const waits = runs.flatMap(run => (run.answers || []).filter(answer => answer.firstResponseAt && run.startedAt && answer.firstResponseAt >= run.startedAt).map(answer => (answer.firstResponseAt - run.startedAt) / 1000))
  if (busy) return <AILoading text="AI 正在生成课堂诊断报告…" />
  return <div className="report diagnostic-report"><div className="editor-actions"><button className="primary" onClick={generate}>重新生成</button>{report && <button className="ghost" onClick={() => window.print()}>下载 / 打印 PDF</button>}</div>{sample && <p className="sample-report-note" role="status">{sampleNotice}</p>}{error && <p role="alert" className="voice-error">{error}</p>}{report && <><h1>{report.title}</h1><p>{report.conclusion}</p><h2>课堂诊断报告</h2><div className="diagnostic-grid"><ReportChart title="提问层级分布（%）" type="doughnut" labels={['记忆型', '理解型', '分析型', '评价型', '创造型']} values={report.questionCounts.map(value => value === null ? null : Math.round(value / (report.questionCounts.reduce((sum, n) => sum + (n || 0), 0) || 1) * 1000) / 10)} /><section className="diagnostic-card"><h3>候答时间统计</h3>{waits.length ? <><strong>{(waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(1)} 秒</strong><p>平均首次响应耗时 · {waits.length} 条记录</p><p>{Math.round(waits.filter(n => n <= 5).length / waits.length * 100)}% 的首次响应在 5 秒内</p><small>从发起问题到首次录音或输入；不等同于完整回答时长或教师实际候答时间。</small></> : <><p className="sample-report-note">{sampleNotice}</p><strong>4.2 秒</strong><p>示例平均首次响应耗时</p></>}</section><ReportChart title="能力多维雷达图（AI 估计）" type="radar" labels={['教学目标达成度', '教学节奏', '提问有效性', '回应质量', '课堂管理']} values={report.radar} /><ReportChart title="教学环节时序图" type="bar" labels={report.timeline.map(x => x.label)} values={report.timeline.map(x => [x.start, x.end])} timeline /></div><h2>教学模式识别 · {report.mode}</h2>{report.transitions.length ? <ol>{report.transitions.map((item, i) => <li key={i}>{clock(item.start)} · {item.label}</li>)}</ol> : <p>暂无可确认的模式转换节点。</p>}<h2>AI 改进建议</h2><ol>{report.suggestions.map((text, i) => <li key={i}>{text}</li>)}</ol><h2>待改进点标注</h2>{report.issues.length ? report.issues.map((item, i) => <article className="diagnostic-card" key={i}><strong>{item.problem}</strong><p>{item.suggestion}</p>{item.evidence && <p><strong>互动依据：</strong>{item.evidence}</p>}</article>) : <p>当前记录不足以确认具体问题。</p>}<h3>数据范围与限制</h3><ul>{report.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></>}</div>
}
