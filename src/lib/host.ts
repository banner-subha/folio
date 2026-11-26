// Everything that touches the OS goes through here. Inside Tauri it uses the
// Rust commands and plugins; in a plain browser (dev preview) it falls back to
// file pickers and drag-drop with no paths, no live reload and no local images.

import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import { fileName } from './paths'

export const inTauri = isTauri()

export type LoadedDoc = {
  /** Absolute path on disk. Null when the file came from a browser drop. */
  path: string | null
  name: string
  text: string
}

export async function readDoc(path: string): Promise<LoadedDoc> {
  const text = await invoke<string>('read_markdown', { path })
  return { path, name: fileName(path), text }
}

export async function initialFile(): Promise<string | null> {
  if (!inTauri) return null
  return invoke<string | null>('initial_file')
}

export async function watchDoc(path: string): Promise<void> {
  if (inTauri) await invoke('watch_file', { path })
}

export function onDocChanged(cb: (path: string) => void): Promise<UnlistenFn> {
  if (!inTauri) return Promise.resolve(() => {})
  return listen<string>('file-changed', (e) => cb(e.payload))
}

/** Returns a path inside Tauri, or a loaded doc in the browser. */
export async function pickDoc(): Promise<string | LoadedDoc | null> {
  if (inTauri) {
    const picked = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }],
    })
    return typeof picked === 'string' ? picked : null
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? await docFromFile(file) : null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export async function pickFolder(): Promise<string | null> {
  if (!inTauri) return null
  const picked = await openDialog({ multiple: false, directory: true })
  return typeof picked === 'string' ? picked : null
}

export type FolderScan = { files: string[]; truncated: boolean }

/** Every Markdown file under the folder, recursively (hidden and dependency folders skipped). */
export function scanFolder(path: string): Promise<FolderScan> {
  return invoke<FolderScan>('scan_folder', { path })
}

export async function docFromFile(file: File): Promise<LoadedDoc> {
  return { path: null, name: file.name, text: await file.text() }
}

type DropHandlers = {
  over: (active: boolean) => void
  dropPath: (path: string) => void
  dropDoc: (doc: LoadedDoc) => void
}

/** Wires window-wide drag and drop. Returns a cleanup function. */
export function listenForDrops(h: DropHandlers): () => void {
  if (inTauri) {
    let unlisten: UnlistenFn | undefined
    let disposed = false
    getCurrentWebview()
      .onDragDropEvent((e) => {
        const p = e.payload
        if (p.type === 'enter' || p.type === 'over') h.over(true)
        else if (p.type === 'leave') h.over(false)
        else if (p.type === 'drop') {
          h.over(false)
          if (p.paths[0]) h.dropPath(p.paths[0])
        }
      })
      .then((fn) => (disposed ? fn() : (unlisten = fn)))
    return () => {
      disposed = true
      unlisten?.()
    }
  }

  let depth = 0
  const enter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return
    depth++
    h.over(true)
  }
  const leave = () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) h.over(false)
  }
  const over = (e: DragEvent) => e.preventDefault()
  const drop = async (e: DragEvent) => {
    e.preventDefault()
    depth = 0
    h.over(false)
    const file = e.dataTransfer?.files[0]
    if (file) h.dropDoc(await docFromFile(file))
  }
  window.addEventListener('dragenter', enter)
  window.addEventListener('dragleave', leave)
  window.addEventListener('dragover', over)
  window.addEventListener('drop', drop)
  return () => {
    window.removeEventListener('dragenter', enter)
    window.removeEventListener('dragleave', leave)
    window.removeEventListener('dragover', over)
    window.removeEventListener('drop', drop)
  }
}

export function openExternal(url: string): void {
  if (inTauri) void openUrl(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function revealInExplorer(path: string): void {
  if (inTauri) void revealItemInDir(path)
}

/** URL the webview can load for a local image. Null when local files are unreachable. */
export function localAssetUrl(path: string): string | null {
  return inTauri ? convertFileSrc(path) : null
}

/**
 * The window starts hidden (tauri.conf.json) so you never see a blank white frame.
 * Called once the first frame with real colors has painted.
 */
export function showWindow(): void {
  if (inTauri) void getCurrentWindow().show()
}

export function setWindowTitle(title: string): void {
  document.title = title
  if (inTauri) void getCurrentWindow().setTitle(title)
}
