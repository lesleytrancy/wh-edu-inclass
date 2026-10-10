import assert from 'node:assert/strict'
import { seedStudents, migrateStudents, className } from '../src/students.js'
import { createDiscussion } from '../src/discussion.js'

assert.equal(className, '高一三班')
assert.equal(seedStudents.length, 50)
assert.equal(new Set(seedStudents.map(student => student.id)).size, 50)
assert.equal(new Set(seedStudents.map(student => student.name)).size, 50)
assert.deepEqual(seedStudents.slice(0, 3).map(student => [student.id, student.name]), [['00001', '陈若溪'], ['00002', '丁思诚'], ['00003', '董啟瑶']])
assert.deepEqual([seedStudents.at(-1).id, seedStudents.at(-1).name], ['00050', '朱峻希'])
assert.ok(seedStudents.every(student => student.score === 0 && student.status === '待完成预习'))
const run = createDiscussion(seedStudents, '讨论')
assert.deepEqual(run.groups.map(group => group.studentIds.length), [7, 7, 6, 6, 6, 6, 6, 6])
assert.deepEqual(run.groups.map(group => group.leaderName), ['陈若溪', '丁思诚', '董啟瑶', '甘馨甜', '龚秋瑞', '龚田娇', '古沂可', '胡宁芮'])
assert.equal(migrateStudents(['林小满', '周子航', '陈雨桐'].map((name, index) => ({ id: `0800${index + 1}`, name }))), seedStudents)
const custom = [{ id: '08001', name: '自定义学生' }]
assert.equal(migrateStudents(custom), custom)
assert.deepEqual(migrateStudents([]), [])
