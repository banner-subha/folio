import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = { svg: string; title: string; onClose: () => void }
type View = { x: number; y: number; k: number }

const MIN = 0.2
const MAX = 8

/**
 * Full-window view of one diagram: wheel or buttons to zoom, drag to pan, Esc to close.
 * Pan and zoom write the transform straight to the DOM once per frame instead of
 * going through React state, so dragging a large SVG stays at display rate.
 */
export function DiagramViewer({ svg, title, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const view = useRef<View>({ x: 0, y: 0, k: 1 })
  const frame = useRef(0)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(100)
  // Kept in a ref so a new onClose from the parent doesn't re-run the mount effect
  // (which would bounce keyboard focus).
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const apply = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const { x, y, k } = view.current
      if (content.current) content.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`
      setZoom(Math.round(k * 100))
    })
  }, [])

  const fit = useCallback(() => {
    const s = stage.current
    const c = content.current
    if (!s || !c) return
    // offsetWidth/Height are layout sizes, so the current zoom transform doesn't skew them.
    const w = c.offsetWidth
    const h = c.offsetHeight
    if (!w || !h) return
    const pad = 48
    const k = Math.min((s.clientWidth - pad) / w, (s.clientHeight - pad) / h, 3)
    view.current = { k, x: (s.clientWidth - w * k) / 2, y: (s.clientHeight - h * k) / 2 }
    apply()
  }, [apply])

  useLayoutEffect(() => {
    // Mermaid sizes its SVG to the page column. Here it gets its natural size
    // from the viewBox so zoom percentages mean something.
    const svgEl = content.current?.querySelector('svg')
    const vb = svgEl?.viewBox.baseVal
    if (svgEl && vb && vb.width && vb.height) {
      svgEl.style.maxWidth = 'none'
      svgEl.style.width = `${vb.width}px`
      svgEl.style.height = `${vb.height}px`
    }
    fit()
  }, [fit])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current
      const k = Math.min(MAX, Math.max(MIN, v.k * factor))
      const r = k / v.k
      view.current = { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }
      apply()
    },
    [apply],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const s = stage.current
      if (s) zoomAt(factor, s.clientWidth / 2, s.clientHeight / 2)
    },
    [zoomAt],
  )

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.ctrlKey || e.metaKey) {
        return
      } else if (e.key === '+' || e.key === '=') zoomBy(1.25)
      else if (e.key === '-') zoomBy(0.8)
      else if (e.key === '0') fit()
    }
    window.addEventListener('keydown', onKey, true)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('no-scroll')
      cancelAnimationFrame(frame.current)
      prev?.focus()
    }
  }, [zoomBy, fit])

  useEffect(() => {
    const s = stage.current
    if (!s) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = s.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top)
    }
    s.addEventListener('wheel', onWheel, { passive: false })
    return () => s.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer-bar">
        <span className="viewer-title">{title}</span>
        <div className="viewer-actions">
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out (-)">
            −
          </button>
          <span className="viewer-zoom" aria-live="polite">
            {zoom}%
          </span>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
          <button type="button" onClick={fit} title="Fit to window (0)">
            Fit
          </button>
          <button type="button" ref={closeBtn} onClick={onClose} title="Close (Esc)">
            Close
          </button>
        </div>
      </div>
      <div
        ref={stage}
        className="viewer-stage"
        onPointerDown={(e) => {
          const v = view.current
          drag.current = { px: e.clientX, py: e.clientY, x: v.x, y: v.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          view.current = { ...view.current, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }
          apply()
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div ref={content} className="viewer-content" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>,
    document.body,
  )
}
