/* Markdown to PDF (LaTeX) - app logic
   marked -> DOMPurify -> KaTeX auto-render -> LaTeX-styled sheet.
   PDF: browser print dialog (A4, LaTeX margins).
   .tex: real LaTeX source exported from the markdown. */

(function () {
  "use strict";

  var editor = document.getElementById("editor");
  var sheet = document.getElementById("sheet");
  var pdfBtn = document.getElementById("pdf-btn");
  var texBtn = document.getElementById("tex-btn");
  var sampleBtn = document.getElementById("sample-btn");
  var clearBtn = document.getElementById("clear-btn");
  var themeToggle = document.getElementById("theme-toggle");

  var SAMPLE = [
    "# Introduction",
    "",
    "This document demonstrates the converter. Math is typeset with KaTeX, which renders LaTeX mathematics in the browser.",
    "",
    "## A theorem with proof",
    "",
    "**Theorem (Euler).** For every real number $x$,",
    "",
    "$$ e^{ix} = \\cos x + i \\sin x $$",
    "",
    "**Proof.** Expand the three series and compare terms:",
    "",
    "$$ e^{ix} = \\sum_{n=0}^{\\infty} \\frac{(ix)^n}{n!} $$",
    "",
    "## A matrix example",
    "",
    "$$ A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}, \\quad \\det(A) = 1 \\cdot 4 - 2 \\cdot 3 = -2 $$",
    "",
    "## Lists",
    "",
    "- First item",
    "- Second item with $\\alpha$ inline",
    "",
    "1. Ordered step one",
    "2. Ordered step two",
    "",
    "## Code",
    "",
    "```python",
    "def fib(n):",
    "    return n if n < 2 else fib(n - 1) + fib(n - 2)",
    "```",
    "",
    "## Table",
    "",
    "| Symbol | Meaning |",
    "|--------|---------|",
    "| $\\nabla$ | gradient operator |",
    "| $\\partial$ | partial derivative |",
    "",
    "> A blockquote keeps the source honest.",
    ""
  ].join("\n");

  // ---- theme ---------------------------------------------------------------
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("md2pdf-theme", t); } catch (e) { /* private mode */ }
  }
  var saved = null;
  try { saved = localStorage.getItem("md2pdf-theme"); } catch (e) { /* ignore */ }
  applyTheme(saved || "light");
  themeToggle.addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // ---- render ---------------------------------------------------------------
  var renderTimer = null;
  editor.addEventListener("input", function () {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 250);
  });

  function render() {
    var raw = editor.value;
    var html;
    try {
      html = marked.parse(raw);
    } catch (e) {
      sheet.innerHTML = "<p><em>Markdown parse failed: " + e.message + "</em></p>";
      return;
    }
    html = DOMPurify.sanitize(html);
    sheet.innerHTML = html;
    if (window.renderMathInElement) {
      try {
        renderMathInElement(sheet, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false
        });
      } catch (e) { /* math rendering is best-effort */ }
    }
  }

  // ---- actions ---------------------------------------------------------------
  pdfBtn.addEventListener("click", function () { window.print(); });

  texBtn.addEventListener("click", function () { downloadTex(editor.value); });

  sampleBtn.addEventListener("click", function () {
    editor.value = SAMPLE;
    render();
    editor.focus();
  });

  clearBtn.addEventListener("click", function () {
    editor.value = "";
    render();
    editor.focus();
  });

  // ---- markdown -> LaTeX ------------------------------------------------------
  function downloadTex(md) {
    var tex = mdToLatex(md);
    var blob = new Blob([tex], { type: "application/x-tex;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "document.tex";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function escapeLatex(s) {
    return s.replace(/([\\{}_$#&%])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
  }

  function mdToLatex(md) {
    var lines = md.replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var inCode = false;
    var inList = null; // "itemize" | "enumerate"
    var tableRows = [];

    function closeList() {
      if (inList) { out.push("\\end{" + inList + "}"); inList = null; }
    }
    function flushTable() {
      if (!tableRows.length) return;
      var cols = tableRows[0].length;
      out.push("\\begin{center}");
      out.push("\\begin{tabular}{" + "l".repeat(cols) + "}");
      out.push("\\hline");
      tableRows.forEach(function (row, i) {
        out.push(row.join(" & ") + " \\\\");
        if (i === 0) out.push("\\hline");
      });
      out.push("\\hline");
      out.push("\\end{tabular}");
      out.push("\\end{center}");
      tableRows = [];
    }

    lines.forEach(function (line) {
      var t = line.trim();

      // fenced code
      if (/^```/.test(t)) {
        if (inCode) { out.push("\\end{verbatim}"); inCode = false; return; }
        closeList(); flushTable();
        out.push("\\begin{verbatim}"); inCode = true; return;
      }
      if (inCode) { out.push(line); return; }

      // blank line
      if (!t) { closeList(); flushTable(); out.push(""); return; }

      // table row
      if (t.startsWith("|") && t.endsWith("|")) {
        closeList();
        var cells = t.split("|").slice(1, -1);
        var isSep = cells.every(function (c) { return /^[-:]+$/.test(c.trim()); });
        if (!isSep) {
          tableRows.push(cells.map(function (c) { return inlineLatex(c.trim()); }));
        }
        return;
      }

      // headings
      var h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        closeList(); flushTable();
        var level = h[1].length;
        out.push(level === 1 ? "\\section{" + escapeLatex(h[2]) + "}"
          : level === 2 ? "\\subsection{" + escapeLatex(h[2]) + "}"
          : level === 3 ? "\\subsubsection{" + escapeLatex(h[2]) + "}"
          : "\\paragraph{" + escapeLatex(h[2]) + "}");
        return;
      }

      // lists
      var ul = t.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        flushTable();
        if (inList !== "itemize") { closeList(); out.push("\\begin{itemize}"); inList = "itemize"; }
        out.push("  \\item " + inlineLatex(ul[1]));
        return;
      }
      var ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        flushTable();
        if (inList !== "enumerate") { closeList(); out.push("\\begin{enumerate}"); inList = "enumerate"; }
        out.push("  \\item " + inlineLatex(ol[1]));
        return;
      }
      closeList(); flushTable();

      // hr
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push("\\hrulefill"); return; }

      // blockquote
      var bq = t.match(/^>\s?(.*)$/);
      if (bq) { out.push("\\begin{quote}" + inlineLatex(bq[1]) + "\\end{quote}"); return; }

      // paragraph
      out.push(inlineLatex(t));
    });

    if (inCode) { out.push("\\end{verbatim}"); }
    closeList(); flushTable();

    return [
      "% Generated by md-to-pdf (https://github.com/ahm3d-karim/md-to-pdf)",
      "\\documentclass[11pt]{article}",
      "\\usepackage[margin=1in]{geometry}",
      "\\usepackage{amsmath, amssymb}",
      "\\usepackage{graphicx}",
      "\\usepackage[normalem]{ulem}",
      "\\usepackage[colorlinks=true]{hyperref}",
      "",
      "\\begin{document}",
      "",
      out.join("\n"),
      "",
      "\\end{document}",
      ""
    ].join("\n");
  }

  function inlineLatex(s) {
    var out = "";
    var i = 0;
    var n = s.length;
    while (i < n) {
      var ch = s[i];
      var rest = s.slice(i);

      // inline code
      if (rest.startsWith("`")) {
        var end = rest.indexOf("`", 1);
        if (end > 0) {
          out += "\\texttt{" + escapeLatex(rest.slice(1, end)) + "}";
          i += end + 1;
          continue;
        }
      }

      // math passthrough: keep $$...$$, $...$ and \(...\) unescaped
      var dd = rest.match(/^\$\$([^$]+)\$\$/);
      if (dd) { out += "$$" + dd[1] + "$$"; i += dd[0].length; continue; }
      if (ch === "$") {
        var m = rest.match(/^\$([^$]+)\$/);
        if (m) { out += "$" + m[1] + "$"; i += m[0].length; continue; }
      }
      if (rest.startsWith("\\(")) {
        var me = rest.match(/^\\\((.+?)\\\)/);
        if (me) { out += "\\(" + me[1] + "\\)"; i += me[0].length; continue; }
      }

      // bold
      if (rest.startsWith("**")) {
        var b = rest.match(/^\*\*(.+?)\*\*/);
        if (b) { out += "\\textbf{" + b[1] + "}"; i += b[0].length; continue; }
      }
      // italic
      var it = rest.match(/^([*_])(.+?)\1/);
      if (it && it[2].trim()) { out += "\\textit{" + it[2] + "}"; i += it[0].length; continue; }
      // strikethrough
      var st = rest.match(/^~~(.+?)~~/);
      if (st) { out += "\\sout{" + st[1] + "}"; i += st[0].length; continue; }
      // link
      var ln = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
      if (ln) { out += "\\href{" + ln[2] + "}{" + ln[1] + "}"; i += ln[0].length; continue; }
      // image
      var im = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
      if (im) { out += "\\includegraphics[width=\\linewidth]{" + im[2] + "}"; i += im[0].length; continue; }

      out += escapeLatex(ch);
      i++;
    }
    return out;
  }

  // boot: sample doc, then render
  editor.value = SAMPLE;
  render();
})();