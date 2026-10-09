export const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
export function presentationMode(phase, editing = false) {
  return phase === 'class' ? 'present' : editing ? 'edit' : 'preview'
}
export function setPresentationPage(state, materialId, page, total = Infinity) {
  if (!state.materials?.some(material => material.id === materialId) || !Number.isSafeInteger(page) || page < 1 || page > total) return state
  if ((state.materialPages?.[materialId] || 1) === page) return state
  return { ...state, updatedAt: Date.now(), slide: page - 1, materialPages: { ...state.materialPages, [materialId]: page } }
}
