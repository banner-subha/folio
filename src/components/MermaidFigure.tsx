import { useEffect, useState } from 'react'
import { cachedDiagram, diagramKind, renderDiagram } from '../lib/mermaid'
import { useCurrentTheme } from '../lib/theme'
import { useNearViewport } from '../lib/useNearViewport'
import { DiagramViewer } from './DiagramViewer'

type Props = { code: string; number: number }

type State = { svg: string | null; error: string | null }

export function MermaidFigure({ code, number }: Props) {
  const theme = useCurrentTheme()
  const [box, near] = useNearViewport<HTMLElement>()
  const [state, setState] = useState<State>(() => ({ svg: cachedDiagram(code, theme) ?? null, error: null }))
  const [showSource, setShowSource] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let live = true
    const hit = cachedDiagram(code, theme)
    if (hit) {
      setState({ svg: hit, error: null })
      return
    }
    // Mermaid layout is the slowest thing on a page; wait until the figure is near the screen.
    if (!near) return
    // Keep the previous drawing on screen while the new theme renders,
    // so a live reload or theme switch doesn't make the page jump.
    renderDiagram(code, theme)
      .then((svg) => live && setState({ svg, error: null }))
      .catch((err: unknown) => {
        if (!live) return
        const msg = err instanceof Error ? err.message : String(err)
        setState({ svg: null, error: msg })
      })
    return () => {
      live = false
    }
  }, [code, theme, near])

  const kind = diagramKind(code)
  const failed = state.error !== null

  return (
    <figure ref={box} className={'diagram' + (failed ? ' diagram-failed' : '')}>
      <div className="diagram-tools">
        {state.svg && (
          <button type="button" onClick={() => setExpanded(true)}>
            Expand
          </button>
        )}
        {!failed && (
          <button type="button" aria-expanded={showSource} onClick={() => setShowSource((s) => !s)}>
            {showSource ? 'Hide source' : 'Source'}
          </button>
        )}
      </div>

      {state.svg ? (
        <div
          className="diagram-canvas"
          role="img"
          aria-label={`${kind}, figure ${number}`}
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : failed ? (
        <div className="diagram-error" role="alert">
          <p className="diagram-error-title">This diagram couldn't be drawn.</p>
          <p className="diagram-error-msg">{firstLines(state.error!)}</p>
        </div>
      ) : (
        <div className="diagram-loading" aria-live="polite">
          Drawing {kind.toLowerCase()}…
        </div>
      )}

      {(showSource || failed) && (
        <pre className="diagram-source">
          <code>{code}</code>
        </pre>
      )}

      <figcaption>
        <span className="fig-no">Figure {number}.</span> {kind}
      </figcaption>

      {expanded && state.svg && (
        <DiagramViewer svg={state.svg} title={`Figure ${number}. ${kind}`} onClose={() => setExpanded(false)} />
      )}
    </figure>
  )
}

function firstLines(msg: string): string {
  return msg.split('\n').slice(0, 6).join('\n')
}
