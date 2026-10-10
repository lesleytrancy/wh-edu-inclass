import { classroomReportScope } from './reports.js'

const inferredFields = ['abilityProfiles', 'learningProgress', 'studentExpressionScores', 'studentCrossSubjectAccuracy', 'lessonScoreHistory', 'standardizedScoreHistory']
export function realLearningState(state) {
  const clean = value => {
    if (Array.isArray(value)) return value.filter(item => !item?.simulated).map(clean)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'simulation' && !item?.simulated).map(([key, item]) => [key, clean(item)]))
    return value
  }
  const result = clean(state)
  if (state.simulation) for (const key of inferredFields) delete result[key]
  return result
}

export function saveStudentGrowthReports(state, source, result) {
  if (classroomReportScope(state) !== classroomReportScope(source)) return state
  if (result.status === 'generating') return { ...state, studentGrowthReportStatus: { status: 'generating' } }
  if (result.error) return { ...state, studentGrowthReportStatus: { status: 'error', error: result.error } }
  return { ...state, studentGrowthReports: result.reports, studentGrowthReportStatus: { status: 'ready', generatedAt: result.generatedAt } }
}
