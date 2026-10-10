import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsxModuleUrl } from './jsx-loader.js'

const { ChatContent, ChatMessages } = await import(await jsxModuleUrl(new URL('../src/ChatContent.jsx', import.meta.url)))
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('AI Markdown formats headings, lists, tables and code within a bubble', () => {
  const text = '# 分析\n\n**关键条件**与`石灰岩`\n\n- 酸性水\n- 岩石裂隙\n\n```js\nconst water = 1\n```\n\n| 条件 | 作用 |\n| --- | --- |\n| 水 | 溶蚀 |\n\n[资料](https://example.org)'
  const html = render(ChatContent, { text, from: 'agent' })
  assert.match(html, /<h1>分析<\/h1>/)
  assert.match(html, /<strong>关键条件<\/strong>/)
  assert.match(html, /<code>石灰岩<\/code>/)
  assert.match(html, /<ul>\s*<li>酸性水<\/li>/)
  assert.match(html, /<pre><code class="language-js">const water = 1/)
  assert.match(html, /class="chat-table-scroll"><table>/)
  assert.match(html, /href="https:\/\/example.org" target="_blank" rel="noopener noreferrer"/)
})

test('user text remains literal and bot replies discard executable HTML and URLs', () => {
  const html = render(ChatContent, { from: 'me', text: '**原文**\n<script>alert(1)</script>' })
  assert.match(html, /\*\*原文\*\*/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<strong>|<script>/)
  const bot = render(ChatContent, { from: 'bot', text: '<script>alert(1)</script>\n\n[危险](javascript:alert%281%29)\n\n**安全回复**' })
  assert.doesNotMatch(bot, /<script|href="javascript:|alert\(1\)/)
  assert.match(bot, /<strong>安全回复<\/strong>/)
})

test('thinking bubbles appear only during pending requests for both roles', () => {
  for (const botFrom of ['agent', 'bot']) {
    const messages = [{ from: 'me', text: '请解释地貌形成' }]
    const waiting = render(ChatMessages, { messages, busy: true, botFrom })
    assert.match(waiting, new RegExp(`message ${botFrom} thinking-message`))
    assert.match(waiting, /role="status" aria-live="polite"/)
    assert.match(waiting, /思考中/)
    assert.equal((waiting.match(/<span>\.<\/span>/g) || []).length, 3)
    for (const text of ['**已完成回复**', 'AI 服务暂不可用，请重试。']) {
      const complete = render(ChatMessages, { messages: [...messages, { from: botFrom, text }], busy: false, botFrom })
      assert.doesNotMatch(complete, /thinking-message|thinking-dots/)
      assert.match(complete, /已完成回复|AI 服务暂不可用/)
    }
    assert.equal(messages.length, 1)
  }
})
