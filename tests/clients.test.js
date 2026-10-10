import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clientPaths, getClientView } from '../src/clients.js'

test('client links keep their roles regardless of conflicting query parameters', () => {
  for (const role of ['teacher', 'student', 'screen']) {
    assert.equal(getClientView({ pathname: clientPaths[role] }), role)
    assert.equal(getClientView({ pathname: clientPaths[role] + '/', search: '?view=console' }), role)
    for (const other of ['teacher', 'student', 'screen']) {
      assert.equal(getClientView({ pathname: clientPaths[role], search: `?view=${other}` }), role)
    }
    assert.equal(getClientView({ pathname: '/', search: `?view=${role}` }), role)
  }
  assert.equal(getClientView({ pathname: '/', search: '?view=unknown' }), 'console')
  assert.equal(getClientView({ pathname: '/unknown', search: '?view=student' }), 'console')
})
