const backupKey = 'wh-simulation-backup'
const sectionId = 'demo-geography-30'
const read = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback } catch { return fallback } }

export function stripSimulationLibrary(library) {
  const books = library.books.map(book => ({ ...book, chapters: book.chapters.map(chapter => ({ ...chapter, sections: chapter.sections.filter(section => section.id !== sectionId || !section.teachingState?.simulation) })).filter(chapter => chapter.sections.length) })).filter(book => book.chapters.length)
  const ids = books.flatMap(book => book.chapters.flatMap(chapter => chapter.sections.map(section => section.id)))
  const { simulationPreviousSectionId, ...rest } = library
  return { ...rest, books, selectedSectionId: ids.includes(library.selectedSectionId) ? library.selectedSectionId : ids.includes(simulationPreviousSectionId) ? simulationPreviousSectionId : ids[0] }
}

export function applySimulationResult(result, storage = localStorage) {
  const current = read(storage, 'wh-classroom', {})
  if (result.imported) {
    if (!current.simulation && !storage.getItem(backupKey)) storage.setItem(backupKey, JSON.stringify(current))
    storage.setItem('wh-classroom', JSON.stringify(result.state))
  } else {
    const backup = read(storage, backupKey, null)
    const restored = current.simulation ? backup || result.state : current
    storage.setItem('wh-classroom', JSON.stringify({ ...restored, reportNotifications: (restored.reportNotifications || []).filter(n => n.sectionId !== sectionId) }))
    const messages = read(storage, 'wh-messages', []).filter(message => !message.simulation)
    storage.setItem('wh-messages', JSON.stringify(messages))
    const tools = new Set(read(storage, 'wh-simulation-generated-tools', []))
    storage.setItem('wh-generated-geography-tools', JSON.stringify(read(storage, 'wh-generated-geography-tools', []).filter(name => !tools.has(name))))
    storage.removeItem(backupKey)
    storage.removeItem('wh-simulation-generated-tools')
  }
  // Preserve pending real edits while removing stale generated test sections.
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith('wh-teacher-pending-library-')) continue
    const pending = read(storage, key, null)
    if (!pending?.books) continue
    const clean = stripSimulationLibrary(pending)
    if (result.imported) {
      clean.simulationPreviousSectionId = clean.selectedSectionId
      clean.books.push({ id: 'demo-book', name: 'AI测试数据集（模拟）', chapters: [{ id: 'demo-chapter', name: '30人全流程课堂', sections: [{ id: sectionId, name: result.state.lessonTitle, title: result.state.lessonTitle, materials: [], teachingState: result.state }] }] })
      clean.selectedSectionId = sectionId
    }
    storage.setItem(key, JSON.stringify(clean))
  }
}

export function deleteSimulationMaterials(ids = [], indexedDb = indexedDB) {
  if (!ids.length) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const request = indexedDb.open('wh-materials', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('files', 'readwrite')
      for (const id of ids) transaction.objectStore('files').delete(id)
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || new Error('模拟资料清理失败')) }
    }
  })
}
