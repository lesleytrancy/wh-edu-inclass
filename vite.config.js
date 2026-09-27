import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'

const certFile = '.cert/lan.pem'
const keyFile = '.cert/lan-key.pem'
const lanMode = process.argv.some((arg, index, args) => arg === '--host' && args[index + 1] === '0.0.0.0' || arg === '--host=0.0.0.0')
const https = lanMode && existsSync(certFile) && existsSync(keyFile)
  ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: { https, proxy: { '/api': { target: 'http://127.0.0.1:8000', ws: true } } },
})
