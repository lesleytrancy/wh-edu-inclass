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
      const capture = { stream, recorder, recognition: null }
      session.current = capture
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => { if (mounted.current && chunks.length) setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }))) }
      recorder.start()
      setActive(true)
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) { setError('已开启录音；此浏览器不支持语音转写，请同时使用文字输入。'); return }
      const recognition = new Recognition()
      capture.recognition = recognition
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = event => {
        if (session.current === capture) callback.current(Array.from(event.results, result => result[0].transcript).join(''))
      }
      recognition.onerror = () => { if (session.current === capture) setError('语音转写暂不可用，录音仍在继续；可通过文字输入回答。') }
      recognition.onend = () => { if (session.current === capture) setError('语音转写已停止，录音仍在继续；可停止后重新录音或通过文字输入。') }
      try { recognition.start() } catch { setError('语音转写无法启动，录音仍在继续；请通过文字输入。') }
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop())
      if (token === generation.current) { session.current = null; setActive(false); setError(cause.name === 'NotAllowedError' ? '麦克风权限被拒绝，请授权后重试，或通过文字输入。' : cause.message) }
    } finally { if (token === generation.current) setPending(false) }
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; const capture = session.current; session.current = null; capture?.recognition?.abort(); if (capture?.recorder) { capture.recorder.onstop = null; if (capture.recorder.state === 'recording') capture.recorder.stop() } capture?.stream.getTracks().forEach(track => track.stop()) }
  }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  return { active, pending, error, audioUrl, start, stop }
}
