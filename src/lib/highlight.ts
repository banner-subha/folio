// Shiki highlighter, created once. Languages load on first use so a document
// with only Python never pulls in the other 200 grammars.
// The JavaScript regex engine avoids shipping the Oniguruma WASM blob.
// Shiki itself is imported lazily, so it stays out of the startup bundle.

import type { Highlighter, ThemeRegistration } from 'shiki'

// One code theme whose colors are CSS variables (--syn-* in styles.css), so code
// follows whichever reader theme is active without highlighting again.
// Stock themes put comments under 4.5:1 on the paper backgrounds; the --syn-*
// values are checked for AA in every theme.
type Palette = { fg: string; comment: string; keyword: string; string: string; number: string; func: string; type: string; punct: string }

function folioTheme(name: string, p: Palette): ThemeRegistration {
  return {
    name,
    type: 'light',
    colors: { 'editor.foreground': p.fg, 'editor.background': 'transparent' },
    tokenColors: [
      { settings: { foreground: p.fg } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: p.comment, fontStyle: 'italic' } },
      { scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.control'], settings: { foreground: p.keyword } },
      { scope: ['string', 'string.quoted', 'string.template', 'markup.inline.raw'], settings: { foreground: p.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.character', 'support.constant', 'variable.other.constant'], settings: { foreground: p.number } },
      { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: p.func } },
      { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], settings: { foreground: p.type } },
      { scope: ['entity.name.tag', 'markup.heading'], settings: { foreground: p.keyword } },
      { scope: ['entity.other.attribute-name', 'support.type.property-name', 'meta.object-literal.key'], settings: { foreground: p.number } },
      { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: p.punct } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.deleted'], settings: { foreground: p.keyword } },
      { scope: ['markup.inserted'], settings: { foreground: p.string } },
    ],
  }
}

const readerTheme = folioTheme('folio', {
  fg: 'var(--ink)', comment: 'var(--syn-comment)', keyword: 'var(--syn-keyword)', string: 'var(--syn-string)',
  number: 'var(--syn-number)', func: 'var(--syn-function)', type: 'var(--syn-type)', punct: 'var(--ink-soft)',
})

const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  yml: 'yaml',
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  rs: 'rust',
  md: 'markdown',
  dockerfile: 'docker',
}

let highlighter: Promise<Highlighter> | null = null

type Shiki = typeof import('shiki')

let shiki: Promise<Shiki> | null = null

function loadShiki(): Promise<Shiki> {
  shiki ??= import('shiki')
  return shiki
}

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= Promise.all([loadShiki(), import('shiki/engine/javascript')]).then(([s, engine]) =>
    s.createHighlighter({
      themes: [readerTheme],
      langs: [],
      engine: engine.createJavaScriptRegexEngine(),
    }),
  )
  return highlighter
}

/** Canonical language name for a fence tag ("py" becomes "python"). */
export function normalizeLang(lang: string | undefined): string | null {
  if (!lang) return null
  const key = lang.toLowerCase()
  return ALIASES[key] ?? key
}

/** HTML for a highlighted block, or null when the language is unknown. */
export async function highlight(code: string, lang: string | undefined): Promise<string | null> {
  const resolved = normalizeLang(lang)
  if (!resolved) return null
  // Switching tabs re-renders a document; reuse earlier output instead of re-tokenizing.
  const key = resolved + '\u0000' + code
  const hit = cache.get(key)
  if (hit) return hit
  const { bundledLanguages } = await loadShiki()
  if (!(resolved in bundledLanguages)) return null
  const hl = await getHighlighter()
  if (!hl.getLoadedLanguages().includes(resolved)) {
    await hl.loadLanguage(resolved as keyof typeof bundledLanguages)
  }
  const html = hl.codeToHtml(code, {
    lang: resolved,
    theme: 'folio',
  })
  cache.set(key, html)
  if (cache.size > 500) cache.delete(cache.keys().next().value!)
  return html
}

const cache = new Map<string, string>()
