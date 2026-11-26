// This module is lazy-loaded (see App.tsx), so the parser, KaTeX and their CSS
// stay out of the startup bundle.
import 'katex/dist/katex.min.css'
import type { Element, ElementContent, Root } from 'hast'
import { toString } from 'hast-util-to-string'
import { memo, useLayoutEffect, type ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CodeBlock } from './CodeBlock'
import { MermaidFigure } from './MermaidFigure'

// Raw HTML in Markdown is allowed (READMEs lean on it) but sanitized with
// GitHub's rules. The math classes are added so remark-math output survives
// sanitizing and reaches KaTeX.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'math-inline', 'math-display']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math-display']],
  },
}

/** Numbers Mermaid blocks in document order so captions read "Figure 1", "Figure 2". */
function rehypeFigureNumbers() {
  return (tree: Root) => {
    let n = 0
    const walk = (node: Root | ElementContent) => {
      if (node.type === 'element' && node.tagName === 'pre') {
        const code = codeChild(node)
        if (code && langOf(code) === 'mermaid') {
          node.properties.dataFigure = ++n
          return
        }
      }
      if ('children' in node) node.children.forEach((c) => walk(c as ElementContent))
    }
    walk(tree)
  }
}

function codeChild(pre: Element): Element | undefined {
  return pre.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
}

function langOf(code: Element): string | undefined {
  const cls = code.properties.className
  const list = Array.isArray(cls) ? cls.map(String) : []
  return list.find((c) => c.startsWith('language-'))?.slice('language-'.length)
}

type Props = {
  text: string
  onLink: (href: string, e: React.MouseEvent<HTMLAnchorElement>) => void
  resolveImage: (src: string) => string | undefined
  /** Runs after each new text is in the DOM (headings exist from then on). */
  onRendered: () => void
}

function MarkdownView({ text, onLink, resolveImage, onRendered }: Props) {
  useLayoutEffect(onRendered, [text, onRendered])

  const components: Components = {
    pre({ node, children }) {
      const code = node && codeChild(node)
      if (!code) return <pre>{children}</pre>
      const lang = langOf(code)
      const source = toString(code).replace(/\n$/, '')
      if (lang === 'mermaid') {
        return <MermaidFigure code={source} number={Number(node.properties.dataFigure) || 0} />
      }
      return <CodeBlock code={source} lang={lang} />
    },
    a({ node: _node, href, children, ...rest }) {
      return (
        <a {...rest} href={href} onClick={(e) => href && onLink(href, e)}>
          {children}
        </a>
      )
    },
    img({ node: _node, src, alt, ...rest }) {
      return <DocImage {...rest} src={typeof src === 'string' ? resolveImage(src) : undefined} alt={alt} />
    },
    table({ node: _node, children, ...rest }) {
      return (
        <div className="table-wrap" tabIndex={0}>
          <table {...rest}>{children}</table>
        </div>
      )
    },
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      remarkRehypeOptions={{ clobberPrefix: '' }}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex, rehypeSlug, rehypeFigureNumbers]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  )
}

/** Shows the alt text in a quiet box when an image can't load, instead of a broken icon. */
function DocImage({ src, alt, ...rest }: ComponentProps<'img'>) {
  if (!src) return <span className="img-missing">{alt || 'Image'} (not available)</span>
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        const note = document.createElement('span')
        note.className = 'img-missing'
        note.textContent = `${alt || 'Image'} (couldn't load)`
        el.replaceWith(note)
      }}
    />
  )
}

export const Markdown = memo(MarkdownView)
