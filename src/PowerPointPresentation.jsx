import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PowerPointViewer, vermilionLightTheme } from 'pptx-react-viewer'
import { translationsEn } from 'pptx-react-viewer/i18n'
import { translationsZhCN } from 'pptx-react-viewer/i18n/zh-CN'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { getMaterialFiles, savePresentationContent } from './materials.js'
import { presentationMode } from './pptx-state.js'

const i18n = i18next.createInstance()
i18n.init({ lng: 'zh-CN', fallbackLng: 'en', resources: { en: { translation: translationsEn }, 'zh-CN': { translation: translationsZhCN } }, interpolation: { escapeValue: false }, initImmediate: false })

export default forwardRef(function PowerPointPresentation({ material, phase = 'before', active = true, page = 1, editable = false, headerTarget, showControls = true, onSave, onPageChange }, ref) {
  const viewer = useRef(null), dirtyRef = useRef(false), savedRevision = useRef(null)
  const [content, setContent] = useState(null), [count, setCount] = useState(0)
  const [mode, setMode] = useState(() => presentationMode(phase)), [dirty, setDirty] = useState(false)
  const editing = mode === 'edit'
  const modeInitialized = useRef(false), pendingPages = useRef([])
  const latest = useRef(null)
  latest.current = { editable, count, page, onPageChange, mode, phase }
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    setMode(active ? presentationMode(phase) : 'preview')
  }, [active, phase])
  useEffect(() => {
    if (savedRevision.current === material.revision && material.revision) return
    let cancelled = false
    modeInitialized.current = false; pendingPages.current = []
    dirtyRef.current = false; setDirty(false)
    setContent(null); setCount(0); setError(''); setSaved(false); setMode(active ? presentationMode(phase) : 'preview')
    getMaterialFiles([material]).then(async ([file]) => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (cancelled) return
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('请将旧版 .ppt 课件另存为 .pptx 后上传；网页播放器使用 PPTX 格式。')
      setContent(bytes)
    }).catch(reason => { if (!cancelled) setError(reason.message || '课件读取失败，请重新上传。') })
    return () => { cancelled = true }
  }, [material.id, material.revision])
  useEffect(() => {
    if (!count || !viewer.current) return
    modeInitialized.current = true
    if (viewer.current.getMode() !== mode) viewer.current.setMode(mode)
  }, [mode, count])
  useEffect(() => {
    if (!count || !viewer.current) return
    // Acknowledge local navigation without replaying an older page while
    // the viewer has already moved on during rapid clicks.
    const acknowledged = pendingPages.current.lastIndexOf(page)
    if (acknowledged >= 0) {
      pendingPages.current.splice(0, acknowledged + 1)
      return
    }
    const index = Math.max(0, Math.min(count - 1, page - 1))
    if (viewer.current.getActiveSlideIndex() !== index) viewer.current.goTo(index)
  }, [page, count])
  // The viewer emits slide changes when callback identity changes. Keep this
  // callback stable so a classroom state refresh cannot echo an old page back.
  const onActiveSlideChange = useCallback(index => {
    const current = latest.current
    if (current.editable && current.count && current.onPageChange && index + 1 !== current.page) {
      pendingPages.current.push(index + 1)
      current.onPageChange(index + 1, current.count)
    }
  }, [])
  const onModeChange = useCallback(value => {
    if (!modeInitialized.current) return
    // The viewer returns to edit mode on Escape, even when editing is disabled.
    // Treat that as stopped playback unless the teacher explicitly chose Edit.
    setMode(value === 'edit' && (latest.current.mode !== 'edit' || latest.current.phase === 'class') ? 'preview' : value)
  }, [])
  const onDirtyChange = useCallback(value => {
    dirtyRef.current = value; setDirty(value)
    if (value) setSaved(false)
  }, [])
  const save = async () => {
    if (!viewer.current || !count) throw new Error('课件尚未加载完成，请稍候。')
    setSaving(true); setError('')
    try {
      const bytes = await viewer.current.getContent()
      const metadata = await savePresentationContent(material, bytes)
      savedRevision.current = metadata.revision
      dirtyRef.current = false; setDirty(false); setSaved(true); setMode(presentationMode(phase))
      setContent(bytes)
      onSave?.(metadata)
      return metadata
    } catch (reason) { setError(`保存失败：${reason.message}`); throw reason }
    finally { setSaving(false) }
  }
  useImperativeHandle(ref, () => ({ saveIfDirty: () => dirtyRef.current || editing || viewer.current?.isDirty() ? save() : Promise.resolve(null) }))
  const header = editable && <div className="ppt-preview-actions"><span title={material.name}>{material.name}</span>{phase !== 'class' && <><button className="ghost" disabled={!count || saving} onClick={() => setMode(presentationMode(phase, !editing))}>{editing ? '结束编辑' : '编辑'}</button><button className="primary" disabled={!count || saving || (saved && !dirty)} onClick={() => save().catch(() => {})}>{saving ? '正在保存…' : saved && !dirty ? '已保存' : '保存'}</button></>}</div>
  return <div className={`ppt-presentation pptx-browser-player ${mode}`} data-presentation-mode={mode}>
    {headerTarget ? createPortal(header, headerTarget) : header}
    <div className="pptx-viewer-host" aria-busy={!content}>
      {content ? <I18nextProvider i18n={i18n}><PowerPointViewer ref={viewer} content={content} fileName={material.name} filePath={`classroom/${material.id}`} canEdit={editable && editing && phase !== 'class'} showToolbar={editable && editing && phase !== 'class'} showThumbnails={editable && editing && phase !== 'class'} autosave={false} hiddenActions={['file', 'share', 'broadcast', 'record', 'help']} defaultLocale="zh-CN" theme={vermilionLightTheme} fitPadding={0} maxFitScale={null} initialSlide={page - 1} onDirtyChange={onDirtyChange} onSlideCountChange={setCount} onActiveSlideChange={onActiveSlideChange} onModeChange={onModeChange} /></I18nextProvider> : !error && <div className="ppt-loading" role="status">正在读取 PPT 课件…</div>}
    </div>
    {error && <p className="ppt-error" role="alert">{error}</p>}
    {editable && showControls && mode === 'preview' && <div className="ppt-page-controls"><button disabled={!count || saving} onClick={() => setMode('present')}>开始播放</button></div>}
  </div>
})
