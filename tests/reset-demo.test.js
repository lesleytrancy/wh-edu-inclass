import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearDemoBrowserData, DEMO_STORAGE_KEYS } from '../src/reset-demo.js'

test('reset removes only demo keys after IndexedDB deletion succeeds', async () => {
  const values = new Map([...DEMO_STORAGE_KEYS.map(key => [key, 'old']), ['unrelated-setting', 'keep']])
  const storage = { removeItem: key => values.delete(key) }
  let deletedName
  const indexedDb = { deleteDatabase: name => {
    deletedName = name
    const request = {}
    queueMicrotask(() => request.onsuccess())
    return request
  } }
  await clearDemoBrowserData({ storage, indexedDb })
  assert.equal(deletedName, 'wh-materials')
  assert.equal(values.get('unrelated-setting'), 'keep')
  for (const key of DEMO_STORAGE_KEYS) assert.equal(values.has(key), false)
})
