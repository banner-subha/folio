import { useEffect, useState } from 'react'
import { highlight, normalizeLang } from '../lib/highlight'
import { useNearViewport } from '../lib/useNearViewport'

type Props = { code: string; lang?: string }

export function CodeBlock({ code, lang }: Props) {
  const [box, near] = useNearViewport<HTMLDivElement>()
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    // Plain text shows at once; colors arrive when the block is near the screen.
    if (!near) return
    let live = true
    setHtml(null)
    highlight(code, lang)
      .then((h) => live && setHtml(h))
      // Highlighting is cosmetic: on failure the plain block below stays.
      .catch(() => {})
    return () => {
      live = false
    }
  }, [code, lang, near])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  const label = lang && lang !== 'text' && lang !== 'plaintext' ? (normalizeLang(lang) ?? lang) : null

  return (
    <div className="code" ref={box}>
      <div className="code-bar">
        <span className="code-lang">{label ?? 'text'}</span>
        <button type="button" className="code-copy" onClick={copy} aria-live="polite">
          {copied === 'ok' ? 'Copied' : copied === 'fail' ? "Couldn't copy" : 'Copy'}
        </button>
      </div>
      {html ? (
        <div className="code-body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="code-body code-plain">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
