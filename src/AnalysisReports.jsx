import React, { useState } from 'react'
import { ReportChart } from './ClassroomReport.jsx'
import { classroomRuns, reportTabs, sampleNotice, stageReport, studentMetrics } from './reports.js'

export function SampleNotice() { return <p className="sample-report-note" role="status">{sampleNotice}</p> }
function MetricTable({ title, rows, analysisLabel = '分析项' }) {
  return <section className="metric-section"><h2>{title}</h2><div className="metric-table-scroll"><table className="metric-table"><thead><tr><th>指标</th><th>{analysisLabel}</th><th>当前表现</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.description}</td><td><strong>{row.value}{row.unit}</strong>{row.sample && <small>示例数据</small>}</td></tr>)}</tbody></table></div></section>
}
export function StudentReport({ state, student }) {
  const metrics = studentMetrics(state, student)
  const sample = [...metrics.performance, ...metrics.growth].some(item => item.sample)
  return <article className="student-analysis"><header><small>学生学情分析 · 学号 {student.id}</small><h1>{student.name}的成长报告</h1><p>从课堂表现与成长值两个维度，观察学习过程。</p></header>{sample && <SampleNotice />}
    <MetricTable title="一、课堂表现" rows={metrics.performance} />
    <ReportChart title={`课堂表现雷达图${metrics.performance.some(item => item.sample) ? '（含示例数据）' : ''}`} type="radar" labels={metrics.performance.filter(item => item.unit !== '次').map(item => item.label)} values={metrics.performance.filter(item => item.unit !== '次').map(item => item.value)} />
    <MetricTable title="二、成长值" rows={metrics.growth} analysisLabel="分析项目" />
    <section className="diagnostic-card"><h3>学习建议</h3><p>{sample ? '示例建议：尝试用“观点—证据—结论”组织回答，并在每次学习后记录一个疑问。待数据获取后，再结合实际表现进行分析。' : '结合已完成任务回顾错题，并将课堂讨论中的证据整理为自己的解释。'}</p></section>
  </article>
}
export function PreLearningReport({ state, students, stage = 'preview' }) {
  const report = stageReport(state, students, stage)
  const sample = !report.available
  const labels = sample ? ['概念理解', '过程解释', '实践应用'] : report.rows.map(row => row.student.name)
  const values = sample ? [85, 72, 68] : report.rows.map(row => row.graded ? Math.round(row.correct / row.graded * 100) : null)
  return <><h1>{stage === 'preview' ? '课前预习结果分析' : '课后学习总结'}</h1>{sample && <SampleNotice />}<p>{sample ? '示例分析：基础概念掌握较好，过程解释和实践应用仍需加强。建议通过图示讲解与情境练习巩固理解。' : `已收到 ${report.rows.filter(row => row.submitted).length} 位学生的真实提交。${report.accuracy === null ? '已提交题目暂未评分。' : `客观题平均正确率 ${report.accuracy}%。`}建议结合错题组织针对性讲解。`}</p><ReportChart title={`答题正确率（%）${sample ? ' · 示例数据' : ''}`} type="bar" labels={labels} values={values} />{!sample && <div className="learning-students">{report.rows.map(row => <article key={row.student.id}><strong>{row.student.name}</strong><p>{row.submitted ? `已答 ${row.submitted}/${row.total} 题 · 已评分 ${row.graded} 题 · 正确 ${row.correct} 题` : '未提交'}</p></article>)}</div>}</>
}
function ProcessReport({ state, tab }) {
  const runs = classroomRuns(state).filter(run => run.startedAt && (tab !== 'questions' || run.kind !== 'discussion'))
  const sample = !runs.length
  const answers = runs.map(run => (run.answers || []).filter(answer => answer.text?.trim()).length)
  const titles = { quality: '课堂互动参与情况', questions: '课堂提问回应情况' }
  return <><h1>{reportTabs.find(([key]) => key === tab)[1]}</h1>{sample && <SampleNotice />}<p>{sample ? '示例分析：课堂通过概念提问、图示分析与小组讨论逐步推进。建议为解释型问题留出更多思考与回应时间。' : `已记录 ${runs.length} 次课堂活动，收集 ${answers.reduce((a, b) => a + b, 0)} 条有效回答。可结合参与人数与学生回答，调整提问节奏和讨论安排。`}</p><ReportChart title={`${titles[tab]}${sample ? ' · 示例数据' : ''}`} type="bar" labels={sample ? ['概念提问', '图示分析', '小组讨论'] : runs.map((run, i) => `${i + 1}. ${run.question || '课堂活动'}`)} values={sample ? [24, 19, 8] : answers} />{!sample && runs.map(run => <section className="diagnostic-card" key={run.id}><h3>{run.question}</h3><p>{(run.answers || []).filter(answer => answer.text?.trim()).length} 条有效回答</p>{(run.answers || []).filter(answer => answer.text?.trim()).map(answer => <p key={answer.id}><strong>{answer.name}：</strong>{answer.text}</p>)}</section>)}</>
}
function GrowthOverview({ state, students, onStudent }) {
  const rows = students.map(student => ({ student, metric: studentMetrics(state, student).growth[0] }))
  const hasReal = rows.some(row => !row.metric.sample)
  return <><h1>成长总览</h1><p>点击学生，查看课堂表现与成长值。</p>{!hasReal && <SampleNotice />}<ReportChart title={`跨课节标准分提升（分）${hasReal ? '' : ' · 示例数据'}`} type="bar" labels={hasReal ? rows.map(row => row.student.name) : ['第一阶段', '第二阶段', '第三阶段']} values={hasReal ? rows.map(row => row.metric.sample ? null : row.metric.value) : [3, 5, 8]} /><div className="student-cards">{students.map(student => <button key={student.id} onClick={() => onStudent(student)}><span>{student.name.slice(-1)}</span><strong>{student.name}</strong><small>学号 {student.id}</small></button>)}</div></>
}
export default function AnalysisReports({ state, students, tab, onTab, onStudent }) {
  const [selected, setSelected] = useState(null)
  return <main className="analysis-workspace"><nav className="report-sidebar" aria-label="分析报告分类"><h2>分析报告</h2>{reportTabs.map(([key, label]) => <button key={key} className={key === tab ? 'active' : ''} onClick={() => { setSelected(null); onTab(key) }}>{label}</button>)}</nav><section className="analysis-content">
    {selected ? <><button className="ghost" onClick={() => setSelected(null)}>返回成长总览</button><StudentReport state={state} student={selected} /></> : tab === 'pre' || tab === 'after' ? <PreLearningReport state={state} students={students} stage={tab === 'pre' ? 'preview' : 'review'} /> : tab === 'quality' || tab === 'questions' ? <>{tab === 'quality' && state.classroomReport && <section className="diagnostic-card">{state.classroomReport.fallback && <SampleNotice />}<h2>{state.classroomReport.title}</h2><p>{state.classroomReport.conclusion}</p><ReportChart title="教学能力多维分析" type="radar" labels={['目标达成', '教学节奏', '提问有效性', '回应质量', '课堂管理']} values={state.classroomReport.radar} /></section>}<ProcessReport state={state} tab={tab} /></> : tab === 'growth' ? <GrowthOverview state={state} students={students} onStudent={student => { setSelected(student); onStudent?.(student) }} /> : <><h1>新课标落实</h1><SampleNotice /><p>示例分析：通过地貌观察、成因解释和情境探究，落实区域认知、综合思维、地理实践力与人地协调观。待获取课标目标及评价记录后更新。</p><ReportChart title="地理核心素养目标落实 · 示例数据（%）" type="radar" labels={['区域认知', '综合思维', '地理实践力', '人地协调观']} values={[85, 78, 72, 80]} /></>}
  </section></main>
}
