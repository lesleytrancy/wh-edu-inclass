import React, { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

export function AILoading({ text = 'AI 正在生成内容…' }) {
  return <div className="ai-loading" role="status" aria-live="polite"><span className="analysis-spinner" /><h2>{text}</h2><p>正在整理资料和课堂记录，请稍候。</p></div>
}
const clock = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export function ReportChart({ title, type, labels = [], values = [], datasets, options = {}, note = '', timeline = false }) {
  const canvas = useRef(null)
  const series = datasets || [{ label: title, data: values, backgroundColor: type === 'radar' ? '#9682d844' : ['#9281cc', '#b4ce73', '#7cbecb', '#e5b579', '#d190ae'], borderColor: '#9281cc', borderWidth: 1.5 }]
  const valid = value => typeof value === 'number' && Number.isFinite(value) || Array.isArray(value) && value.some(valid) || value && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y)
  const available = series.some(row => row.data.some(valid)) && (!['pie', 'doughnut', 'polarArea'].includes(type) || series.some(row => row.data.some(value => value > 0)))
  const signature = JSON.stringify({ title, type, labels, series, options, timeline })
  useEffect(() => {
    if (!available) return
    const chart = new Chart(canvas.current, { type, data: { labels, datasets: series }, options: { animation: false, responsive: true, maintainAspectRatio: false, ...(timeline ? { indexAxis: 'y', scales: { x: { title: { display: true, text: '距开课时间（秒）' }, min: 0 } } } : {}), ...(['radar', 'polarArea'].includes(type) ? { scales: { r: { min: 0, ...(type === 'radar' ? { max: 100 } : {}) } } } : {}), ...options, plugins: { legend: { display: !!datasets || ['doughnut', 'pie'].includes(type), position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { afterLabel: context => context.raw?.label || context.raw?.studentId || '' } }, ...options.plugins } } })
    return () => chart.destroy()
  }, [signature, available])
  const display = value => value === null || value === undefined ? '数据不足' : Array.isArray(value) ? value.map(clock).join('–') : typeof value === 'object' ? `${value.label || value.studentId || ''} (${value.x}, ${value.y})` : value
  return <section className="diagnostic-card report-chart-card"><h3>{title}</h3>{available ? <><div className="report-chart"><canvas ref={canvas} role="img" aria-label={`${title}：${series.map(row => `${row.label}，${row.data.map((value, i) => `${labels[i] || ''} ${display(value)}`).join('，')}`).join('；')}`} /></div><details className="chart-data"><summary>查看统计数据</summary><div className="report-data-scroll"><table><thead><tr><th>指标</th>{series.map(row => <th key={row.label}>{row.label}</th>)}</tr></thead><tbody>{(labels.length ? labels : series[0]?.data.map((_, i) => `记录 ${i+1}`) || []).map((label, i) => <tr key={i}><th>{label}</th>{series.map(row => <td key={row.label}>{display(row.data[i])}</td>)}</tr>)}</tbody></table></div></details></> : <p className="sample-report-note">暂无足够的真实数据</p>}{note && <p className="chart-footnote">{note}</p>}</section>
}
