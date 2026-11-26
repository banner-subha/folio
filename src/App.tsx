import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DisplayMenu } from './components/DisplayMenu'
import { EmptyState } from './components/EmptyState'
import { FilesPanel, type Folder } from './components/FilesPanel'
import { OpenMenu } from './components/OpenMenu'
import { RecentMenu } from './components/RecentMenu'
import { TabBar } from './components/TabBar'
import { Toc, type Heading } from './components/Toc'
import {
  inTauri,
  initialFile,
  listenForDrops,
  localAssetUrl,
  onDocChanged,
  openExternal,
  pickDoc,
  pickFolder,
  readDoc,
  revealInExplorer,
  scanFolder,
  setWindowTitle,
  showWindow,
  watchDoc,
  type LoadedDoc,
} from './lib/host'
import { dirName, fileName, hasScheme, isMarkdownPath, resolvePath, splitHash } from './lib/paths'
import { clearRecent, loadFolder, loadRecent, pushRecent, removeRecent, saveFolder } from './lib/recent'
import { ThemeContext, useReaderSettings } from './lib/theme'

// The Markdown pipeline is the heaviest code in the app. Loading it lazily lets
// the window paint first; it is also fetched during idle time right after start.
const loadMarkdown = () => import('./components/Markdown')
const Markdown = lazy(() => loadMarkdown().then((m) => ({ default: m.Markdown })))

type Status =
  | { kind: 'loading'; name: string }
  | { kind: 'ready' }
  | { kind: 'error'; path: string | null; name: string; message: string }

/** One open document. `path` is what was asked for; `doc` is what's loaded. */
type Tab = {
  id: number
  path: string | null
  doc: LoadedDoc | null
  status: Status
  /** Documents this tab came from by following links, for Back. */
  history: string[]
  /** Scroll position saved when you switch away, restored when you come back. */
  scrollY: number
}

type OpenTarget = 'new' | 'current'

const WIDE = '(min-width: 1000px)'
let nextTabId = 1
const sameFile = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

