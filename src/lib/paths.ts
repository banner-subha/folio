// Small path helpers that work on Windows and POSIX paths alike.
// Document paths come from the OS, link targets come from Markdown (always "/").

const SEP = /[\\/]/

export function fileName(path: string): string {
  const parts = path.split(SEP)
  return parts[parts.length - 1] || path
}

export function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i === -1 ? '' : path.slice(0, i)
}

export function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\\\')
}

/** True for http(s), mailto, tel, data and other scheme links. Drive letters are not schemes. */
export function hasScheme(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]+:/.test(href) && !/^[a-zA-Z]:[\\/]/.test(href)
}

/** Resolves a relative link target against the folder of the open document. */
export function resolvePath(baseDir: string, target: string): string {
  const decoded = safeDecode(target)
  if (isAbsolutePath(decoded)) return normalize(decoded)
  const useBackslash = baseDir.includes('\\')
  const joined = baseDir + '/' + decoded
  const out = normalize(joined)
  return useBackslash ? out.replace(/\//g, '\\') : out
}

function normalize(p: string): string {
  const unc = p.startsWith('\\\\')
  const parts = p.split(SEP)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') {
      if (stack.length === 0) stack.push('')
      continue
    }
    if (part === '..') {
      if (stack.length > 1) stack.pop()
      continue
    }
    stack.push(part)
  }
  const out = stack.join('/')
  return unc ? '\\\\' + out.replace(/^\/+/, '') : out
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Splits "notes.md#setup" into the file part and the heading part. */
export function splitHash(href: string): [string, string] {
  const i = href.indexOf('#')
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i + 1)]
}

export function isMarkdownPath(p: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(p)
}
