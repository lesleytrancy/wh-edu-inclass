import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Exercise the hook's native recording lifecycle with browser APIs replaced locally.
const slots = []
let cursor = 0
const sameDeps = (a, b) => a?.length === b?.length && a.every((value, index) => value === b[index])
globalThis.voiceHooks = {
  useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
  },
  useRef(initial) {
    const index = cursor++
    return slots[index] ||= { current: initial }
  },
  useEffect(effect, deps) {
    const index = cursor++
    if (!sameDeps(slots[index]?.deps, deps)) {
      slots[index]?.cleanup?.()
      slots[index] = { deps, cleanup: effect() }
    }
  },
}
let recorder, recognition, stoppedTracks = 0, received = ''
const stream = { getTracks: () => [{ stop() { stoppedTracks++ } }] }
class Recorder {
  constructor() { recorder = this; this.state = 'inactive'; this.mimeType = 'audio/webm' }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['recorded-audio']) })
    this.onstop?.()
  }
}
class Recognition {
  constructor() { recognition = this }
  start() { this.started = true }
  abort() { this.aborted = true }
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } })
globalThis.window = { MediaRecorder: Recorder, SpeechRecognition: Recognition }
globalThis.MediaRecorder = Recorder
const source = (await readFile(new URL('../src/useVoiceCapture.js', import.meta.url), 'utf8')).replace(/^import .*\n/, 'const { useEffect, useRef, useState } = globalThis.voiceHooks\n')
const { useVoiceCapture } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const render = () => { cursor = 0; return useVoiceCapture(text => { received = text }) }
let voice = render()
await voice.start()
voice = render()
assert.equal(voice.active, true)
assert.equal(recorder.state, 'recording')
assert.equal(recognition.lang, 'zh-CN')
recognition.onresult({ results: [[{ transcript: '实际录音转写' }]] })
assert.equal(received, '实际录音转写')
voice.stop()
voice = render()
assert.equal(voice.active, false)
assert.equal(recognition.aborted, true)
assert.equal(stoppedTracks, 1)
assert.match(voice.audioUrl, /^blob:/)
recognition.onresult({ results: [[{ transcript: '停止后的延迟转写' }]] })
assert.equal(received, '实际录音转写')
navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }) }
await voice.start()
voice = render()
assert.equal(voice.active, false)
assert.equal(voice.pending, false)
assert.match(voice.error, /权限被拒绝/)
let resolvePermission
navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolvePermission = resolve })
const pending = voice.start()
voice.stop()
resolvePermission(stream)
await pending
voice = render()
assert.equal(voice.active, false)
assert.equal(stoppedTracks, 2)
for (const slot of slots) slot?.cleanup?.()
