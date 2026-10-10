export const clientPaths = { console: '/', teacher: '/teacher', student: '/student', screen: '/screen' }

export function getClientView({ pathname = '/', search = '' }) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const entry = Object.entries(clientPaths).find(([, url]) => url === path)
  if (entry && entry[0] !== 'console') return entry[0]
  // Accept old bookmarks only at the root; an endpoint's path always fixes its role.
  if (path === '/') {
    const legacy = new URLSearchParams(search).get('view')
    if (legacy && Object.hasOwn(clientPaths, legacy)) return legacy
  }
  return 'console'
}
