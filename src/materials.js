import { useEffect, useState } from 'react'

function openMaterials() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wh-materials', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveMaterials(files) {
  const db = await openMaterials()
  const materials = Array.from(files, file => ({ id: crypto.randomUUID(), name: file.name, type: file.type, file }))
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite')
      materials.forEach(material => transaction.objectStore('files').put(material))
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    return materials.map(({ file, ...metadata }) => metadata)
  } finally { db.close() }
}

export function useMaterial(id) {
  const [asset, setAsset] = useState({ id: null, url: null, error: '' })
  useEffect(() => {
    if (!id) return
    let cancelled = false, url
    const load = async () => {
      let db
      try {
        db = await openMaterials()
        const material = await new Promise((resolve, reject) => {
          const request = db.transaction('files').objectStore('files').get(id)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        if (cancelled) return
        if (!material) throw new Error('本机未找到原始文件，请重新上传资料。')
        url = URL.createObjectURL(material.file)
        setAsset({ id, url, error: '' })
      } catch (error) { if (!cancelled) setAsset({ id, url: null, error: error.message || '资料读取失败，请重新上传。' }) }
      finally { db?.close() }
    }
    load()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [id])
  return asset.id === id ? asset : { id, url: null, error: '' }
}
