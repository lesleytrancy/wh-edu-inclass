export const DEMO_STORAGE_KEYS = ['wh-students', 'wh-classroom', 'wh-messages', 'wh-messages-cleared-at', 'wh-generated-geography-tools']

export function deleteMaterialDatabase(indexedDb = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.deleteDatabase('wh-materials')
    request.onsuccess = resolve
    request.onerror = () => reject(request.error || new Error('本机资料清理失败'))
    request.onblocked = () => reject(new Error('请关闭其他正在使用课程资料的标签页后重试。'))
  })
}

export async function clearDemoBrowserData({ storage = localStorage, indexedDb = indexedDB } = {}) {
  await deleteMaterialDatabase(indexedDb)
  DEMO_STORAGE_KEYS.forEach(key => storage.removeItem(key))
}
