import assert from 'node:assert/strict'
import { getMaterialPage, turnMaterialPage } from '../src/materials.js'

const pdf = { id: 'pdf', name: '课件.pdf', type: 'application/pdf' }
const image = { id: 'image', name: '图片.png', type: 'image/png' }
let state = { materials: [pdf, image] }
assert.equal(getMaterialPage(state, 'pdf'), 1)
assert.equal(turnMaterialPage(state, 'pdf', -1), state)
assert.equal(turnMaterialPage(state, 'missing', 1), state)
assert.equal(turnMaterialPage(state, 'image', 1), state)
assert.equal(turnMaterialPage(state, 'pdf', 0), state)
state = turnMaterialPage(state, 'pdf', 1)
assert.equal(getMaterialPage(state, 'pdf'), 2)
assert.equal(state.slide, 1)
assert.equal(getMaterialPage(state, 'image'), 1)
state = turnMaterialPage(state, 'pdf', -1)
assert.equal(getMaterialPage(state, 'pdf'), 1)
assert.equal(state.slide, 0)
for (const page of [0, -1, 1.5, '2', NaN]) {
  assert.equal(getMaterialPage({ materialPages: { pdf: page } }, 'pdf'), 1)
}
assert.equal(turnMaterialPage(state, 'pdf', 1, 1), state)
const lastPage = { ...state, materialPages: { pdf: 3 } }
assert.equal(turnMaterialPage(lastPage, 'pdf', 1, 3), lastPage)
