import { createLearningPack } from './learning.js'

const discussionQuestion = '为什么石灰岩地区容易形成溶洞？请用水、二氧化碳和岩石之间的关系解释，并比较溶蚀与沉积。'
const suggestions = ['用“雨水吸收 CO₂—形成弱酸性水—沿裂隙溶解石灰岩”串联因果过程。', '对比溶洞与钟乳石，追问溶蚀和沉积的发生条件。', '让学生引用资料证据解释地貌形成，再用新情境检查迁移能力。']
const conclusion = '喀斯特地貌学习应重点检查三个环节：形成条件是否完整、溶蚀过程是否连贯、是否能够区分溶蚀与沉积。'
export function demoResult(path, input = {}) {
  const base = { fallback: true, fallbackReason: 'timeout', sourceRefs: [] }
  const pack = () => {
    const result = createLearningPack()
    return { ...base, ...result, discussionQuestion }
  }
  if (path === '/api/resources') return pack()
  if (path.endsWith('/regenerate')) return input.stage === 'discussion' ? { ...base, discussionQuestion } : { ...base, ...pack()[input.stage] }
  if (path.endsWith('/snapshot-question')) return { ...base, question: discussionQuestion }
  if (path.endsWith('/chat')) return { ...base, answer: `${input.role === 'student' ? '先想一想：雨水中溶入了什么气体？它如何影响石灰岩？请用资料中的一条证据解释。' : `${conclusion}\n${suggestions.join('\n')}`}` }
  if (path.endsWith('/learning/analyze')) return { ...base, summary: conclusion, items: (input.content?.exercises || []).map(item => ({ question: item.question, response: input.responses?.[item.id] || '', correct: input.responses?.[item.id] === item.answer, guidance: '请回看形成条件与作用过程，区分岩石被溶解和物质重新沉积，并解释选择依据。' })) }
  if (path.endsWith('/insight')) return { ...base, conclusion, suggestions }
  if (path.endsWith('/classroom/analyze')) return { ...base, summary: conclusion, commonIssue: '示例关注点：解释溶洞时遗漏二氧化碳参与形成弱酸性水的中间环节，或将钟乳石形成与溶蚀混淆。', extension: suggestions.join('\n') }
  if (path.endsWith('/report')) return { ...base, title: '《喀斯特地貌》课堂诊断报告 · 演示', conclusion, questionCounts: [2, 4, 2, 1, 1], radar: [80, 75, 78, 72, 85], timeline: [{ label: '导入', start: 0, end: 300 }, { label: '讲授', start: 300, end: 1200 }, { label: '练习', start: 1200, end: 2400 }, { label: '小结', start: 2400, end: 2700 }], mode: '对话型（演示）', transitions: [{ label: '讲授转为对话：解释溶洞形成', start: 1200, end: 1200 }], suggestions, issues: [{ problem: '示例：提问停留在地貌名称识记，因果解释追问不足。', evidence: '预设提问情境：“这是什么地貌？”之后可增加“为什么形成？”', suggestion: suggestions[0] }, { problem: '示例：学生混淆溶蚀与沉积。', evidence: '预设回答情境：“钟乳石是石灰岩被溶解后留下的。”', suggestion: suggestions[1] }], limitations: ['本报告图表、教学模式和改进点均为喀斯特地貌预设示例；候答统计如有显示，来自实际记录。'] }
  return null
}
