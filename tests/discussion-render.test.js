import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import { createDiscussion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion, submitDiscussionMinutes, formatDiscussionMinutes } from '../src/discussion.js'
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers, reportLearningFeedback } from '../src/learning.js'

// Render actual JSX without booting the DOM or opening a browser.
const require = createRequire(import.meta.url)
const reactUrl = pathToFileURL(require.resolve('react')).href
const lucideUrl = pathToFileURL(require.resolve('lucide-react')).href
let source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const iconImport = source.match(/^import .* from 'lucide-react'$/m)[0].replace("'lucide-react'", JSON.stringify(lucideUrl))
source = source.replace(/^import .*\n/gm, '').replace(/^createRoot\(document.*$/m, '')
source = source.replace(/^const geographyTools = .*$/m, 'const geographyTools = []')
source = `${iconImport};
import React, { useEffect, useMemo, useRef, useState } from ${JSON.stringify(reactUrl)};
import { setQuestionAnswer } from ${JSON.stringify(new URL('../src/questions.js', import.meta.url).href)};
import { useVoiceCapture } from ${JSON.stringify(new URL('../src/useVoiceCapture.js', import.meta.url).href)};
import { createDiscussion, defaultDiscussionQuestion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion, submitDiscussionMinutes, formatDiscussionMinutes } from ${JSON.stringify(new URL('../src/discussion.js', import.meta.url).href)};
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers, reportLearningFeedback, publishLearningContent, publishLearningPack } from ${JSON.stringify(new URL('../src/learning.js', import.meta.url).href)};
import { saveMaterials, useMaterial, getMaterialPage, turnMaterialPage } from ${JSON.stringify(new URL('../src/materials.js', import.meta.url).href)};
${source}
export { Teacher, Student, StageControls, GeographyTools, GeographyToolMenu, TeacherQuestion, DiscussionSetup, StudentDiscussion, ScreenDiscussion, MaterialWorkspace, LearningOverview, LearningExercises, UploadedPresentation, StudyBuddy, QuestionRecorder, StudentQuestion, CanvasPagination, BigScreen };`
const { code } = await transformWithOxc(source, 'main.jsx', { jsx: { runtime: 'classic' } })
const components = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const students = [{ id: '1', name: '组长甲' }, { id: '2', name: '组长乙' }, { id: '3', name: '组员' }]
const render = (name, props) => renderToStaticMarkup(React.createElement(components[name], { onClose() {}, onStart() {}, onEdit() {}, onStop() {}, updateState() {}, ...props }))
let state = { questionRun: createDiscussion(students, '自定义讨论题', 100) }
assert.match(render('DiscussionSetup', { run: state.questionRun }), /自定义讨论题/)
assert.match(render('DiscussionSetup', { run: state.questionRun }), /语音替换问题/)
assert.match(render('StudentDiscussion', { run: state.questionRun, student: students[2] }), /请选择你要进入的小组/)
state = joinDiscussion(state, 100, '3', 'group-1')
const member = render('StudentDiscussion', { run: state.questionRun, student: students[2] })
assert.match(member, /麦克风已禁用/)
assert.doesNotMatch(member, /student-mic|<textarea/)
state = joinDiscussion(state, 100, '1', 'group-1')
assert.match(render('StudentDiscussion', { run: state.questionRun, student: students[0] }), /开始小组录音/)
state = startDiscussion(state, 100)
state = setGroupAnswer(state, 100, '1', 'group-1', '本组实际回答', true)
for (const name of ['TeacherQuestion', 'ScreenDiscussion']) {
  assert.match(render(name, { run: state.questionRun }), /探索组/)
  assert.match(render(name, { run: state.questionRun }), /本组实际回答/)
  assert.match(render(name, { run: { ...state.questionRun, status: 'analyzing' } }), /分析/)
  const result = { ...state.questionRun, status: 'result', summary: summarizeDiscussion(state.questionRun) }
  assert.match(render(name, { run: result }), /讨论总结/)
  assert.match(render(name, { run: result }), /本组实际回答/)
}
const learningPack = createLearningPack()
const prepared = { phase: 'before', slide: 0, materials: [], learningPack, publishedLearningPack: learningPack, learningAnswers: simulateLearningAnswers(learningPack, students) }
const materialWorkspace = render('MaterialWorkspace', { state: prepared, students })
assert.match(materialWorkspace, /上传资料到课程文件夹/)
assert.match(materialWorkspace, /课前预习/)
assert.match(materialWorkspace, /课中讨论/)
assert.match(materialWorkspace, /课后复习/)
const folderState = { ...prepared, publishedLearningPack: undefined, materials: [{ id: 'doc', name: '教案.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, { id: 'pdf', name: '展示.pdf', type: 'application/pdf' }], analysisMaterialIds: ['doc'] }
const folder = render('MaterialWorkspace', { state: folderState, students })
assert.match(folder, /教案.docx/)
assert.match(folder, /仅用于解析/)
assert.equal((folder.match(/type="radio"/g) || []).length, 1)
assert.match(folder, /AI 解析所选资料（1）/)
const previewEditor = render('MaterialWorkspace', { state: folderState, students, view: 'preview' })
assert.match(previewEditor, /课前学习材料/)
assert.match(previewEditor, /学习任务/)
assert.match(previewEditor, /新增题目/)
assert.match(previewEditor, /选项 1/)
assert.match(previewEditor, /选项 2/)
assert.match(previewEditor, /选项 3/)
assert.doesNotMatch(previewEditor, /用中文逗号分隔/)
assert.match(previewEditor, /保存修改/)
assert.match(previewEditor, /课中预览/)
assert.match(previewEditor, /发送学生端/)
assert.ok(previewEditor.indexOf('课后复习') < previewEditor.indexOf('发送学生端'))
assert.ok(previewEditor.indexOf('发送学生端') < previewEditor.indexOf('课中预览'))
const sentEditor = render('MaterialWorkspace', { state: { ...folderState, publishedLearningPack: learningPack }, students, view: 'preview' })
assert.match(sentEditor, /已发送/)
const discussionEditor = render('MaterialWorkspace', { state: { ...folderState, discussionQuestion: '可编辑讨论题' }, students, view: 'discussion' })
assert.match(discussionEditor, /可编辑讨论题/)
assert.match(discussionEditor, /保存修改/)
const notifiedStudent = render('Student', { student: students[0], state: { ...prepared, learningNotifications: [{ id: 'notice-1', stage: 'preview', title: '新预习已发布', sentAt: 10 }] } })
assert.match(notifiedStudent, /学习资料通知/)
assert.match(notifiedStudent, /<i><\/i><\/button><div class=\"notification-panel\"|<i><\/i><\/button><\/div>/)
const readStudent = render('Student', { student: students[0], state: { ...prepared, learningNotifications: [{ id: 'notice-1', stage: 'preview', title: '新预习已发布', sentAt: 10 }], learningNotificationReads: { '1': 10 } } })
assert.doesNotMatch(readStudent, /<i><\/i><\/button><div class=\"notification-panel\"|<i><\/i><\/button><\/div>/)
for (const stage of ['preview', 'review']) {
  const overview = render('LearningOverview', { stage, state: prepared, students })
  assert.match(overview, /模拟答题记录/)
  assert.match(overview, /未提交/)
  assert.match(overview, /待订正/)
  assert.match(render('LearningExercises', { stage, state: prepared, student: students[2] }), /提交习题/)
}
const teacher = render('Teacher', { state: prepared, students, messages: [], setMessages() {} })
assert.doesNotMatch(teacher, /资源管理/)
assert.match(teacher, /annotation-toggle/)
assert.match(teacher, /aria-label="PPT 批注"/)
assert.match(teacher, /地理工具集/)
const tools = (await readdir(new URL('../tools/', import.meta.url))).filter(name => name.endsWith('.html')).map(name => ({ name: name.replace(/\.html$/, ''), load: async () => '' }))
assert.match(teacher, /资料管理/)
assert.match(teacher, /返回课中/)
assert.doesNotMatch(teacher, /返回资料入口/)
assert.ok(teacher.indexOf('班级管理</button>') < teacher.indexOf('资料管理</button>'))
const toolList = render('GeographyToolMenu', { tools, onSelect() {} })
assert.match(toolList, /<details/)
assert.match(toolList, /<summary/)
for (const tool of tools) assert.ok(toolList.includes(tool.name))
const toolCanvas = render('GeographyTools', { selected: tools[0] })
assert.match(toolCanvas, /地理工具 Canvas/)
assert.doesNotMatch(toolCanvas, /<header|工具列表|geography-tool-options/)
const toolControls = render('StageControls', { usingTool: true, phase: 'class' })
assert.match(toolControls, /返回课中/)
assert.doesNotMatch(toolControls, /发起提问|小组讨论/)
const classControls = render('StageControls', { usingTool: false, phase: 'class' })
assert.match(classControls, /发起提问/)
assert.ok(classControls.indexOf('小组讨论') < classControls.indexOf('返回课中'))
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
assert.match(css, /\.teacher-grid \{ position: relative; z-index: 0; isolation: isolate; \}/)
assert.match(css, /stage-right-actions > button \{ height: 29px; min-height: 29px;/)
assert.ok(source.includes('srcDoc={content}'))
assert.match(render('UploadedPresentation', {}), /等待教师上传/)
console.log('discussion rendering checks passed')

const joinedRun = joinDiscussion({ questionRun: createDiscussion(students, '讨论问题', 500) }, 500, '3', 'group-1').questionRun
for (const status of ['selecting', 'answering', 'analyzing', 'result']) {
  const run = { ...joinedRun, status, answers: [{ id: 'group-1', text: '本组独有回答' }, { id: 'group-2', text: '其他组独有回答' }] }
  if (status === 'result') run.summary = summarizeDiscussion(run)
  const html = render('StudentDiscussion', { run, student: students[2], updateState() {} })
  assert.doesNotMatch(html, /求知组|其他组独有回答|group-selection/)
  if (status === 'result') assert.match(html, /本组独有回答/)
}
let guidedState = submitLearningAnswers(prepared, 'review', '3', { r1: '溶蚀', r2: '溶蚀' })
const feedback = guidedState.learningFeedback.review['3']
const buddy = render('StudyBuddy', { state: guidedState, stage: 'review', student: students[2], updateState() {} })
assert.match(buddy, /习题分析与指导/)
assert.match(buddy, /2 题中 1 题正确/)
assert.match(buddy, /新物质/)
assert.doesNotMatch(render('LearningOverview', { stage: 'review', state: guidedState, students }), /AI 学伴分析/)
guidedState = reportLearningFeedback(guidedState, 'review', '3', feedback.id)
assert.match(render('LearningOverview', { stage: 'review', state: guidedState, students }), /AI 学伴分析/)
assert.match(render('StudyBuddy', { state: guidedState, stage: 'review', student: students[2], updateState() {} }), /分析结果已同步给教师 Agent/)
assert.match(css, /\.student-discussion \.group-selection \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/)

const minutesRun = startDiscussion(joinDiscussion({ questionRun: createDiscussion(students, '讨论问题', 700) }, 700, '1', 'group-1'), 700).questionRun
const savedMinutes = { '700:group-1': { text: '会议纪要：经过确认的讨论要点。' } }
const editor = render('StudentDiscussion', { run: minutesRun, student: students[0], stateMinutes: savedMinutes })
assert.match(editor, /aria-label="会议纪要"/)
assert.match(editor, /经过确认的讨论要点/)
assert.doesNotMatch(editor, /本组讨论转写|语音转写或文字补充/)
const activeHook = 'data:text/javascript;base64,' + Buffer.from('export function useVoiceCapture() { return { active: true, pending: false, error: "", audioUrl: null, start() {}, stop() {} } }').toString('base64')
const recordingSource = source.replace(JSON.stringify(new URL('../src/useVoiceCapture.js', import.meta.url).href), JSON.stringify(activeHook))
const recordingCode = (await transformWithOxc(recordingSource, 'recording.jsx', { jsx: { runtime: 'classic' } })).code
const recordingComponents = await import(`data:text/javascript;base64,${Buffer.from(recordingCode).toString('base64')}`)
const recording = renderToStaticMarkup(React.createElement(recordingComponents.StudentDiscussion, { run: minutesRun, student: students[0], updateState() {}, stateMinutes: savedMinutes }))
assert.match(recording, /停止小组录音/)
assert.doesNotMatch(recording, /<textarea|经过确认的讨论要点|>提交<|>已提交/)
assert.match(render('QuestionRecorder', {}), /开始提问录音/)
assert.doesNotMatch(render('QuestionRecorder', {}), /雨水是怎样一步步/)
assert.match(render('StudentQuestion', { run: { id: 1, question: '实际问题', status: 'answering', answers: [], endAt: Date.now() + 1000 }, student: students[0] }), /开始回答/)

const firstPage = render('CanvasPagination', { page: 1, onTurn() {} })
assert.match(firstPage, /课件翻页/)
assert.match(firstPage, /disabled="" aria-label="上一页"/)
assert.match(firstPage, /aria-label="下一页"/)
assert.doesNotMatch(render('CanvasPagination', { page: 2, onTurn() {} }), /disabled/)
const assetHook = 'data:text/javascript;base64,' + Buffer.from('export function useMaterial() { return { url: "blob:http://localhost/example", error: "" } }').toString('base64')
const assetSource = source.replace(/import \{ saveMaterials, useMaterial, getMaterialPage, turnMaterialPage \} from [^;]+;/, `import { useMaterial } from ${JSON.stringify(assetHook)}; import { getMaterialPage, turnMaterialPage } from ${JSON.stringify(new URL('../src/materials.js', import.meta.url).href)};`)
const assetCode = (await transformWithOxc(assetSource, 'assets.jsx', { jsx: { runtime: 'classic' } })).code
const assetComponents = await import(`data:text/javascript;base64,${Buffer.from(assetCode).toString('base64')}`)
const pdf = { id: 'pdf', name: '课件.pdf', type: 'application/pdf' }
const renderPdf = props => renderToStaticMarkup(React.createElement(assetComponents.UploadedPresentation, { material: pdf, page: 2, onTurn() {}, ...props }))
assert.match(renderPdf({}), /课中展示：课件.pdf · 第 2 页/)
assert.match(renderPdf({}), /课件翻页/)
assert.doesNotMatch(renderPdf({ showControls: false }), /课件翻页/)
assert.doesNotMatch(renderPdf({ onTurn: undefined }), /课件翻页/)
assert.doesNotMatch(renderPdf({ material: { ...pdf, type: 'image/png' } }), /课件翻页/)

const screenPage = renderToStaticMarkup(React.createElement(assetComponents.BigScreen, { state: { phase: 'class', activity: 'screen', materials: [pdf], materialId: 'pdf', materialPages: { pdf: 3 } }, onHome() {}, updateState() {} }))
assert.match(screenPage, /第 3 页/)
assert.doesNotMatch(screenPage, /课件翻页/)

assert.doesNotMatch(renderPdf({}), /<iframe/)
assert.match(render('CanvasPagination', { page: 3, total: 3, onTurn() {} }), /disabled="" aria-label="下一页"/)
assert.equal((render('CanvasPagination', { page: 2, total: 3, busy: true, onTurn() {} }).match(/disabled=""/g) || []).length, 2)
assert.doesNotMatch(render('StageControls', { phase: 'class', hideAsk: true }), /发起提问|拖拽快照/)
assert.match(render('StageControls', { phase: 'class', hideAsk: false }), /发起提问/)
