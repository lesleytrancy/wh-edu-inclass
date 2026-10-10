import React from 'react'
import AnalysisReports from './AnalysisReports.jsx'
export { ReportChart, AILoading } from './ReportCharts.jsx'

export default function ClassroomReport({ state, students, busy, error, onGenerate, report, demoState, generatedTabs }) {
  return <AnalysisReports embedded state={state} students={students} tab="after" report={report} demoState={demoState} generatedTabs={generatedTabs} busy={busy} error={error} onGenerate={onGenerate} />
}
