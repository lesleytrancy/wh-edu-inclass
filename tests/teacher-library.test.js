import assert from 'node:assert/strict'
import test from 'node:test'
import { addSection, findSection, removeSection, updateSection } from '../src/teacher-library.js'

const library = {
  selectedSectionId: 'one',
  books: [{ id: 'book', name: '地理必修第一册', chapters: [
    { id: 'chapter-a', name: '第一章', sections: [{ id: 'one', name: '第一节', title: '第一节', materials: [] }] },
    { id: 'chapter-b', name: '第二章', sections: [{ id: 'two', name: '第二节', title: '第二节', materials: [] }] },
  ] }],
}

test('new sections belong to their chapter and retain their files and title', () => {
  const added = addSection(library, 'chapter-b')
  const id = added.selectedSectionId
  assert.equal(added.books[0].chapters[0].sections.length, 1)
  assert.equal(added.books[0].chapters[1].sections.length, 2)
  const updated = updateSection(added, id, section => ({ ...section, title: '新课堂', materials: [{ id: 'file', name: '课件.pdf', type: 'application/pdf' }] }))
  assert.equal(findSection(updated).title, '新课堂')
  assert.equal(findSection(updated).materials[0].name, '课件.pdf')
  assert.equal(findSection(library, 'one').materials.length, 0)
  const removed = removeSection(updated, id)
  assert.equal(removed.selectedSectionId, 'one')
  assert.equal(removed.books[0].chapters[1].sections.length, 1)
})
