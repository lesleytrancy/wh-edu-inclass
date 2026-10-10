import React, { useEffect, useState } from 'react'
import { ReportChart, AILoading } from './ReportCharts.jsx'
import { classroomRuns, reportTabs, stageReport, studentMetrics } from './reports.js'

export function SampleNotice() { return <p className="sample-report-note" role="status">暂无足够的真实数据</p> }
export function StudentReport({ state, student }) {
  const metrics = studentMetrics(state, student)
  return <article className="student-analysis"><h1>{student.name}的成长报告</h1><p>{state.simulation ? '模拟测试数据 · ' : ''}基于测验、课堂互动及学伴发言；未记录的指标保持为空。</p>{state.abilityProfiles?.[student.id] && <ReportChart title="个人与班级综合能力对比" type="radar" labels={['学业基础', '逻辑思维', '自主学习', '课堂参与', '提问品质']} datasets={[{ label: student.name, data: state.abilityProfiles[student.id], borderColor: '#8170ce', backgroundColor: '#8170ce33' }, { label: '班级平均', data: [0,1,2,3,4].map(i => { const values = Object.values(state.abilityProfiles).map(p => p[i]).filter(Number.isFinite); return values.length ? values.reduce((a,b) => a+b,0)/values.length : null }), borderColor: '#54a99a', backgroundColor: '#54a99a22' }]} />}{(state.lessonScoreHistory?.[student.id] || []).length > 0 && <ReportChart title="个人成长趋势" type="line" labels={state.lessonScoreHistory[student.id].map(x => x.label)} values={state.lessonScoreHistory[student.id].map(x => x.score)} />}{[['课堂表现', metrics.performance], ['成长值', metrics.growth]].map(([title, rows]) => <section key={title}><h2>{title}</h2><table className="metric-table"><tbody>{rows.map(row => <tr key={row.label}><th>{row.label}</th><td>{row.description}</td><td>{row.sample ? '数据不足' : `${row.value}${row.unit}`}</td></tr>)}</tbody></table><ReportChart title={title} type={title === '课堂表现' ? 'radar' : 'bar'} labels={rows.filter(row => typeof row.value !== 'string').map(row => row.label)} values={rows.filter(row => typeof row.value !== 'string').map(row => row.sample ? null : row.value)} /></section>)}</article>
}
export function PreLearningReport({ state, students, stage = 'preview' }) {
  const report = stageReport(state, students, stage)
  return <><h1>{stage === 'preview' ? '课前报告' : '课后总结'}</h1><p>收到 {report.rows.filter(row => row.submitted).length} 位学生{state.simulation ? '模拟' : '真实'}提交。{report.accuracy === null ? '尚无已评分作答。' : `已评分题目正确率 ${report.accuracy}%。`}</p><ReportChart title="真实作答正确率（%）" type="bar" labels={report.rows.map(row => row.student.name)} values={report.rows.map(row => row.graded ? Math.round(row.correct / row.graded * 100) : null)} /></>
}

const definitions = {
  pre: ['课前学情预判与精准备课报告', ['预习任务整体完成情况', '核心知识点预习正确率分布', '疑问与薄弱点汇总', '课前精准教学策略建议']],
  quality: ['课堂教学质量与实时互动总览报告', ['课堂讲练节奏与互动分布', '学生注意力与参与度分析', '随堂检测实时答题质量', '课堂整体教学效果评估与反馈']],
  questions: ['课堂提问效能与思维品质分析报告', ['提问学生覆盖面与公平性诊断', '提问问题认知层级分布', '学生应答质量与思维表现', '提问互动策略优化方案']],
  after: ['课后作业诊断与个性化巩固报告', ['作业完成与批改整体概况', '知识点闭环掌握度演变', '错题归因与典型错误分析', '数字人伴学与个性化干预建议']],
  growth: ['学生综合素养与学业成长画像报告', ['学业水平长周期发展趋势', '学习习惯与自主学习能力评估', '学科优势与潜力诊断', '阶段性成长里程碑与评语']],
  standards: ['新课标核心素养与跨学科实践落实报告', ['新课标核心素养维度达成评估', '跨学科主题与情境化任务完成度', '探究性学习与实践能力表现', '基于新课标的后续教学改进建议']],
}

