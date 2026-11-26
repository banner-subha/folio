import { inTauri } from '../lib/host'
import { dirName, fileName } from '../lib/paths'

type Props = {
  recent: string[]
  onOpen: () => void
  onOpenFolder: () => void
  onOpenPath: (path: string) => void
}

export function EmptyState({ recent, onOpen, onOpenFolder, onOpenPath }: Props) {
  return (
    <section className="empty">
      {/* Placeholder wordmark: the product name set in the body face, no logo yet. */}
      <h1 className="wordmark">Folio</h1>
      <p className="empty-lede">A quiet place to read Markdown, diagrams included.</p>
      <div className="empty-actions">
        <button type="button" className="btn-primary" onClick={onOpen}>
          Choose a Markdown file
        </button>
        {inTauri && (
          <button type="button" className="btn-quiet btn-outline" onClick={onOpenFolder}>
            Open a folder
          </button>
        )}
      </div>
      <p className="empty-hint">
        or drop a file anywhere in this window. <kbd>Ctrl</kbd> <kbd>O</kbd> opens a file
        {inTauri && (
          <>
            , <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>O</kbd> a folder
          </>
        )}
        .
      </p>

      {inTauri && recent.length > 0 && (
        <div className="recent">
          <h2>Recently read</h2>
          <ul>
            {recent.map((p) => (
              <li key={p}>
                <button type="button" onClick={() => onOpenPath(p)} title={p}>
                  <span className="recent-name">{fileName(p)}</span>
                  <span className="recent-dir">{dirName(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
