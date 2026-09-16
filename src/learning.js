export function createLearningPack() {
  return {
    preview: { title: '课前预习', task: '阅读课本第 42–45 页，观察喀斯特地貌图片，记录水与石灰岩作用的过程。', exercises: [
      { id: 'p1', question: '雨水中吸收的哪种气体参与石灰岩溶蚀？', options: ['氧气', '二氧化碳', '氮气'], answer: '二氧化碳' },
      { id: 'p2', question: '雨水主要沿着石灰岩的什么位置向下渗透？', options: ['裂隙', '完整岩石表面', '空气'], answer: '裂隙' },
    ] },
    review: { title: '课后复习', task: '回顾练习册第 18–20 页，对比溶蚀与沉积，完成地貌形成过程的回顾练习。', exercises: [
      { id: 'r1', question: '钟乳石形成主要属于哪一种过程？', options: ['溶蚀', '沉积', '风化'], answer: '沉积' },
      { id: 'r2', question: '溶洞的地下空间主要由哪一种作用形成？', options: ['沉积', '风力搬运', '溶蚀'], answer: '溶蚀' },
    ] },
  }
}

export function simulateLearningAnswers(pack, students, existing = {}) {
  const answers = { ...existing }
  for (const stage of ['preview', 'review']) {
    answers[stage] = { ...existing[stage] }
    students.slice(0, 2).forEach((student, index) => {
      if (answers[stage][student.id]) return
      answers[stage][student.id] = Object.fromEntries(pack[stage].exercises.map((exercise, questionIndex) => [exercise.id, { text: index === 1 && questionIndex === 1 ? exercise.options.find(option => option !== exercise.answer) : exercise.answer, simulated: true, submittedAt: Date.now() }]))
    })
  }
  return answers
}

export function publishLearningContent(state, stage, content) {
  if (!['preview', 'review'].includes(stage) || !content?.title || !content?.task || !content.exercises?.length) return state
  const sentAt = Date.now()
  const published = { ...content, exercises: content.exercises.map(exercise => ({ ...exercise, options: [...exercise.options] })) }
  const notification = { id: `${stage}-${sentAt}`, stage, title: `${content.title}资料与测验已发布`, sentAt }
  return { ...state, updatedAt: sentAt, learningPack: { ...state.learningPack, [stage]: published }, publishedLearningPack: { ...state.publishedLearningPack, [stage]: published }, learningNotifications: [notification, ...(state.learningNotifications || [])].slice(0, 20) }
}

export function publishLearningPack(state) {
  const pack = state.learningPack
  if (!pack?.preview || !pack?.review) return state
  const sentAt = Date.now()
  const copy = Object.fromEntries(['preview', 'review'].map(stage => [stage, { ...pack[stage], exercises: pack[stage].exercises.map(exercise => ({ ...exercise, options: [...exercise.options] })) }]))
  const notification = { id: `learning-pack-${sentAt}`, stage: 'preview', title: '课前预习与课后复习资料已发布', sentAt }
  return { ...state, updatedAt: sentAt, publishedLearningPack: copy, learningNotifications: [notification, ...(state.learningNotifications || [])].slice(0, 20) }
}

export function submitLearningAnswers(state, stage, studentId, responses) {
  const content = state.publishedLearningPack?.[stage] || state.learningPack?.[stage]
  if (!content || !['preview', 'review'].includes(stage) || content.exercises.some(exercise => !exercise.options.includes(responses[exercise.id]))) return state
  const now = Date.now()
  const answers = Object.fromEntries(content.exercises.map(exercise => [exercise.id, { text: responses[exercise.id], simulated: false, submittedAt: now }]))
  const hints = {
    p1: '想一想：雨水吸收气体后为什么会变成弱酸？把气体、碳酸和石灰岩的作用串起来。',
    p2: '观察岩石内部的缝隙：水通过哪里进入地下？比较完整岩面与有缝隙的位置。',
    r1: '观察洞顶滴水留下的物质：岩石是在减少，还是有新物质逐渐累积？',
    r2: '地下空间变大时，原来的岩石去了哪里？区分岩石被水带走和物质重新堆积。',
  }
  const items = content.exercises.map((exercise, index) => ({
    question: exercise.question, response: responses[exercise.id], correct: responses[exercise.id] === exercise.answer,
    guidance: responses[exercise.id] === exercise.answer ? `第 ${index + 1} 题判断正确。试着用自己的话解释这一过程，并举一个地貌例子。` : `第 ${index + 1} 题需要再想一想。${hints[exercise.id] || '回顾资料中与题目相关的过程，比较各选项的条件和结果。'}`,
  }))
  const correctCount = items.filter(item => item.correct).length
  const feedback = {
    id: Math.max(now, (state.learningFeedback?.[stage]?.[studentId]?.id || 0) + 1), stage, studentId,
    summary: `${content.title}：${items.length} 题中 ${correctCount} 题正确。${correctCount === items.length ? '基础概念掌握较好，建议继续解释形成过程。' : '建议结合以下提示回顾知识点，再尝试订正。'}`,
    items, analyzedAt: now, reportedAt: null,
  }
  return { ...state, updatedAt: now, learningAnswers: { ...state.learningAnswers, [stage]: { ...state.learningAnswers?.[stage], [studentId]: answers } }, learningFeedback: { ...state.learningFeedback, [stage]: { ...state.learningFeedback?.[stage], [studentId]: feedback } } }
}

export function reportLearningFeedback(state, stage, studentId, feedbackId) {
  const feedback = state.learningFeedback?.[stage]?.[studentId]
  if (!feedback || feedback.id !== feedbackId || feedback.reportedAt) return state
  const now = Date.now()
  return { ...state, updatedAt: now, learningFeedback: { ...state.learningFeedback, [stage]: { ...state.learningFeedback[stage], [studentId]: { ...feedback, reportedAt: now } } } }
}
