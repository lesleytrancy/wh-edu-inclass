export const teacherAccounts = [
  { username: 'fanjiaqi', name: '地理老师-范佳琪' },
  { username: 'dengyongchun', name: '地理老师-邓永春' },
]

export function findSection(library, id = library?.selectedSectionId) {
  return library?.books?.flatMap(book => book.chapters.flatMap(chapter => chapter.sections)).find(section => section.id === id)
}

export function updateSection(library, id, update) {
  return { ...library, books: library.books.map(book => ({ ...book, chapters: book.chapters.map(chapter => ({ ...chapter, sections: chapter.sections.map(section => section.id === id ? update(section) : section) })) })) }
}

export function addSection(library, chapterId) {
  const id = crypto.randomUUID()
  const books = library.books.map(book => ({ ...book, chapters: book.chapters.map(chapter => {
    if (chapter.id !== chapterId) return chapter
    const name = `新建小节 ${chapter.sections.length + 1}`
    return { ...chapter, sections: [...chapter.sections, { id, name, title: name, materials: [] }] }
  }) }))
  return { ...library, books, selectedSectionId: id }
}

export function removeSection(library, id) {
  const books = library.books.map(book => ({ ...book, chapters: book.chapters.map(chapter => ({ ...chapter, sections: chapter.sections.filter(section => section.id !== id) })) }))
  const next = { ...library, books }
  const first = books.flatMap(book => book.chapters.flatMap(chapter => chapter.sections))[0]
  return { ...next, selectedSectionId: id === library.selectedSectionId ? first?.id : library.selectedSectionId }
}

async function api(path, options = {}) {
  const response = await fetch(`/api/teachers/${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || '教师账号服务暂不可用')
  return data
}

export const loginTeacher = (username, password) => api('login', { method: 'POST', body: JSON.stringify({ username, password }) })
export const loadTeacherLibrary = token => api('library', { token })
export const saveTeacherLibrary = (token, library) => api('library', { token, method: 'PUT', body: JSON.stringify(library) })
export const logoutTeacher = token => api('logout', { token, method: 'POST' })
