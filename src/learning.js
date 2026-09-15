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

export function submitLearningAnswers(state, stage, studentId, responses) {
  const content = state.learningPack?.[stage]
  if (!content || !['preview', 'review'].includes(stage) || content.exercises.some(exercise => !exercise.options.includes(responses[exercise.id]))) return state
  const answers = Object.fromEntries(content.exercises.map(exercise => [exercise.id, { text: responses[exercise.id], simulated: false, submittedAt: Date.now() }]))
  return { ...state, updatedAt: Date.now(), learningAnswers: { ...state.learningAnswers, [stage]: { ...state.learningAnswers?.[stage], [studentId]: answers } } }
}
