# FormatConvert

A universal file converter that runs entirely in the browser — deployed at
[formatconvert.quantumlogicslimited.com](https://formatconvert.quantumlogicslimited.com).
No server, no uploads: every conversion is a real parse + re-render done locally with JavaScript.

Guides for integrators and contributors: [`docs/`](./docs/README.md).

## Supported conversions

**Documents** — real structural transforms, never renames:

| From | To |
| --- | --- |
| PDF | TXT, Markdown, HTML, Word, PNG, JPEG, WebP, AVIF |
| Word (DOCX) | PDF, Markdown, TXT, HTML, EPUB |
| TXT | PDF, Markdown, HTML, Word, EPUB |
| Markdown | PDF, TXT, HTML, Word, EPUB |
| HTML | PDF, Markdown, TXT, Word, EPUB, RTF |
| RTF | TXT, Markdown, HTML |
| ODT | TXT, Markdown, HTML |
| PPTX | TXT, Markdown, PDF, PNG |
| EPUB | HTML, Markdown, TXT, PDF, Word |

- PDF → text rebuilds lines from character positions with **column-aware reading order**, paragraph
  gap heuristics, and table-ish spacing. Optional OCR: `auto` (empty pages), `force`, or `off`.
- PDF → Markdown infers headings from font sizes, keeps bold text, and detects bullet lists.
- TXT → PDF supports font / size / margin / line-height / Unicode (Noto Sans) and optional
  Markdown layout mode. CJK text triggers an on-demand Noto Sans SC subset download (cached).
- Markdown/HTML → PDF is typeset by a custom layout engine on jsPDF: headings, lists, tables,
  fenced code blocks, blockquotes, links, page numbers, word wrap and page breaks.
- Word documents are parsed with `mammoth` on the way in and generated as real .docx
  with the `docx` library on the way out.

**OCR** — empty / scanned PDF pages fall back to Tesseract (wasm, self-hosted under `/tesseract/`),
and photos/scans convert to text (PNG/JPEG/WebP/BMP/GIF/HEIC/TIFF/AVIF → TXT). English is bundled;
other languages stream on first use.

**Images** — full decode → canvas → re-encode with quality/resize options:

| Inputs | Outputs |
| --- | --- |
| PNG, JPEG, WebP, BMP, GIF, SVG, HEIC, ICO, TIFF, AVIF | PNG, JPEG, WebP, BMP, ICO, GIF, TIFF, AVIF, SVG (embedded raster), PDF |

**Data** — CSV, TSV, Excel (XLSX + legacy XLS), ODS, JSON, JSONL/NDJSON, YAML, TOML, INI, XML (among themselves and to MD/HTML/TXT/PDF/DOCX).

**Subtitles** — SRT, VTT, ASS, SSA, TXT. **Audio / video** — mp3/wav/ogg/flac/m4a/aac/opus and mp4/webm/mov/gif via ffmpeg.wasm (keep media under ~500 MB; WebM/Opus gated on encoder availability). Video pairs support optional scale width and mute.

**Tools** — merge/split/rotate/reorder/extract/compress/watermark/page-numbers/redact/unlock PDF; images-to-pdf/gif; crop/rotate/compress/resize image; trim/normalize audio; trim video; OCR pages; zip/unzip.

**Batch** — drop any number of files on a converter page; each converts independently with a
per-file queue, and results download individually or as one zip. Also in the SDK as
`convertMany()` + `zipResults()`.

**PWA** — installable, works fully offline (app shell precached; OCR / ffmpeg / fonts cache on first
use). Paste input with Ctrl+V; last-used options are remembered per conversion.

## Routes

- `/` — universal dropzone with format auto-detection + all converter tiles
- `/convert/:pair` — e.g. `/convert/pdf-to-md`, one page per conversion
- `/tools/:tool` — merge/split/compress PDF and related tools
- `/developers` — SDK & embed documentation for developers
- `/embed` — chrome-less iframe widget (`?from=pdf&to=txt&parentOrigin=…`), posts `formatconvert:ready|progress|height|result` to the parent window
- Ctrl/Cmd+K command palette; pin favorite converters on Home

## Developer SDK

The same converters ship as a standalone ES module at `/sdk.js`:

```js
import { convert } from 'https://formatconvert.quantumlogicslimited.com/sdk.js'

const { blob, filename } = await convert(file, 'md') // input format auto-detected
```

See [`docs/sdk.md`](./docs/sdk.md) and `/developers` on the site for the full API.

## Development

Requires **Node.js ≥ 22.13**.

```bash
npm install
npm run dev          # app at http://localhost:5173
npm run docs:check   # sitemap URLs match registry
npm run build && npm run e2e
```

`predev`/`prebuild` copy OCR, AVIF wasm, ffmpeg core, and Noto fonts into `public/`
(`tesseract/`, `wasm/`, `ffmpeg/`, `fonts/`) — those directories are generated, gitignored, and
safe to delete.

## Build & deploy

```bash
npm run build      # app + dist/sdk.js + SEO shells + OG cards
npm run preview
```

`dist/` is fully static — deploy anywhere.

**Vercel:** import the repo — `vercel.json` configures SPA fallback, CORS for the SDK, and caching.
**Static HTML under `/convert/…` and `/tools/…` is served preferentially** (before the SPA rewrite),
which is required for crawlers to see prerender meta. See [`docs/seo.md`](./docs/seo.md).

**Other hosts:**

1. Prefer static files first, then SPA fallback to `/index.html`.
2. Optional SDK CORS: `Access-Control-Allow-Origin: *` on `sdk.js` and `pdf.worker.min.mjs`.

## Project structure

```
src/
├── converters/     # conversion engine (app + SDK)
├── seo/            # shared meta copy + FAQ
├── sdk/            # dist/sdk.js entry
├── pages/          # Home, Convert, Tool, Developers, Embed, NotFound
├── components/     # Seo, ConverterWidget, …
└── workers/        # DOM-free convert worker
docs/               # SDK, contributing, architecture, SEO
scripts/            # sitemap, SEO prerender, copy-assets
```
