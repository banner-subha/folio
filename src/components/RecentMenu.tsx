import { dirName, fileName } from '../lib/paths'
import { usePopover } from '../lib/usePopover'

type Props = {
  recent: string[]
  current: string | null
  onOpen: (path: string) => void
  onClear: () => void
}

/** Top-bar list of recently read files, so you can jump back to any of them while reading. */
export function RecentMenu({ recent, current, onOpen, onClear }: Props) {
  const { open, setOpen, wrap, button } = usePopover()
  const others = recent.filter((p) => p.toLowerCase() !== current?.toLowerCase())

  if (others.length === 0) return null

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="btn-quiet"
        aria-expanded={open}
        aria-controls="recent-panel"
        onClick={() => setOpen((o) => !o)}
        title="Recently read files"
      >
        Recent
      </button>

      {open && (
        <div id="recent-panel" className="menu-panel menu-panel-left recent-panel" role="dialog" aria-label="Recently read">
          <p className="menu-legend">Recently read</p>
          <ul>
            {others.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  title={p}
                  onClick={() => {
                    setOpen(false)
                    onOpen(p)
                  }}
                >
                  <span className="recent-name">{fileName(p)}</span>
                  <span className="recent-dir">{dirName(p)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-quiet recent-clear"
            onClick={() => {
              onClear()
              setOpen(false)
              button.current?.focus()
            }}
          >
            Clear list
          </button>
        </div>
      )}
    </div>
  )
}
