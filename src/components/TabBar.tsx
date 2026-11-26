import { useEffect, useRef } from 'react'

export type TabInfo = { id: number; name: string; title: string; busy: boolean; failed: boolean }

type Props = {
  tabs: TabInfo[]
  activeId: number | null
  onSelect: (id: number) => void
  onClose: (id: number) => void
}

/** One tab per open document. Middle-click or × closes; Ctrl+Tab and Ctrl+W work too (see App). */
export function TabBar({ tabs, activeId, onSelect, onClose }: Props) {
  const strip = useRef<HTMLDivElement>(null)

  // Keep the active tab in view when there are more tabs than fit.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, tabs.length])

  return (
    <div className="tabs" ref={strip} role="tablist" aria-label="Open documents">
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <div
            key={t.id}
            className={'tab' + (active ? ' is-active' : '') + (t.failed ? ' is-failed' : '')}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onClose(t.id)
              }
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="tab-main"
              title={t.title}
              onClick={() => onSelect(t.id)}
            >
              {t.busy ? <span className="tab-busy">{t.name}…</span> : t.name}
            </button>
            <button type="button" className="tab-close" aria-label={`Close ${t.name}`} title="Close (Ctrl+W)" onClick={() => onClose(t.id)}>
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
