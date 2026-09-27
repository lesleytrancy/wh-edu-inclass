import assert from 'node:assert/strict'
import { captureStageSnapshot } from '../src/snapshot.js'

const draws = []
const context = {
  fillStyle: '', fillRect(...args) { draws.push(['fill', ...args]) },
  drawImage(...args) { draws.push(['image', ...args]) },
}
const output = { width: 0, height: 0, getContext: () => context, toDataURL: (type, quality) => `data:${type};quality=${quality}` }
globalThis.document = { createElement: tag => { assert.equal(tag, 'canvas'); return output } }
const page = { getBoundingClientRect: () => ({ left: 110, top: 70, width: 800, height: 500 }) }
const overlay = { id: 'annotation' }
const stage = {
  getBoundingClientRect: () => ({ left: 100, top: 50, width: 1000, height: 600 }),
  querySelector: selector => { assert.equal(selector, '.pdf-page, .uploaded-image'); return page },
}
const result = captureStageSnapshot(stage, overlay)
assert.equal(result, 'data:image/jpeg;quality=0.82')
assert.equal(draws[1][0], 'image')
assert.equal(draws[1][1], page)
assert.deepEqual(draws[1].slice(2).map(Math.round), [14, 27, 1120, 667])
assert.deepEqual(draws[2], ['image', overlay, 0, 0, 1400, 800])
