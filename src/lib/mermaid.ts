// Mermaid is large, so it loads only when a document contains a diagram.
// Renders run one at a time: mermaid.initialize is global, and two renders with
// different themes interleaving would draw one diagram in the wrong palette.

import type { Mermaid } from 'mermaid'
import type { ThemeId } from './theme'

const FONT = '"Schibsted Grotesk Variable", "Segoe UI", sans-serif'

// Diagram colors are read from the active theme tokens at render time:
// paper fills, ink lines, and the accent kept for pie emphasis only.
function themeVariables(): Record<string, string> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  const paper = v('--paper-raised')
  const node = v('--node')
  const sunk = v('--paper-sunk')
  const ink = v('--ink')
  const soft = v('--ink-soft')
  const faint = v('--ink-faint')
  const note = v('--note')
  return {
    background: paper,
    mainBkg: node,
    primaryColor: node,
    primaryBorderColor: soft,
    primaryTextColor: ink,
    secondaryColor: sunk,
    secondaryBorderColor: soft,
    secondaryTextColor: ink,
    tertiaryColor: paper,
    tertiaryBorderColor: faint,
    tertiaryTextColor: ink,
    lineColor: soft,
    textColor: ink,
    titleColor: ink,
    nodeTextColor: ink,
    clusterBkg: paper,
    clusterBorder: faint,
    edgeLabelBackground: paper,
    noteBkgColor: note,
    noteBorderColor: faint,
    noteTextColor: ink,
    actorBkg: node,
    actorBorder: soft,
    actorTextColor: ink,
    actorLineColor: soft,
    signalColor: ink,
    signalTextColor: ink,
    labelBoxBkgColor: node,
    labelBoxBorderColor: soft,
    labelTextColor: ink,
    loopTextColor: ink,
    activationBkgColor: sunk,
    activationBorderColor: soft,
    pie1: v('--accent'),
    pie2: soft,
    pie3: faint,
    pie4: v('--syn-function'),
    pie5: v('--syn-string'),
    pie6: v('--syn-number'),
    pieTitleTextColor: ink,
    pieSectionTextColor: v('--paper'),
    pieLegendTextColor: ink,
    pieStrokeColor: paper,
    pieOuterStrokeColor: soft,
  }
}

let mermaidPromise: Promise<Mermaid> | null = null
let queue: Promise<unknown> = Promise.resolve()
let counter = 0
const cache = new Map<string, string>()

function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid').then((m) => m.default)
  return mermaidPromise
}

export function cachedDiagram(code: string, theme: ThemeId): string | undefined {
  return cache.get(theme + '\u0000' + code)
}

/** Renders Mermaid source to an SVG string. Throws with Mermaid's message on bad syntax. */
export function renderDiagram(code: string, theme: ThemeId): Promise<string> {
  const key = theme + '\u0000' + code
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)

  const job = queue.then(async () => {
    const mermaid = await loadMermaid()
    // Text is measured at render time, so the real fonts must be ready first.
    await document.fonts.ready
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      fontFamily: FONT,
      themeVariables: { ...themeVariables(), fontFamily: FONT, fontSize: '15px' },
      flowchart: { htmlLabels: true, curve: 'basis' },
    })
    const { svg } = await mermaid.render(`folio-diagram-${++counter}`, code)
    cache.set(key, svg)
    if (cache.size > 200) cache.delete(cache.keys().next().value!)
    return svg
  })
  queue = job.catch(() => {})
  return job
}

const KINDS: Record<string, string> = {
  graph: 'Flowchart',
  flowchart: 'Flowchart',
  sequencediagram: 'Sequence diagram',
  classdiagram: 'Class diagram',
  statediagram: 'State diagram',
  'statediagram-v2': 'State diagram',
  erdiagram: 'Entity relationship diagram',
  gantt: 'Gantt chart',
  pie: 'Pie chart',
  journey: 'User journey',
  gitgraph: 'Git graph',
  mindmap: 'Mind map',
  timeline: 'Timeline',
  quadrantchart: 'Quadrant chart',
  xychart: 'XY chart',
  'xychart-beta': 'XY chart',
  sankey: 'Sankey diagram',
  'sankey-beta': 'Sankey diagram',
  block: 'Block diagram',
  'block-beta': 'Block diagram',
  architecture: 'Architecture diagram',
  'architecture-beta': 'Architecture diagram',
  requirementdiagram: 'Requirement diagram',
  c4context: 'C4 context diagram',
  kanban: 'Kanban board',
  packet: 'Packet diagram',
  'packet-beta': 'Packet diagram',
  radar: 'Radar chart',
  'radar-beta': 'Radar chart',
}

/** "Flowchart", "Sequence diagram", ... from the first keyword of the source. */
export function diagramKind(code: string): string {
  const first = code
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%') && l !== '---')
  const word = first?.split(/\s+/)[0]?.toLowerCase() ?? ''
  return KINDS[word] ?? 'Diagram'
}
