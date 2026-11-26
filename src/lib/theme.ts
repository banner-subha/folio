import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

// Reader display settings: theme, text size, line width and body font.
// Colors live in styles.css under [data-theme='<id>']; this file only picks one.

export type ThemeId = 'paper' | 'ink' | 'daylight' | 'sepia' | 'slate' | 'contrast'
export type ThemeChoice = ThemeId | 'auto'
export type Width = 'narrow' | 'wide' | 'full'
export type BodyFont = 'serif' | 'sans'

export const THEMES: { id: ThemeId; label: string; note: string }[] = [
  { id: 'paper', label: 'Paper', note: 'Warm light' },
  { id: 'ink', label: 'Ink', note: 'Warm dark' },
  { id: 'daylight', label: 'Daylight', note: 'Bright, neutral' },
  { id: 'sepia', label: 'Sepia', note: 'Low glare' },
  { id: 'slate', label: 'Slate', note: 'Cool dark' },
  { id: 'contrast', label: 'High contrast', note: 'Black and white' },
]

export const SIZES = [15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28]

export type Settings = { theme: ThemeChoice; size: number; width: Width; font: BodyFont }

const DEFAULTS: Settings = { theme: 'auto', size: 20, width: 'full', font: 'serif' }
const KEY = 'folio.settings'

/** The resolved theme id, used by diagrams to re-render in the right palette. */
export const ThemeContext = createContext<ThemeId>('paper')
export const useCurrentTheme = () => useContext(ThemeContext)

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      return {
        theme: raw.theme === 'auto' || THEMES.some((t) => t.id === raw.theme) ? raw.theme : DEFAULTS.theme,
        size: SIZES.includes(raw.size) ? raw.size : DEFAULTS.size,
        width: ['narrow', 'wide', 'full'].includes(raw.width) ? raw.width : DEFAULTS.width,
        font: raw.font === 'sans' ? 'sans' : 'serif',
      }
    }
    // First version stored only "light" or "dark".
    const old = localStorage.getItem('folio.theme')
    if (old === 'light') return { ...DEFAULTS, theme: 'paper' }
    if (old === 'dark') return { ...DEFAULTS, theme: 'ink' }
  } catch {
    /* storage blocked: defaults */
  }
  return DEFAULTS
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<Settings>(load)
  const [dark, setDark] = useState(systemDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const theme: ThemeId = settings.theme === 'auto' ? (dark ? 'ink' : 'paper') : settings.theme

  // Layout effect so the new colors are on the page before diagrams re-render.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.width = settings.width
    root.dataset.font = settings.font
    root.style.setProperty('--doc-size', `${settings.size}px`)
  }, [theme, settings.width, settings.font, settings.size])

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* not remembered, still applied */
      }
      return next
    })

  const stepSize = (dir: 1 | -1) =>
    setSettings((s) => {
      const i = SIZES.indexOf(s.size)
      const size = SIZES[Math.min(SIZES.length - 1, Math.max(0, i + dir))]
      const next = { ...s, size }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })

  return { settings, theme, update, stepSize, defaults: DEFAULTS }
}
