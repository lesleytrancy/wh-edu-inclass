import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { transformWithOxc } from 'vite'
const require = createRequire(import.meta.url)
const cache = new Map()
export async function jsxModuleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href)
  let source = await readFile(url, 'utf8')
  const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)]
  for (const [, path] of imports) {
    const target = path.startsWith('.') ? new URL(path, url) : pathToFileURL(require.resolve(path))
    const href = target.pathname.endsWith('.jsx') ? await jsxModuleUrl(target) : target.href
    source = source.replace(`from '${path}'`, `from ${JSON.stringify(href)}`).replace(`from "${path}"`, `from ${JSON.stringify(href)}`)
  }
  const { code } = await transformWithOxc(source, url.pathname, { jsx: { runtime: 'classic' } })
  const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  cache.set(url.href, result)
  return result
}
