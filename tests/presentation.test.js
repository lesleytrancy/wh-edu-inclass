import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPowerPoint, isPresentation } from '../src/materials.js'
import { presentationMode, setPresentationPage } from '../src/pptx-state.js'
test('PowerPoint files are recognized separately from PDF and Word materials', () => {
  for (const name of ['课件.ppt', '课件.PPTX']) assert.ok(isPowerPoint({ name }))
  assert.ok(isPresentation({ type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))
  assert.ok(isPresentation({ name: 'lesson.pdf' }))
  assert.equal(isPresentation({ name: 'lesson.docx' }), false)
})
test('preview keeps edit mode separate and class starts presentation mode', () => {
  assert.equal(presentationMode('before'), 'preview')
  assert.equal(presentationMode('before', true), 'edit')
  assert.equal(presentationMode('class', true), 'present')
  assert.equal(presentationMode('after'), 'preview')
})
test('PPT pages synchronize only valid material pages', () => {
  const state = { materials: [{ id: 'pptx' }] }
  const next = setPresentationPage(state, 'pptx', 2, 3)
  assert.equal(next.materialPages.pptx, 2)
  assert.equal(next.slide, 1)
  assert.equal(setPresentationPage(next, 'pptx', 2, 3), next)
  for (const page of [0, -1, 1.5, 4]) assert.equal(setPresentationPage(state, 'pptx', page, 3), state)
  assert.equal(setPresentationPage(state, 'missing', 1, 3), state)
})
