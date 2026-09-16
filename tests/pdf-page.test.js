import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderPdfPage } from '../src/pdf-page.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('late PDF renders cannot overwrite the next page', async () => {
  const original = globalThis.document
  const commits = []
  globalThis.document = { createElement: () => ({ getContext: () => ({}) }) }
  try {
    const first = deferred(), second = deferred()
    let cancellations = 0
    const pdf = { getPage: async number => ({
      getViewport: ({ scale }) => ({ width: 100 * scale, height: 50 * scale }),
      render: ({ canvasContext }) => {
        canvasContext.page = number
        return { promise: (number === 1 ? first : second).promise, cancel() { cancellations++ } }
      },
    }) }
    // Each buffer records which page was rendered into it.
    globalThis.document.createElement = () => {
      const context = {}
      return { getContext: () => context, context }
    }
    const target = { style: {}, getContext: () => ({ drawImage: buffer => commits.push(buffer.context.page) }) }
    const old = renderPdfPage(pdf, 1, target, { width: 400, height: 200 })
    await Promise.resolve()
    old.cancel()
    const current = renderPdfPage(pdf, 2, target, { width: 400, height: 200 })
    await Promise.resolve()
    second.resolve()
    await current.promise
    first.resolve()
    await old.promise
    assert.deepEqual(commits, [2])
    assert.equal(cancellations, 1)
    assert.equal(target.style.width, '400px')
    assert.equal(target.style.height, '200px')

    const pending = deferred()
    let rendered = false
    const obsolete = renderPdfPage({ getPage: () => pending.promise }, 1, target, { width: 400, height: 200 })
    obsolete.cancel()
    pending.resolve({ render() { rendered = true } })
    await obsolete.promise
    assert.equal(rendered, false)
    assert.deepEqual(commits, [2])
  } finally { globalThis.document = original }
})
