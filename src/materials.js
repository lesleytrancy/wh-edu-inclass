import { useEffect, useState } from 'react'
import { pptxMime } from './pptx-state.js'

export const isPowerPoint = material => /\.(ppt|pptx)$/i.test(material?.name || '') || ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(material?.type)
export const isPresentation = material => isPowerPoint(material) || material?.type === 'application/pdf' || /\.pdf$/i.test(material?.name || '')

export function getMaterialPage(state, materialId) {
  const page = state.materialPages?.[materialId]
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function turnMaterialPage(state, materialId, direction, total = Infinity) {
  const material = state.materials?.find(material => material.id === materialId)
  if (!material || !(material.type === 'application/pdf' || /\.pdf$/i.test(material.name)) || ![-1, 1].includes(direction)) return state
  const current = getMaterialPage(state, materialId)
  const page = Math.max(1, Math.min(total, current + direction))
  if (page === current || !Number.isSafeInteger(page)) return state
  return { ...state, updatedAt: Date.now(), slide: page - 1, materialPages: { ...state.materialPages, [materialId]: page } }
}

function openMaterials() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wh-materials', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const uploadQueues = new Map()
async function uploadMaterial(material) {
  const upload = (uploadQueues.get(material.id) || Promise.resolve()).catch(() => {}).then(async () => {
    const response = await fetch(`/api/classroom/materials/${material.id}`, { method: 'PUT', body: material.file })
    if (!response.ok) throw new Error(`资料同步失败（${response.status}）`)
  })
  uploadQueues.set(material.id, upload)
  try { await upload } finally { if (uploadQueues.get(material.id) === upload) uploadQueues.delete(material.id) }
}

export async function savePresentationContent(material, bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('课件内容为空，无法保存。')
  const metadata = { ...material, name: material.name.replace(/\.ppt$/i, '.pptx'), type: pptxMime, revision: Math.max(Date.now(), (material.revision || 0) + 1) }
  const file = new File([bytes], metadata.name, { type: pptxMime })
  const db = await openMaterials()
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite')
      transaction.objectStore('files').put({ ...metadata, file })
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    await uploadMaterial({ ...metadata, file })
    return metadata
  } finally { db.close() }
}

async function localMaterial(id) {
  const db = await openMaterials()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function materialFile(material) {
  const local = await localMaterial(material.id)
  if (local?.file && (!material.revision || local.revision === material.revision)) return local.file
  const response = await fetch(`/api/classroom/materials/${material.id}?v=${material.revision || 0}`)
  if (!response.ok) throw new Error('资料尚未同步到服务器，请在上传资料的设备上刷新页面。')
  return new File([await response.blob()], material.name, { type: material.type })
}

export async function syncLocalMaterials(materials) {
  for (const material of materials) {
    const local = await localMaterial(material.id)
    if (local?.file) await uploadMaterial(local)
  }
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
    await Promise.all(materials.map(uploadMaterial))
    return materials.map(({ file, ...metadata }) => metadata)
  } finally { db.close() }
}

export async function getMaterialFiles(materials) {
  return Promise.all(materials.map(materialFile))
}

export function useMaterial(id, revision = 0) {
  const [asset, setAsset] = useState({ id: null, url: null, error: '' })
  useEffect(() => {
    if (!id) return
    let cancelled = false, url
    const load = async () => {
      try {
        const material = await localMaterial(id)
        if (cancelled) return
        url = material?.file && (!revision || material.revision === revision) ? URL.createObjectURL(material.file) : `/api/classroom/materials/${id}?v=${revision}`
        setAsset({ id, url, error: '' })
      } catch (error) { if (!cancelled) setAsset({ id, url: null, error: error.message || '资料读取失败，请重新上传。' }) }
    }
    load()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [id, revision])
  return asset.id === id ? asset : { id, url: null, error: '' }
}
