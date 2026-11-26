// Recently opened files, newest first. Only real paths are stored, so this
// stays empty in the browser preview.

const KEY = 'folio.recent'
const MAX = 8

export function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function pushRecent(path: string): string[] {
  const key = path.toLowerCase()
  const next = [path, ...loadRecent().filter((p) => p.toLowerCase() !== key)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked: list is simply not remembered */
  }
  return next
}

const FOLDER_KEY = 'folio.folder'

/** The folder shown in the Files sidebar, reopened on next launch. */
export function loadFolder(): string | null {
  try {
    return localStorage.getItem(FOLDER_KEY)
  } catch {
    return null
  }
}

export function saveFolder(path: string | null): void {
  try {
    if (path) localStorage.setItem(FOLDER_KEY, path)
    else localStorage.removeItem(FOLDER_KEY)
  } catch {
    /* not remembered */
  }
}

export function clearRecent(): string[] {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  return []
}

export function removeRecent(path: string): string[] {
  const key = path.toLowerCase()
  const next = loadRecent().filter((p) => p.toLowerCase() !== key)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
