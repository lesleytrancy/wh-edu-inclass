import { useEffect, useRef, useState } from 'react'
import { generateReportSection, getDemoReports } from './ai.js'
import { classroomReportScope, reportTabs } from './reports.js'

// Real results live only in this viewing session. Demo evidence never enters classroom state.
export function useClassroomReport(state, students) {
  const latest = useRef(state), epoch = useRef(0), pending = useRef(new Map())
  const [results, setResults] = useState({ scope: null, tabs: {} })
  const [statuses, setStatuses] = useState({})
  const [demo, setDemo] = useState(null), [demoError, setDemoError] = useState('')
  latest.current = state
  const scope = classroomReportScope(state)
  const roster = JSON.stringify(students.map(({ id, name, group }) => ({ id, name, group })))
  const demoKey = JSON.stringify([roster, state.lessonTitle])
  const reset = () => {
    epoch.current += 1
    pending.current.clear()
    setResults({ scope: null, tabs: {} })
    setStatuses({})
  }
  useEffect(() => { reset() }, [scope])
  useEffect(() => {
    let cancelled = false
    setDemoError('')
    getDemoReports({ reportStudents: JSON.parse(roster), lessonTitle: state.lessonTitle }).then(value => {
      if (!cancelled) setDemo({ key: demoKey, ...value })
    }).catch(error => { if (!cancelled) setDemoError(error.message) })
    return () => { cancelled = true }
  }, [demoKey])
  const generate = (tab, source = latest.current) => {
    if (!reportTabs.some(([key]) => key === tab)) throw new Error('请选择要生成的报告')
    const key = `${classroomReportScope(source)}:${tab}`
    if (pending.current.has(key)) return pending.current.get(key)
    const version = epoch.current
    setStatuses(current => ({ ...current, [key]: { busy: true, error: '' } }))
    const request = (async () => {
      try {
        const report = await generateReportSection(tab, { ...source, reportStudents: students })
        if (epoch.current === version && classroomReportScope(latest.current) === classroomReportScope(source)) {
          setResults(current => ({ scope: classroomReportScope(source), tabs: { ...(current.scope === classroomReportScope(source) ? current.tabs : {}), [tab]: report } }))
        }
        return report
      } catch (error) {
        if (epoch.current === version) setStatuses(current => ({ ...current, [key]: { busy: false, error: error.message || '报告生成失败，请重试。' } }))
      } finally {
        if (epoch.current === version) {
          pending.current.delete(key)
          setStatuses(current => ({ ...current, [key]: { ...current[key], busy: false } }))
        }
      }
    })()
    pending.current.set(key, request)
    return request
  }
  const currentDemo = demo?.key === demoKey ? demo : null
  const tabs = results.scope === scope ? results.tabs : {}
  return {
    generate, reset, demoState: currentDemo?.state, generatedTabs: Object.keys(tabs),
    reportFor: tab => tabs[tab] || currentDemo?.report || null,
    busyFor: tab => !!statuses[`${scope}:${tab}`]?.busy,
    errorFor: tab => statuses[`${scope}:${tab}`]?.error || demoError,
  }
}
