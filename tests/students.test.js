import assert from 'node:assert/strict'
import { seedStudents, migrateStudents } from '../src/students.js'
import { createDiscussion } from '../src/discussion.js'

assert.equal(seedStudents.length, 34)
assert.equal(new Set(seedStudents.map(student => student.id)).size, 34)
const run = createDiscussion(seedStudents, '讨论')
assert.deepEqual(run.groups.map(group => group.studentIds.length), [4, 4, 4, 4, 4, 4, 5, 5])
assert.deepEqual(run.groups.map(group => group.leaderName), ['李奕贤', '谢雨辰', '王一菀', '何谐', '吕晨曦', '苏琬云', '吕林润', '廖心蕊'])
assert.equal(migrateStudents(['林小满', '周子航', '陈雨桐'].map((name, index) => ({ id: `0800${index + 1}`, name }))), seedStudents)
const custom = [{ id: '08001', name: '自定义学生' }]
assert.equal(migrateStudents(custom), custom)
assert.deepEqual(migrateStudents([]), [])
