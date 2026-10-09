export function createLearningPack() {
  return {
    preview: { title: '课前预习', task: '阅读课本第 42–45 页，观察喀斯特地貌图片，记录水与石灰岩作用的过程。', exercises: [
      { id: 'p1', question: '雨水中吸收的哪种气体参与石灰岩溶蚀？', options: ['氧气', '二氧化碳', '氮气'], answer: '二氧化碳' },
      { id: 'p2', question: '雨水主要沿着石灰岩的什么位置向下渗透？', options: ['裂隙', '完整岩石表面', '空气'], answer: '裂隙' },
      { id: 'p3', question: '喀斯特地貌发育最典型的岩石是什么？', options: ['石灰岩', '花岗岩', '玄武岩'], answer: '石灰岩' },
    ] },
    review: { title: '课后复习', task: '回顾练习册第 18–20 页，对比溶蚀与沉积，完成地貌形成过程的回顾练习。', exercises: [
      { id: 'r1', question: '钟乳石形成主要属于哪一种过程？', options: ['溶蚀', '沉积', '风化'], answer: '沉积' },
      { id: 'r2', question: '溶洞的地下空间主要由哪一种作用形成？', options: ['沉积', '风力搬运', '溶蚀'], answer: '溶蚀' },
      { id: 'r3', question: '完整描述喀斯特地貌形成过程应包含什么？', options: ['条件—过程—结果', '只列地貌名称', '只描述最终形态'], answer: '条件—过程—结果' },
    ] },
  }
}

export function simulateLearningAnswers(pack, students, existing = {}) {
  return Object.fromEntries(['preview', 'review'].map(stage => [stage, Object.fromEntries(Object.entries(existing[stage] || {}).filter(([, answers]) => Object.values(answers).every(answer => !answer.simulated))) ]))
}

export function publishLearningContent(state, stage, content) {
  if (!['preview', 'review'].includes(stage) || !content?.title || !content?.task || !content.exercises?.length) return state
  const sentAt = Date.now()
  const published = { ...content, exercises: content.exercises.map(exercise => ({ ...exercise, options: [...exercise.options] })) }
  const notification = { id: `${stage}-${sentAt}`, stage, title: `${content.title}资料与测验已发布`, sentAt }
  return { ...state, updatedAt: sentAt, learningPack: { ...state.learningPack, [stage]: published }, publishedLearningPack: { ...state.publishedLearningPack, [stage]: published }, learningNotifications: [notification, ...(state.learningNotifications || [])].slice(0, 20) }
}

export const resourceStages = ['preview', 'discussion', 'review']

export function updateResourceContent(state, stage, content, confirmed = false) {
  if (!resourceStages.includes(stage)) return state
  const patch = content === undefined ? {} : stage === 'discussion'
    ? { discussions: content, discussionQuestion: content.map(item => item.question).filter(Boolean).join('\n\n') }
    : { learningPack: { ...state.learningPack, [stage]: content } }
  return { ...state, ...patch, resourceConfirmations: { ...state.resourceConfirmations, [stage]: confirmed }, updatedAt: Date.now() }
}

export function resourcesConfirmed(state) {
  return !!state.learningPack?.preview && !!state.learningPack?.review && resourceStages.every(stage => state.resourceConfirmations?.[stage])
}

export function studentStageAvailable(phase, stage) {
  return stage === 'preview' || (stage === 'class' && ['class', 'after'].includes(phase)) || (stage === 'review' && phase === 'after')
}

export function publishLearningPack(state) {
  const pack = state.learningPack
  if (!resourcesConfirmed(state)) return state
  const sentAt = Date.now()
  const copy = structuredClone(pack)
  const notification = { id: `learning-pack-${sentAt}`, stage: 'preview', title: '课前预习与课后复习资料已发布', sentAt }
  return { ...state, updatedAt: sentAt, publishedLearningPack: copy, publishedDiscussions: structuredClone(state.discussions || []), publishedDiscussionQuestion: state.discussionQuestion, publishedLearningFallback: !!state.aiFallback, learningNotifications: [notification, ...(state.learningNotifications || [])].slice(0, 20) }
}

export function submitLearningAnswers(state, stage, studentId, responses) {
  const content = state.publishedLearningPack?.[stage] || state.learningPack?.[stage]
  if (!content || !['preview', 'review'].includes(stage) || content.exercises.some(exercise => exercise.type && exercise.type !== 'single' ? !responses[exercise.id]?.trim() : !exercise.options.includes(responses[exercise.id]))) return state
  const now = Date.now()
  const answers = Object.fromEntries(content.exercises.map(exercise => [exercise.id, { text: responses[exercise.id], simulated: false, submittedAt: now }]))
  const stageFeedback = { ...state.learningFeedback?.[stage] }
  delete stageFeedback[studentId]
  return { ...state, updatedAt: now, learningAnswers: { ...state.learningAnswers, [stage]: { ...state.learningAnswers?.[stage], [studentId]: answers } }, learningFeedback: { ...state.learningFeedback, [stage]: stageFeedback } }
}

export function saveLearningFeedback(state, stage, studentId, result) {
  if (!result?.summary || !Array.isArray(result.items)) return state
  const now = Date.now()
  const feedback = { ...result, id: Math.max(now, (state.learningFeedback?.[stage]?.[studentId]?.id || 0) + 1), stage, studentId, analyzedAt: now, reportedAt: null }
  return { ...state, updatedAt: now, learningFeedback: { ...state.learningFeedback, [stage]: { ...state.learningFeedback?.[stage], [studentId]: feedback } } }
}

export function reportLearningFeedback(state, stage, studentId, feedbackId) {
  const feedback = state.learningFeedback?.[stage]?.[studentId]
  if (!feedback || feedback.id !== feedbackId || feedback.reportedAt) return state
  const now = Date.now()
  return { ...state, updatedAt: now, learningFeedback: { ...state.learningFeedback, [stage]: { ...state.learningFeedback[stage], [studentId]: { ...feedback, reportedAt: now } } } }
}
