import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import { createDiscussion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion } from '../src/discussion.js'
import { createLearningPack, simulateLearningAnswers } from '../src/learning.js'

// Render actual JSX without booting the DOM or opening a browser.
const require = createRequire(import.meta.url)
const reactUrl = pathToFileURL(require.resolve('react')).href
let source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
source = source.replace(/^import .*\n/gm, '').replace(/^createRoot\(document.*$/m, '')
source = source.replace(/^const geographyTools = .*$/m, 'const geographyTools = []')
source = `import React, { useEffect, useMemo, useRef, useState } from ${JSON.stringify(reactUrl)};
import { useVoiceCapture } from ${JSON.stringify(new URL('../src/useVoiceCapture.js', import.meta.url).href)};
import { createDiscussion, defaultDiscussionQuestion, joinDiscussion, startDiscussion, setGroupAnswer, summarizeDiscussion } from ${JSON.stringify(new URL('../src/discussion.js', import.meta.url).href)};
import { createLearningPack, simulateLearningAnswers, submitLearningAnswers } from ${JSON.stringify(new URL('../src/learning.js', import.meta.url).href)};
import { saveMaterials, useMaterial } from ${JSON.stringify(new URL('../src/materials.js', import.meta.url).href)};
${source}
export { Teacher, StageControls, GeographyTools, GeographyToolMenu, TeacherQuestion, DiscussionSetup, StudentDiscussion, ScreenDiscussion, MaterialWorkspace, LearningOverview, LearningExercises, UploadedPresentation };`
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
const prepared = { phase: 'before', slide: 0, materials: [], learningPack, learningAnswers: simulateLearningAnswers(learningPack, students) }
assert.match(render('MaterialWorkspace', { state: prepared, students }), /查看课前预习/)
assert.match(render('MaterialWorkspace', { state: prepared, students }), /不会生成 PPT/)
for (const stage of ['preview', 'review']) {
  const overview = render('LearningOverview', { stage, state: prepared, students })
  assert.match(overview, /模拟答题记录/)
  assert.match(overview, /未提交/)
  assert.match(overview, /待订正/)
  assert.match(render('LearningExercises', { stage, state: prepared, student: students[2] }), /提交习题/)
}
const teacher = render('Teacher', { state: prepared, students, messages: [], setMessages() {} })
assert.doesNotMatch(teacher, /资源管理|上一页|下一页/)
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
