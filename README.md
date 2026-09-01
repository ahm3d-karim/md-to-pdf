# Markdown to PDF (LaTeX)

A static web app that turns Markdown into a LaTeX-typeset PDF, entirely in your browser. No server, no upload, no account.

## Why

Documents that need to look like a real paper (thesis drafts, problem sets, reports) come out best with LaTeX. This app gives you the LaTeX look without installing TeX: Computer Modern fonts via KaTeX, numbered sections, A4 pages with standard margins.

## What it does

- Renders Markdown with marked.js, sanitizes it with DOMPurify
- Typesets math with KaTeX: `$...$` inline, `$$...$$` display
- Styles the output like a LaTeX article: Computer Modern, auto-numbered sections (`1`, `1.1`), justified text
- Download PDF: opens the browser print dialog, A4 with 25mm x 28mm margins, page breaks kept out of tables and code blocks
- Download .tex: exports real LaTeX source (`\section`, `itemize`, `verbatim`, `tabular`, math passthrough) for local compilation
- Light and dark themes

## Usage

Open `index.html` in any modern browser, or serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000. A sample document loads on start.

The PDF is produced by the browser's print-to-PDF, so choose "Save as PDF" in the print dialog and keep the default A4.

## Limitations (stated plainly)

- The on-screen preview is a faithful approximation, not pdfTeX. Kerning and page breaks may differ slightly from a local compile. For a final manuscript, use the exported `.tex` with pdflatex.
- Markdown syntax not mapped to LaTeX comes through as escaped text. Check the `.tex` before compiling.
- The `.tex` export needs `geometry`, `amsmath`, `amssymb`, `graphicx`, and `hyperref` (standard in TeX Live and MiKTeX).

## Files

```
index.html   page structure
styles.css   editor/preview layout, LaTeX sheet styles, print rules
app.js       rendering pipeline and markdown-to-LaTeX converter
```

## License

MIT