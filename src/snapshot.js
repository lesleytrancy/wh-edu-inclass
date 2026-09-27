export function captureStageSnapshot(stage, overlay) {
  const rect = stage.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = 1400; canvas.height = 800
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
  const source = stage.querySelector('.pdf-page, .uploaded-image')
  if (source) {
    const sourceRect = source.getBoundingClientRect()
    context.drawImage(source, (sourceRect.left - rect.left) * scaleX, (sourceRect.top - rect.top) * scaleY, sourceRect.width * scaleX, sourceRect.height * scaleY)
  }
  if (overlay) context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .82)
}
