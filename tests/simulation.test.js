import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applySimulationResult, stripSimulationLibrary, deleteSimulationMaterials } from '../src/simulation.js'
const storageFrom = entries => {
  const values = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: i => [...values.keys()][i], get length() { return values.size }, read: key => JSON.parse(values.get(key) ?? 'null') }
}
const real = { sectionId: 'real', phase: 'after', learningAnswers: { review: { '1': { q: { text: '真实回答' } } } } }
const demo = { sectionId: 'demo-geography-30', simulation: { id: 'test' }, lessonTitle: '模拟课堂' }
test('import and clear restore real data and remove only synthetic artifacts', () => {
  const storage = storageFrom({ 'wh-classroom': real, 'wh-messages': [{ text: '真实消息' }], 'wh-students': [{ id: '1' }], 'wh-generated-geography-tools': ['真实工具'] })
  applySimulationResult({ imported: true, state: demo }, storage)
  assert.deepEqual(storage.read('wh-simulation-backup'), real)
  assert.deepEqual(storage.read('wh-classroom'), demo)
  storage.setItem('wh-messages', JSON.stringify([{ text: '真实消息' }, { text: '模拟报告', simulation: 'test' }]))
  storage.setItem('wh-generated-geography-tools', JSON.stringify(['真实工具', '模拟工具', '其他真实工具']))
  storage.setItem('wh-simulation-generated-tools', JSON.stringify(['模拟工具']))
  applySimulationResult({ imported: false, state: {} }, storage)
  assert.deepEqual(storage.read('wh-classroom').learningAnswers, real.learningAnswers)
  assert.deepEqual(storage.read('wh-messages'), [{ text: '真实消息' }])
  assert.deepEqual(storage.read('wh-generated-geography-tools'), ['真实工具', '其他真实工具'])
  assert.deepEqual(storage.read('wh-students'), [{ id: '1' }])
  assert.equal(storage.getItem('wh-simulation-backup'), null)
})
test('clear preserves a real classroom selected during testing and pending real edits', () => {
  const library = { selectedSectionId: 'demo-geography-30', simulationPreviousSectionId: 'real', books: [{ id: 'book', chapters: [{ sections: [{ id: 'real', teachingState: real }] }] }, { id: 'demo-book', chapters: [{ sections: [{ id: 'demo-geography-30', teachingState: demo }] }] }] }
  const storage = storageFrom({ 'wh-classroom': real, 'wh-teacher-pending-library-t': library })
  applySimulationResult({ imported: false, state: { phase: 'before' } }, storage)
  assert.equal(storage.read('wh-classroom').sectionId, 'real')
  const clean = storage.read('wh-teacher-pending-library-t')
  assert.equal(clean.selectedSectionId, 'real')
  assert.deepEqual(clean.books[0], library.books[0])
  assert.equal(clean.books.length, 1)
  assert.equal(stripSimulationLibrary(clean).books.length, 1)
})
test('material cleanup deletes only explicit simulation IDs', async () => {
  const deleted = []
  const indexedDb = { open() { const request = {}; queueMicrotask(() => { request.result = { close() {}, transaction() { const transaction = { objectStore: () => ({ delete: id => deleted.push(id) }) }; queueMicrotask(() => transaction.oncomplete()); return transaction } }; request.onsuccess() }); return request } }
  await deleteSimulationMaterials(['demo-a', 'demo-b'], indexedDb)
  assert.deepEqual(deleted, ['demo-a', 'demo-b'])
})
