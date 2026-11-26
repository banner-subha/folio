import { inTauri } from '../lib/host'
import { usePopover } from '../lib/usePopover'

type Props = { onFile: () => void; onFolder: () => void }

/** "Open" in the top bar: a single file, or a whole folder of Markdown files. */
export function OpenMenu({ onFile, onFolder }: Props) {
  const { open, setOpen, wrap, button } = usePopover()

  // The browser preview has no folder access, so Open stays a plain file button there.
  if (!inTauri) {
    return (
      <button type="button" className="btn-quiet" onClick={onFile} title="Open a file (Ctrl+O)">
        Open
      </button>
    )
  }

  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="btn-quiet"
        aria-expanded={open}
        aria-controls="open-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Open
      </button>
      {open && (
        <div id="open-panel" className="menu-panel open-panel" role="menu">
          <button type="button" role="menuitem" onClick={pick(onFile)}>
            <span>File…</span>
            <kbd>Ctrl O</kbd>
          </button>
          <button type="button" role="menuitem" onClick={pick(onFolder)}>
            <span>Folder…</span>
            <kbd>Ctrl Shift O</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
