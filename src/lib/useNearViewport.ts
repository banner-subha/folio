import { useEffect, useRef, useState } from 'react'

// One shared observer for every code block and diagram. Expensive work
// (highlighting, Mermaid layout) starts only when a block comes within
// ~1.5 screens of view, so opening a long document doesn't stall scrolling.

type Cb = () => void
const callbacks = new WeakMap<Element, Cb>()
let observer: IntersectionObserver | null = null

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        callbacks.get(e.target)?.()
        callbacks.delete(e.target)
        observer!.unobserve(e.target)
      }
    },
    { rootMargin: '150% 0px' },
  )
  return observer
}

/** True once the element has come near the viewport; stays true after that. */
export function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const obs = getObserver()
    callbacks.set(el, () => setNear(true))
    obs.observe(el)
    return () => {
      callbacks.delete(el)
      obs.unobserve(el)
    }
  }, [near])

  return [ref, near]
}
