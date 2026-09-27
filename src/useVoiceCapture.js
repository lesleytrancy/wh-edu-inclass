import { useEffect, useRef, useState } from 'react'

// Native recording stays on this device; only transcript text enters classroom state.
export function useVoiceCapture(onTranscript) {
  const [active, setActive] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const session = useRef(null)
  const mounted = useRef(true)
  const generation = useRef(0)
  const callback = useRef(onTranscript)
  callback.current = onTranscript

  const stop = () => {
    generation.current += 1
    const capture = session.current
    session.current = null
    if (capture) capture.stopping = true
    clearTimeout(capture?.restartTimer)
    capture?.recognition?.abort()
    if (capture?.recorder?.state === 'recording') capture.recorder.stop()
    capture?.stream.getTracks().forEach(track => track.stop())
    setActive(false)
    setPending(false)
  }

  const start = async () => {
    if (session.current) return
    const token = ++generation.current
    setPending(true)
    setError('')
    let stream
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('此浏览器不支持录音，请使用 HTTPS 或 localhost，并通过文字输入。')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return }
      const recorder = new MediaRecorder(stream), chunks = []
      const capture = { stream, recorder, recognition: null, transcript: '', currentTranscript: '', stopping: false, restartTimer: null }
      session.current = capture
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => { if (mounted.current && chunks.length) setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }))) }
      recorder.start()
      setActive(true)
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) { setError('已开启录音；此浏览器不支持语音转写，请停止录音后补充文字。'); return }
      const beginRecognition = () => {
        if (session.current !== capture || capture.stopping) return
        const recognition = new Recognition()
        capture.recognition = recognition
        recognition.lang = 'zh-CN'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = event => {
          if (session.current !== capture) return
          capture.currentTranscript = Array.from(event.results, result => result[0].transcript).join('')
          callback.current(capture.transcript + capture.currentTranscript)
          setError('')
        }
        recognition.onerror = event => {
          if (session.current !== capture) return
          if (['not-allowed', 'service-not-allowed'].includes(event.error)) capture.stopping = true
          setError(capture.stopping ? '语音识别权限不可用；录音仍在继续，请停止后输入文字。' : '语音转写短暂中断，正在自动恢复…')
        }
        recognition.onend = () => {
          if (session.current !== capture || capture.stopping) return
          capture.transcript += capture.currentTranscript
          capture.currentTranscript = ''
          capture.restartTimer = setTimeout(beginRecognition, 250)
        }
        try { recognition.start() } catch { capture.restartTimer = setTimeout(beginRecognition, 500) }
      }
      beginRecognition()
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop())
      if (token === generation.current) { session.current = null; setActive(false); setError(cause.name === 'NotAllowedError' ? '麦克风权限被拒绝，请授权后重试，或通过文字输入。' : cause.message) }
    } finally { if (token === generation.current) setPending(false) }
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; const capture = session.current; session.current = null; if (capture) capture.stopping = true; clearTimeout(capture?.restartTimer); capture?.recognition?.abort(); if (capture?.recorder) { capture.recorder.onstop = null; if (capture.recorder.state === 'recording') capture.recorder.stop() } capture?.stream.getTracks().forEach(track => track.stop()) }
  }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  return { active, pending, error, audioUrl, start, stop }
}
