import { useEffect, useState } from 'react'

export type Heading = { id: string; text: string; level: number }

type Props = {
  headings: Heading[]
  onPick: (id: string) => void
}

/** Contents list built from the rendered headings, with the current section marked. */
export function Toc({ headings, onPick }: Props) {
  const active = useActiveHeading(headings)
  const minLevel = Math.min(...headings.map((h) => h.level))

  return (
    <nav className="toc" aria-label="Contents">
      <p className="toc-title">Contents</p>
      <ol>
        {headings.map((h) => (
          <li key={h.id} className={'toc-l' + (h.level - minLevel)}>
            <a
              href={'#' + h.id}
              aria-current={active === h.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                onPick(h.id)
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** The last heading that has scrolled past the top bar. */
function useActiveHeading(headings: Heading[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | null = headings[0]?.id ?? null
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 150) current = h.id
        else break
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [headings])

  return active
}
