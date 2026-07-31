export const ORIGIN = 'https://formatconvert.quantumlogicslimited.com'

export const HOME_TITLE = 'FormatConvert — Convert & edit files in your browser'
export const HOME_DESCRIPTION =
  'Client-side file converter with Review & Edit before download — documents, images, data, ebooks, subtitles, and media. Nothing uploaded. Free developer SDK.'

export const DEVELOPERS_TITLE = 'Developer API'
export const DEVELOPERS_DESCRIPTION =
  'Use FormatConvert conversions in your own site with the browser SDK — no uploads, no API keys. Convert PDF, Markdown, images, and more entirely in the browser.'

/** Pair-specific short descriptions (from-to key). */
export const DESCRIPTIONS = {
  'pdf-txt':
    'Extracts real text using character positions — column-aware reading order, paragraph gaps, and optional OCR for scanned pages. Review & edit before download.',
  'pdf-md':
    'Rebuilds document structure — font sizes become headings, bold stays bold, bullets become lists. Edit the Markdown before you save.',
  'pdf-html': 'Structured extraction rendered as a clean, styled HTML document — editable in Review.',
  'md-pdf':
    'Typesets headings, lists, tables, code, quotes, links, and images into a proper PDF. Edit the Markdown source or tweak the PDF output before download.',
  'html-pdf': 'Renders your HTML content into a typeset, paginated PDF — edit source or PDF output in Review.',
  'txt-pdf':
    'Beautiful plain-text typesetting with font, margin, and Unicode options — or Markdown mode. Edit before download.',
  'pdf-png': 'Renders each PDF page to a high-resolution image. Multi-page PDFs download as a zip.',
  'pdf-jpg': 'Renders each PDF page to a high-resolution JPEG. Multi-page PDFs download as a zip.',
  'pdf-webp': 'Renders each PDF page to WebP. Multi-page PDFs download as a zip.',
  'pdf-avif': 'Renders each PDF page to AVIF. Multi-page PDFs download as a zip.',
  'toml-json': 'Parses TOML into structured data and serializes JSON — types preserved in your browser.',
  'json-toml': 'Converts JSON objects into TOML — entirely client-side.',
  'ass-srt': 'Converts ASS/SSA dialogue cues into standard SRT subtitles with accurate timestamps.',
  'srt-ass': 'Builds an ASS subtitle script from SRT cues for players that prefer Advanced SubStation.',
}

export const KIND_FALLBACK = {
  image: 'Full decode and re-encode with quality and size options — a true pixel-level conversion.',
  data: 'Parses your data into a tabular model (or preserves tree shape for JSON/YAML/TOML/XML) and re-serializes — entirely in your browser.',
  ebook: 'Reads or builds EPUB 3 packages with real chapter structure — nothing uploaded.',
  subtitle: 'Converts subtitle cues with accurate timestamps — SRT, VTT, ASS/SSA, and plain text.',
  audio: 'Transcodes audio with ffmpeg.wasm running locally in your browser (~31 MB engine, cached after first use).',
  video: 'Transcodes or extracts from video with ffmpeg.wasm — WebM output when libvpx is available; keep files under ~500 MB.',
  document: 'A real structural conversion, processed entirely in your browser.',
}

export function describePair(from, to, formats) {
  const key = `${from}-${to}`
  if (DESCRIPTIONS[key]) return DESCRIPTIONS[key]
  const kind = formats[from]?.kind
  if (formats[to]?.kind === 'image' || kind === 'image') return KIND_FALLBACK.image
  return KIND_FALLBACK[kind] || KIND_FALLBACK.document
}

export function ogImageUrl(path = '/') {
  if (path === '/' || path === '') return `${ORIGIN}/og/default.svg`
  const slug = path.replace(/^\//, '').replace(/\//g, '-')
  return `${ORIGIN}/og/${slug}.svg`
}

/** Shared FAQ for convert/tool landings. */
export const CONVERTER_FAQ = [
  {
    question: 'Is my file uploaded to a server?',
    answer:
      'No. FormatConvert runs entirely in your browser. Files stay on your device; nothing is sent to our servers for conversion or editing.',
  },
  {
    question: 'Can I edit the file before downloading?',
    answer:
      'Yes. After convert, Review & Edit lets you change the source (with live re-convert) and/or tweak the output (text, images, best-effort PDF tools). A Download button is always available — editing is optional.',
  },
  {
    question: 'What file sizes work best?',
    answer:
      'Documents and images usually work well up to tens of megabytes. Audio/video uses ffmpeg.wasm — keep media under about 500 MB when possible. Very large files may be preview/download only in Review.',
  },
  {
    question: 'Does PDF to text work on scanned PDFs?',
    answer:
      'Yes. When a PDF has little or no text layer, auto OCR runs on empty pages (or force OCR on all pages). English is bundled; other languages download on first use.',
  },
  {
    question: 'Does Markdown to PDF include images?',
    answer:
      'Yes for data:, blob:, and https: image URLs fetched in your browser. Layout is best-effort compared to desktop publishing apps.',
  },
]
