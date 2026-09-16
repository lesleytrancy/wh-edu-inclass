// Render into a private canvas so an obsolete page can never overwrite the current page.
export function renderPdfPage(document, number, target, size) {
  let cancelled = false, task
  const promise = (async () => {
    const page = await document.getPage(number)
    if (cancelled) return
    const natural = page.getViewport({ scale: 1 })
    const scale = Math.min(size.width / natural.width, size.height / natural.height)
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: scale * ratio })
    const buffer = globalThis.document.createElement('canvas')
    buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height)
    task = page.render({ canvasContext: buffer.getContext('2d'), viewport })
    await task.promise
    if (cancelled) return
    target.width = buffer.width; target.height = buffer.height
    target.style.width = `${viewport.width / ratio}px`
    target.style.height = `${viewport.height / ratio}px`
    target.getContext('2d').drawImage(buffer, 0, 0)
  })()
  return { promise, cancel() { cancelled = true; task?.cancel() } }
}