export default function App() {
  const { settings, theme, update, stepSize, defaults } = useReaderSettings()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [booted, setBooted] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [scanning, setScanning] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia(WIDE).matches)
  const [sidebarView, setSidebarView] = useState<'files' | 'contents'>('contents')
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const tabsRef = useRef<Tab[]>(tabs)
  const activeRef = useRef<number | null>(activeId)
  const pendingHash = useRef('')
  const pendingScroll = useRef<number | null>(null)

  const active = tabs.find((t) => t.id === activeId) ?? null
  const doc = active?.doc ?? null
  const status = active?.status ?? null
  const history = active?.history ?? []

  useLayoutEffect(() => {
    tabsRef.current = tabs
    activeRef.current = activeId
  }, [tabs, activeId])

  const flash = useCallback((text: string) => setNote(text), [])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 3200)
    return () => clearTimeout(t)
  }, [note])

  const patchTab = useCallback((id: number, fn: (t: Tab) => Tab) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? fn(t) : t)))
  }, [])

  /** Switch tabs, remembering where you were in the one you leave. */
  const activate = useCallback(
    (id: number | null) => {
      const cur = activeRef.current
      if (cur === id) return
      if (cur !== null) {
        const y = window.scrollY
        patchTab(cur, (t) => ({ ...t, scrollY: y }))
      }
      pendingScroll.current = tabsRef.current.find((t) => t.id === id)?.scrollY ?? 0
      activeRef.current = id
      setActiveId(id)
    },
    [patchTab],
  )

  /** Reads a file into an existing tab. */
  const loadInto = useCallback(
    async (id: number, path: string, opts: { push?: boolean; hash?: string } = {}) => {
      const name = fileName(path)
      patchTab(id, (t) => ({ ...t, status: { kind: 'loading', name } }))
      try {
        const loaded = await readDoc(path)
        patchTab(id, (t) => {
          const from = t.doc?.path
          const history = opts.push && from && !sameFile(from, path) ? [...t.history, from] : t.history
          return { ...t, path, doc: loaded, status: { kind: 'ready' }, history, scrollY: 0 }
        })
        if (activeRef.current === id) {
          // A newly shown document starts at the top, or at the linked heading.
          pendingHash.current = opts.hash ?? ''
          pendingScroll.current = opts.hash ? null : 0
          void watchDoc(path).catch(() => {})
        }
        setRecent(pushRecent(path))
      } catch (err) {
        patchTab(id, (t) => ({ ...t, path, status: { kind: 'error', path, name, message: String(err) } }))
      }
    },
    [patchTab],
  )

  /**
   * Opens a file. "new" (the default) uses a new tab, or switches to the tab that
   * already shows this file; "current" replaces the current tab's document (links).
   */
  const openPath = useCallback(
    (path: string, opts: { target?: OpenTarget; hash?: string } = {}) => {
      const target = opts.target ?? 'new'
      const cur = activeRef.current
      if (target === 'current' && cur !== null) {
        void loadInto(cur, path, { push: true, hash: opts.hash })
        return
      }
      const existing = tabsRef.current.find((t) => sameFile(t.path, path))
      if (existing) {
        activate(existing.id)
        if (opts.hash) pendingHash.current = opts.hash
        return
      }
      const tab: Tab = { id: nextTabId++, path, doc: null, status: { kind: 'loading', name: fileName(path) }, history: [], scrollY: 0 }
      setTabs((ts) => {
        // New tabs open right after the current one, like a browser.
        const at = ts.findIndex((t) => t.id === cur)
        return at === -1 ? [...ts, tab] : [...ts.slice(0, at + 1), tab, ...ts.slice(at + 1)]
      })
      activate(tab.id)
      void loadInto(tab.id, path, { hash: opts.hash })
    },
    [activate, loadInto],
  )

  /** A document with no path (browser preview drop/pick) always gets its own tab. */
  const openLoaded = useCallback(
    (loaded: LoadedDoc) => {
      const tab: Tab = { id: nextTabId++, path: null, doc: loaded, status: { kind: 'ready' }, history: [], scrollY: 0 }
      setTabs((ts) => [...ts, tab])
      activate(tab.id)
    },
    [activate],
  )

  const closeTab = useCallback(
    (id: number) => {
      const ts = tabsRef.current
      const i = ts.findIndex((t) => t.id === id)
      if (i === -1) return
      const rest = ts.filter((t) => t.id !== id)
      if (activeRef.current === id) {
        const next = rest[Math.min(i, rest.length - 1)] ?? null
        activate(next?.id ?? null)
      }
      setTabs(rest)
    },
    [activate],
  )

  const cycleTab = useCallback(
    (dir: 1 | -1) => {
      const ts = tabsRef.current
      if (ts.length < 2) return
      const i = ts.findIndex((t) => t.id === activeRef.current)
      activate(ts[(i + dir + ts.length) % ts.length].id)
    },
    [activate],
  )

  const goBack = useCallback(() => {
    const cur = tabsRef.current.find((t) => t.id === activeRef.current)
    const prev = cur?.history[cur.history.length - 1]
    if (!cur || !prev) return
    patchTab(cur.id, (t) => ({ ...t, history: t.history.slice(0, -1) }))
    void loadInto(cur.id, prev, { push: false })
  }, [loadInto, patchTab])

  const openPicker = useCallback(async () => {
    const picked = await pickDoc()
    if (!picked) return
    if (typeof picked === 'string') openPath(picked)
    else openLoaded(picked)
  }, [openPath, openLoaded])

  const showFolder = useCallback(async (path: string) => {
    setScanning(path)
    setFolderError(null)
    try {
      const scan = await scanFolder(path)
      setFolder({ path, ...scan })
      saveFolder(path)
    } catch (err) {
      setFolder(null)
      setFolderError(`Couldn't read ${fileName(path)}: ${String(err)}`)
    } finally {
      setScanning(null)
    }
  }, [])

  const openFolderPicker = useCallback(async () => {
    const picked = await pickFolder()
    if (!picked) return
    setSidebarView('files')
    setSidebarOpen(true)
    void showFolder(picked)
  }, [showFolder])

  const closeFolder = useCallback(() => {
    setFolder(null)
    setFolderError(null)
    saveFolder(null)
    setSidebarView('contents')
  }, [])

  // Reveal the hidden window after the first painted frame (two rAFs = after paint).
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(showWindow))
  }, [])

  // Startup: the launch file (double-click / Open with) and the last opened folder.
  useEffect(() => {
    const lastFolder = inTauri ? loadFolder() : null
    if (lastFolder) void showFolder(lastFolder)
    initialFile()
      .then((p) => {
        if (p) {
          // Fetch the renderer while the file is being read, not after.
          void loadMarkdown()
          openPath(p)
        } else {
          const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300))
          idle(() => void loadMarkdown())
          if (lastFolder) setSidebarView('files')
        }
      })
      .catch(() => {})
      .finally(() => setBooted(true))
  }, [openPath, showFolder])

  // The active tab's file is the one watched for saves. Switching tabs re-reads
  // it once, so edits made while it sat in the background show up.
  useEffect(() => {
    const t = tabsRef.current.find((x) => x.id === activeId)
    setWindowTitle(t?.doc ? `${t.doc.name} · Folio` : 'Folio')
    if (!t?.path || t.status.kind !== 'ready') return
    const path = t.path
    void watchDoc(path).catch(() => {})
    readDoc(path)
      .then((fresh) => patchTab(t.id, (x) => (x.doc && x.doc.text !== fresh.text ? { ...x, doc: fresh } : x)))
      .catch(() => {})
  }, [activeId, active?.doc?.name, patchTab])

  // Live reload when the active file is saved elsewhere.
  useEffect(() => {
    const off = onDocChanged(async (path) => {
      const t = tabsRef.current.find((x) => x.id === activeRef.current)
      if (!t?.doc || !sameFile(t.path, path)) return
      try {
        const fresh = await readDoc(path)
        if (fresh.text !== t.doc.text) {
          patchTab(t.id, (x) => ({ ...x, doc: fresh }))
          flash(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
        }
      } catch (err) {
        patchTab(t.id, (x) => ({
          ...x,
          status: { kind: 'error', path, name: t.doc!.name, message: `The file was moved or deleted. (${String(err)})` },
        }))
      }
    })
    return () => void off.then((fn) => fn())
  }, [flash, patchTab])

  useEffect(
    () =>
      listenForDrops({
        over: setDragging,
        dropPath: (p) => openPath(p),
        dropDoc: openLoaded,
      }),
    [openPath, openLoaded],
  )

  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const on = () => {
      setWide(mq.matches)
      setSidebarOpen(mq.matches)
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // The tab strip adds height under the top bar; sticky offsets read this.
  useEffect(() => {
    document.documentElement.classList.toggle('has-tabs', tabs.length > 0)
  }, [tabs.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'o') {
        e.preventDefault()
        if (e.shiftKey) void openFolderPicker()
        else void openPicker()
      } else if (mod && key === 'w') {
        e.preventDefault()
        if (activeRef.current !== null) closeTab(activeRef.current)
      } else if (mod && e.key === 'Tab') {
        e.preventDefault()
        cycleTab(e.shiftKey ? -1 : 1)
      } else if (mod && /^[1-9]$/.test(e.key)) {
        const ts = tabsRef.current
        const t = e.key === '9' ? ts[ts.length - 1] : ts[Number(e.key) - 1]
        if (t) {
          e.preventDefault()
          activate(t.id)
        }
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        stepSize(1)
      } else if (mod && e.key === '-') {
        e.preventDefault()
        stepSize(-1)
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (e.key === 'Escape' && !wide && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPicker, openFolderPicker, closeTab, cycleTab, activate, goBack, stepSize, wide, sidebarOpen])

  /** Finds a heading or footnote target, also under the "user-content-" prefix sanitizing adds. */
  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id) ?? document.getElementById('user-content-' + id)
    el?.scrollIntoView({ block: 'start' })
  }, [])

  // Called by the Markdown view after each render (it can mount late, being lazy):
  // collect headings, then restore the tab's scroll or jump to a linked heading.
  const onRendered = useCallback(() => {
    // Not articleRef: React attaches a parent's ref after its children's layout
    // effects, so on a fresh mount the ref is still null here.
    const root = document.querySelector('article.doc')
    const found = root
      ? Array.from(root.querySelectorAll<HTMLHeadingElement>('h1[id], h2[id], h3[id]')).map((el) => ({
          id: el.id,
          text: el.textContent ?? '',
          level: Number(el.tagName[1]),
        }))
      : []
    setHeadings(found)
    if (pendingHash.current) {
      scrollToId(pendingHash.current)
      pendingHash.current = ''
      pendingScroll.current = null
    } else if (pendingScroll.current !== null) {
      window.scrollTo(0, pendingScroll.current)
      pendingScroll.current = null
    }
  }, [scrollToId])

  // Scroll and headings are handled in onRendered (the Markdown view's layout
  // effect runs before this parent's, so doing it here would undo that work).
  // Only an empty file, which renders no Markdown view, is handled here.
  useLayoutEffect(() => {
    if (doc && !doc.text.trim()) {
      setHeadings([])
      pendingScroll.current = null
      pendingHash.current = ''
      window.scrollTo(0, 0)
    }
  }, [activeId, doc])

  const onLink = useCallback(
    (href: string, e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (href.startsWith('#')) return scrollToId(href.slice(1))
      if (hasScheme(href)) {
        if (/^(https?|mailto|tel):/i.test(href)) openExternal(href)
        return
      }
      const cur = tabsRef.current.find((t) => t.id === activeRef.current)?.doc?.path
      if (!cur) return flash('Links to local files open in the desktop app.')
      const [file, hash] = splitHash(href)
      if (!file) return scrollToId(hash)
      const target = resolvePath(dirName(cur), file)
      // Ctrl+click opens the linked document in a new tab.
      if (isMarkdownPath(target)) openPath(target, { target: e.ctrlKey || e.metaKey ? 'new' : 'current', hash })
      else revealInExplorer(target)
    },
    [openPath, scrollToId, flash],
  )

  const resolveImage = useCallback((src: string) => {
    if (hasScheme(src)) return /^(https?|data):/i.test(src) ? src : undefined
    const cur = tabsRef.current.find((t) => t.id === activeRef.current)?.doc?.path
    if (!cur) return undefined
    return localAssetUrl(resolvePath(dirName(cur), src)) ?? undefined
  }, [])

  const tabInfos = useMemo(
    () =>
      tabs.map((t) => ({
        id: t.id,
        name: t.doc?.name ?? (t.path ? fileName(t.path) : 'Untitled'),
        title: t.path ?? t.doc?.name ?? '',
        busy: t.status.kind === 'loading',
        failed: t.status.kind === 'error',
      })),
    [tabs],
  )
  const openPaths = useMemo(() => new Set(tabs.flatMap((t) => (t.path ? [t.path.toLowerCase()] : []))), [tabs])

  const hasToc = status?.kind === 'ready' && headings.length >= 2
  const hasFiles = !!folder || !!scanning || !!folderError
  const hasSidebar = hasToc || hasFiles
  const view = sidebarView === 'files' ? (hasFiles ? 'files' : 'contents') : hasToc ? 'contents' : 'files'
  const showDocName = (status?.kind === 'ready' || status?.kind === 'loading') && doc

  return (
    <ThemeContext.Provider value={theme}>
      <div className={'app' + (hasSidebar && sidebarOpen ? ' toc-open' : '')}>
        <header className="bar">
          <div className="bar-left">
            {history.length > 0 && (
              <button
                type="button"
                className="btn-quiet"
                onClick={goBack}
                title={`Back to ${fileName(history[history.length - 1])} (Alt+Left)`}
              >
                Back
              </button>
            )}
            {hasSidebar && (
              <button
                type="button"
                className="btn-quiet"
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
                onClick={() => setSidebarOpen((o) => !o)}
              >
                Sidebar
              </button>
            )}
            {inTauri && (
              <RecentMenu
                recent={recent}
                current={status?.kind === 'ready' ? (doc?.path ?? null) : null}
                onOpen={(p) => openPath(p)}
                onClear={() => setRecent(clearRecent())}
              />
            )}
          </div>

          <div className="bar-title" title={doc?.path ?? doc?.name}>
            {showDocName && (
              <>
                <span className="bar-name">{doc.name}</span>
                {doc.path && <span className="bar-dir">{dirName(doc.path)}</span>}
              </>
            )}
          </div>

          <div className="bar-right">
            <span className="bar-note" role="status">
              {note}
            </span>
            <OpenMenu onFile={() => void openPicker()} onFolder={() => void openFolderPicker()} />
            <DisplayMenu settings={settings} defaults={defaults} update={update} stepSize={stepSize} />
          </div>
        </header>

        {tabs.length > 0 && <TabBar tabs={tabInfos} activeId={activeId} onSelect={activate} onClose={closeTab} />}

        <div className="layout">
          {hasSidebar && (
            <>
              {!wide && sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
              <aside id="sidebar" className="toc-pane" hidden={!sidebarOpen}>
                {hasFiles && hasToc && (
                  <div className="segmented sidebar-switch" role="radiogroup" aria-label="Sidebar view">
                    {(
                      [
                        ['files', 'Files'],
                        ['contents', 'Contents'],
                      ] as const
                    ).map(([v, label]) => (
                      <label key={v} className={view === v ? 'is-on' : undefined}>
                        <input type="radio" name="sidebar-view" checked={view === v} onChange={() => setSidebarView(v)} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                {view === 'files' ? (
                  <FilesPanel
                    folder={folder}
                    scanning={scanning}
                    error={folderError}
                    activePath={doc?.path ?? null}
                    openPaths={openPaths}
                    onOpen={(p) => {
                      openPath(p)
                      if (!wide) setSidebarOpen(false)
                    }}
                    onRescan={() => folder && void showFolder(folder.path)}
                    onCloseFolder={closeFolder}
                  />
                ) : (
                  <Toc
                    headings={headings}
                    onPick={(id) => {
                      scrollToId(id)
                      if (!wide) setSidebarOpen(false)
                    }}
                  />
                )}
              </aside>
            </>
          )}

          <main className="main">
            {booted && !active && (
              <EmptyState
                recent={recent}
                onOpen={() => void openPicker()}
                onOpenFolder={() => void openFolderPicker()}
                onOpenPath={(p) => openPath(p)}
              />
            )}

            {status?.kind === 'loading' && (
              <p className="state-note" aria-live="polite">
                Opening {status.name}…
              </p>
            )}

            {active && status?.kind === 'error' && (
              <section className="state-error" role="alert">
                <h1>Couldn't open {status.name}</h1>
                <p className="state-error-msg">{status.message}</p>
                {status.path && <p className="state-error-path">{status.path}</p>}
                <div className="state-actions">
                  {status.path && (
                    <button type="button" className="btn-primary" onClick={() => void loadInto(active.id, status.path!)}>
                      Try again
                    </button>
                  )}
                  <button type="button" className="btn-quiet" onClick={() => void openPicker()}>
                    Choose another file
                  </button>
                  {status.path && recent.some((p) => sameFile(p, status.path)) && (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => {
                        setRecent(removeRecent(status.path!))
                        closeTab(active.id)
                      }}
                    >
                      Remove from recent
                    </button>
                  )}
                </div>
              </section>
            )}

            {status?.kind === 'ready' && doc && (
              <article className="doc" key={active!.id}>
                {doc.text.trim() ? (
                  <Suspense fallback={<p className="state-note">Opening {doc.name}…</p>}>
                    <Markdown text={doc.text} onLink={onLink} resolveImage={resolveImage} onRendered={onRendered} />
                  </Suspense>
                ) : (
                  <p className="state-note">This file is empty.</p>
                )}
              </article>
            )}
          </main>
        </div>

        {dragging && (
          <div className="drop" aria-hidden="true">
            <p>Drop to open</p>
          </div>
        )}

        {!inTauri && status?.kind === 'ready' && doc && !doc.path && (
          <p className="preview-note">Browser preview: local images, local links and live reload need the desktop app.</p>
        )}
      </div>
    </ThemeContext.Provider>
  )
}
