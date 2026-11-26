# Folio

A Windows Markdown reader that draws Mermaid diagrams instead of printing them
as code. Built because the MarkView Store app showed `graph TD` blocks as raw text.

## What it renders

- GitHub-flavored Markdown: tables, task lists, footnotes, strikethrough, autolinks
- Raw HTML inside Markdown, sanitized with GitHub's rules
- Mermaid diagrams (all types), themed to the page, with an Expand view for zoom and pan
- Code highlighting with Shiki, grammars loaded on demand
- Math with KaTeX (`$inline$` and `$$display$$`)
- Local images next to the file, and remote images

## Reading features

- Opens `.md` files by double-click once installed (file association), by drag and drop, or with Ctrl+O
- Open a folder (Ctrl+Shift+O): every Markdown file under it, found recursively, is listed in the
  Files sidebar, grouped by subfolder, with a filter box. Hidden folders and dependency/build folders
  (node_modules, target, dist, ...) are skipped; the scan stops at 5,000 files. The folder reopens on next launch.
- Tabs: each file opens in its own tab (or switches to it if already open). Ctrl+Tab / Ctrl+Shift+Tab
  cycle, Ctrl+1..9 jump, Ctrl+W or middle-click closes. Each tab keeps its scroll position.
  Links open in the same tab; Ctrl+click opens them in a new one.
- Reloads on save, keeping your scroll position
- Contents sidebar with the current section marked; becomes a drawer in narrow windows
- Relative links to other `.md` files open in Folio; other local files are shown in Explorer
- Back (or Alt+Left) returns to the previous document in the same tab after following a link
- Recent menu in the top bar lists recently read files; also on the start screen
- Display menu: 6 themes (Paper, Ink, Daylight, Sepia, Slate, High contrast) or Match Windows,
  text size (Ctrl+= / Ctrl+-), line width (Narrow, Wide, Full window), serif or sans body

## Speed

- Startup bundle is ~260 KB; the Markdown parser, KaTeX, Shiki and Mermaid load on demand
  (the parser is fetched in parallel with reading the file)
- Code highlighting and diagrams render only when they come within about 1.5 screens of view
- Off-screen blocks use `content-visibility: auto`, so long files scroll like short ones
- The window stays hidden until its first frame paints, so there is no white flash
- Diagram pan and zoom write the transform once per frame, outside React

## Stack

Tauri 2 (Rust shell, WebView2) with React 19, TypeScript and Vite.
Markdown runs through react-markdown with remark-gfm, remark-math, rehype-raw,
rehype-sanitize, rehype-katex and rehype-slug.

The Rust side (`src-tauri/src/lib.rs`) has three commands: `read_markdown`,
`initial_file` (the file Folio was launched with) and `watch_file`, which watches
the file's folder with `notify` and emits `file-changed`.

## Develop

```powershell
npm install
npm run tauri dev
```

`npm run dev` alone serves the UI in a browser at http://localhost:4700. There
you can open or drop files, but local images, local links and live reload need
the desktop app.

`fixtures/sample.md` exercises every block type, including a deliberately broken
diagram. Open it after renderer changes.

## Build the installer

```powershell
npm run tauri build
```

Output: `src-tauri/target/release/bundle/nsis/Folio_0.1.0_x64-setup.exe`.
Installing it registers Folio for `.md` and `.markdown`; pick it once under
"Open with" to make it the default.

## Icon

`assets/icon.svg` is the source: a folded page with the vermilion rubric rule,
two text lines and a small flowchart, in the Paper palette. Regenerate the sizes with
`npx tauri icon assets/icon.svg`, then delete the `android/` and `ios/` folders it
also writes into `src-tauri/icons/`. The start-screen wordmark is still plain text.
