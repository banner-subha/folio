# Folio test document

This file exercises every block Folio renders. Open it after any change to the
renderer and scroll top to bottom. Jump to [the diagrams](#diagrams), read the
[Mermaid docs](https://mermaid.js.org/), or follow a [relative link](./second.md#second-heading).

## Diagrams

The flowchart below is the component diagram from an architecture doc, the case
that started this project: other viewers printed it as raw text.

```mermaid
graph TD
    CONFIG["Config YAML (metrics.yaml, monitor_rules.yaml)"] --> SEM["Semantic Layer (SemanticRegistry)"]
    CONFIG --> MON["Deterministic Monitor (DeterministicMonitor)"]
    DATA["Warehouse & Ingestion (data/scripts, DuckDB, PostgreSQL)"] --> MON
    DATA <--> SANDBOX["Read-Only Sandbox (SQLValidator, ReadOnlyDBClient, attribution)"]
    SEM --> MON
    SEM --> AGENT["LangGraph Agent (build_rca_graph, 6 Nodes)"]
    MON --> API["FastAPI Backend (rca_agent.main)"]
    MON --> AGENT
    AGENT <--> SANDBOX
    AGENT --> DELIV["Delivery Layer (formatter, slack_webhook)"]
    DELIV --> API
    API --> AGENT
    API <--> UI["Web Workbench (ui/index.html, ui/app.js)"]
    EVALS["Eval Suite (evals/run_evals.py)"] --> MON
    EVALS --> AGENT
    EVALS --> SANDBOX
```

A sequence diagram:

```mermaid
sequenceDiagram
    participant U as Reader
    participant F as Folio
    participant D as Disk
    U->>F: Double-click ARCHITECTURE.md
    F->>D: read_markdown(path)
    D-->>F: text
    F->>F: render Markdown + Mermaid
    Note over F,D: watch_file keeps an eye on the folder
    D-->>F: file-changed
    F->>D: read again, keep scroll
```

This one has a syntax error on purpose, so the error state shows:

```mermaid
graph TD
    A --> B -->
    this is not mermaid
```

## Code

```python
def reading_time(words: int, wpm: int = 230) -> float:
    """Minutes to read a document at a steady pace."""
    return round(words / wpm, 1)
```

```ts
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}
```

```
A fence with no language stays plain.
```

Inline code like `read_markdown` sits in the line.

## Tables

| Block        | Renderer        | Notes                    |
| ------------ | --------------- | ------------------------ |
| Markdown     | react-markdown  | GFM, sanitized raw HTML  |
| Code         | Shiki           | loads grammars on demand |
| Diagrams     | Mermaid         | themed to the paper      |
| Math         | KaTeX           | inline and display       |

### Task list

- [x] Render Mermaid
- [x] Highlight code
- [ ] Print stylesheet

## Math

Inline math such as $e^{i\pi} + 1 = 0$ flows with text. Display math:

$$
\text{Load ratio} = \frac{\text{Pending backlog}}{\text{Monthly capacity}}
$$

## Prose

> A quoted passage keeps its own voice, set in italic with a hairline beside it.

Text with a footnote.[^1] A missing local image falls back to its alt text:

![Missing diagram export](./does-not-exist.png)

---

### Deep heading

#### Fourth level

Last paragraph.

[^1]: Footnotes collect at the end of the document.
