export async function captureStageSnapshot(stage, overlay, renderDOM) {
  const rect = stage.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = 1400; canvas.height = 800
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
  let source = stage.querySelector('.pdf-page, .uploaded-image')
  let sourceRect = source?.getBoundingClientRect()
  if (!source) {
    const slide = stage.querySelector('.pptx-viewer-host [role="region"][aria-roledescription="slide"]')
    if (slide) {
      sourceRect = slide.getBoundingClientRect()
      const render = renderDOM || (await import('pptx-react-viewer')).renderToCanvas
      source = await render(slide, { backgroundColor: null, scale: 1, useCORS: true })
    } else if (stage.querySelector('.ppt-presentation')) {
      throw new Error('PPT 当前页面尚未加载完成，请稍候再截图。')
    }
  }
  if (source) context.drawImage(source, (sourceRect.left - rect.left) * scaleX, (sourceRect.top - rect.top) * scaleY, sourceRect.width * scaleX, sourceRect.height * scaleY)
  if (overlay) context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .82)
}
