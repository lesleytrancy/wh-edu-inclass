export function matchingQuestions(bank, { difficulty = 'all', type = 'all', types } = {}) {
  return bank.questions.filter(question => question.images?.length && (difficulty === 'all' || question.difficulty === difficulty) && (types ? types.includes(question.type) : type === 'all' || question.type === type))
}

export function composeQuestions(bank, filters, count, stage, random = Math.random) {
  const pool = matchingQuestions(bank, filters)
  if (!Number.isInteger(count) || count < 1 || count > pool.length) throw new Error(`符合条件且含图片的题目共 ${pool.length} 道，请调整数量或筛选条件。`)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const types = [...new Set(pool.map(question => question.type))]
  const seeds = filters.types?.length > 1 && count >= types.length
    ? types.map(type => pool.find(question => question.type === type)) : []
  const chosen = [...seeds, ...pool.filter(question => !seeds.includes(question))].slice(0, count)
  return chosen.map((question, index) => ({ ...question, id: `${stage}-${Date.now()}-${index}`, bankQuestionId: question.id, bankId: bank.id }))
}
