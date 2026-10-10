import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const uvicorn = resolve(root, process.platform === 'win32' ? '.venv/Scripts/uvicorn.exe' : '.venv/bin/uvicorn')

if (!existsSync(uvicorn)) {
  console.error('未找到 FastAPI 环境，请先运行：python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt')
  process.exit(1)
}

const apiArgs = ['server.app:app', '--reload', '--reload-include', '.env', '--host', '127.0.0.1', '--port', '8000']
if (existsSync(resolve(root, '.env'))) apiArgs.push('--env-file', '.env')

const viteArgs = process.argv.slice(2)
// Without npm's `--` separator, npm consumes --host as configuration.
const npmHost = process.env.npm_config_host
if (npmHost && !viteArgs.some(arg => arg === '--host' || arg.startsWith('--host='))) {
  if (npmHost === 'true') {
    const host = viteArgs[0] && !viteArgs[0].startsWith('-') ? viteArgs.shift() : '0.0.0.0'
    viteArgs.unshift('--host', host)
  } else {
    viteArgs.unshift('--host', npmHost)
  }
}

const children = [
  spawn(uvicorn, apiArgs, { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), ...viteArgs], { cwd: root, stdio: 'inherit' }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  children.forEach(child => child.kill('SIGTERM'))
  setTimeout(() => process.exit(code), 300).unref()
}

children.forEach(child => child.on('exit', code => {
  if (!stopping && code) stop(code)
}))
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