export default function AnalysisReports({ state, students, tab, onTab, onStudent, onGenerate, busy = false, error = '', embedded = false, report = null, demoState, generatedTabs = [] }) {
  const [selected, setSelected] = useState(null)
  useEffect(() => { setSelected(null) }, [state.sectionId])
  const displayState = report?.demo && demoState ? demoState : state
  const [title, chapters] = definitions[tab] || definitions.pre
  const section = report?.sections?.[tab]
  const data = report?.analytics
  const charts = data?.charts?.[tab] || []
  const number = reportTabs.findIndex(([key]) => key === tab) + 1
  return <main className={`analysis-workspace ${embedded ? 'embedded-report report' : ''}`} >{!embedded && <nav className="report-sidebar" aria-label="分析报告分类"><h2>分析报告</h2><p>全流程学情洞察</p>{reportTabs.map(([key, label], i) => <button key={key} className={key === tab ? 'active' : ''} aria-current={key === tab ? 'page' : undefined} onClick={() => { setSelected(null); onTab(key) }}><span className="report-nav-number">0{i+1}</span>{label}{generatedTabs.includes(key) && <span className="report-nav-dot" />}</button>)}</nav>}<section className="analysis-content">
    <header className="report-page-header"><div><p className="report-eyebrow">班级管理 / 分析报告</p><h1>{selected ? `${selected.name}的成长画像` : title}</h1><p>{state.lessonTitle || '当前课堂'} · {students.length} 名学生{report?.generatedAt ? ` · 生成于 ${new Date(report.generatedAt).toLocaleString('zh-CN')}` : ''}</p></div><div className="editor-actions"><button className="primary" disabled={busy || !onGenerate} onClick={() => onGenerate(tab)}>{busy ? '正在生成…' : report && !report.demo ? '重新生成当前报告' : '生成当前报告'}</button>{report && <button className="ghost" onClick={() => window.print()}>导出 PDF</button>}</div></header>
    {report?.demo && <div className="report-source-notice" role="status"><strong>当前为演示报告,真实报告正在生成</strong><span>基于当前班级 {students.length} 名学生的模拟记录。</span></div>}
    <div className="report-kpis">{[['预习正确率', data?.previewAccuracy, '%'], ['课后正确率', data?.reviewAccuracy, '%'], ['课堂提问', data?.questionCount, '次'], ['已评分课堂回答', data?.gradedClassAnswers, '条']].map(([label, value, unit]) => <article key={label}><span>{label}</span><strong>{value ?? '—'}<small>{value == null ? '' : unit}</small></strong></article>)}</div>
    {error && <p role="alert" className="voice-error">{error}</p>}
    {selected ? <><button className="ghost" onClick={() => setSelected(null)}>返回成长总览</button><StudentReport state={displayState} student={selected} /></> : <>
      {busy && <AILoading text="正在生成当前报告，期间继续展示演示内容…" />}
      <section className="report-ai-summary"><div><span className="report-ai-badge">AI 分析</span><h2>教学诊断摘要</h2></div><p>{section?.summary || '图表展示已记录的学情统计。生成报告后，AI 将结合学生作答、学伴对话及课堂纪要，给出诊断与教学建议。'}</p>{section?.evidence?.length > 0 && <details><summary>查看分析依据（{section.evidence.length} 条）</summary><ul>{section.evidence.map((text, i) => <li key={i}>{text}</li>)}</ul></details>}</section>
      <div className="report-chapters">{chapters.map((heading, i) => {
        const chapter = section?.chapters?.[i]
        return <section className="report-chapter" key={heading}><h2><span>{number}.{i+1}</span>{heading}</h2>{chapter ? <><p>{chapter.analysis}</p>{chapter.recommendations?.length > 0 && <div className="report-recommendations"><strong>教学建议</strong><ul>{chapter.recommendations.map((text, j) => <li key={j}>{text}</li>)}</ul></div>}</> : <p className="report-placeholder">生成报告后展示本节分析与建议。</p>}{charts[i] && <ReportChart {...charts[i]} />}</section>
      })}</div>
      {tab === 'growth' && <section className="report-students"><h2>学生个人成长画像</h2><div className="student-cards">{students.map(student => <button key={student.id} onClick={() => { setSelected(student); onStudent?.(student) }}><span className="report-avatar">{student.name.slice(-2)}</span><strong>{student.name}</strong><small>查看个人报告 →</small></button>)}</div></section>}
      {tab === 'standards' && <section className="report-boundaries"><h3>评价依据</h3><p>{displayState.curriculumGoals || '尚未提供课标目标原文，无法评价正式达标情况。'}</p><p>学校人才培养要求：{displayState.trainingRequirements || '尚未提供学校方案。'}</p></section>}
      {report?.limitations?.length > 0 && <section className="report-boundaries"><h3>数据范围与限制</h3><ul>{report.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></section>}
    </>}
  </section></main>
}
