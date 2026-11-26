import { useMemo, useState } from 'react'
import { fileName } from '../lib/paths'

export type Folder = { path: string; files: string[]; truncated: boolean }

type Props = {
  folder: Folder | null
  scanning: string | null
  error: string | null
  activePath: string | null
  openPaths: Set<string>
  onOpen: (path: string) => void
  onRescan: () => void
  onCloseFolder: () => void
}

/** Every Markdown file in the opened folder, grouped by subfolder, with a filter box. */
export function FilesPanel({ folder, scanning, error, activePath, openPaths, onOpen, onRescan, onCloseFolder }: Props) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    if (!folder) return []
    const base = folder.path.replace(/[\\/]+$/, '')
    const q = query.trim().toLowerCase()
    const map = new Map<string, { path: string; name: string }[]>()
    for (const path of folder.files) {
      const rel = path.slice(base.length + 1).replace(/\\/g, '/')
      if (q && !rel.toLowerCase().includes(q)) continue
      const slash = rel.lastIndexOf('/')
      const dir = slash === -1 ? '' : rel.slice(0, slash)
      const list = map.get(dir) ?? []
      list.push({ path, name: rel.slice(slash + 1) })
      map.set(dir, list)
    }
    // Top-level files first, then folders alphabetically.
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  }, [folder, query])

  const shown = groups.reduce((n, [, list]) => n + list.length, 0)
  const activeKey = activePath?.toLowerCase()

  return (
    <div className="files">
      <div className="files-head">
        <p className="files-folder" title={folder?.path ?? scanning ?? ''}>
          {folder ? fileName(folder.path) : scanning ? fileName(scanning) : 'Folder'}
        </p>
        <div className="files-actions">
          <button type="button" onClick={onRescan} disabled={!!scanning} title="Scan the folder again for new or removed files">
            Rescan
          </button>
          <button type="button" onClick={onCloseFolder} title="Stop showing this folder">
            Close
          </button>
        </div>
      </div>

      {scanning && !folder && <p className="files-note">Looking for Markdown files…</p>}
      {error && (
        <p className="files-note files-error" role="alert">
          {error}
        </p>
      )}

      {folder && (
        <>
          <input
            type="search"
            className="files-filter"
            placeholder={`Filter ${folder.files.length} files`}
            aria-label="Filter files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {folder.files.length === 0 && <p className="files-note">No Markdown files in this folder.</p>}
          {folder.files.length > 0 && shown === 0 && <p className="files-note">No file names match “{query}”.</p>}

          <div className="files-list">
            {groups.map(([dir, list]) => (
              <section key={dir || '.'}>
                {dir && <p className="files-dir">{dir}</p>}
                <ul>
                  {list.map((f) => {
                    const key = f.path.toLowerCase()
                    return (
                      <li key={f.path}>
                        <button
                          type="button"
                          title={f.path}
                          aria-current={key === activeKey ? 'page' : undefined}
                          className={openPaths.has(key) ? 'is-open' : undefined}
                          onClick={() => onOpen(f.path)}
                        >
                          {f.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          {folder.truncated && (
            <p className="files-note">Showing the first {folder.files.length} files. Open a smaller folder to see the rest.</p>
          )}
        </>
      )}
    </div>
  )
}
