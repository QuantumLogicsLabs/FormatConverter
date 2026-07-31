import { marked } from 'marked'
import { PdfBuilder } from './pdfLayout.js'
import { inlineRuns, plainText, unescapeHtml } from './inlineTokens.js'

const PAGEBREAK_RE = /<!--\s*pagebreak\s*-->/i
const IMG_TAG_RE = /<img\s+[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
const IMG_ALT_RE = /<img\s+[^>]*\balt=["']([^"']*)["'][^>]*>/i

function isPagebreakToken(token) {
  return token?.type === 'html' && PAGEBREAK_RE.test(token.text || '')
}

/** Split inline tokens into segments around inline `<!-- pagebreak -->` markers. */
function splitOnInlinePagebreak(tokens = []) {
  const segments = [[]]
  for (const token of tokens) {
    if (isPagebreakToken(token)) segments.push([])
    else segments[segments.length - 1].push(token)
  }
  return segments
}

async function fetchImageBytes(src) {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

/** Resolve an image src (data:/https:/blob:) and embed it via builder.writeImage. Returns false on failure. */
async function embedImageSrc(builder, src, opts = {}) {
  if (!src) return false
  try {
    if (src.startsWith('data:')) {
      builder.writeImage(src, opts)
      return true
    }
    if (/^https:\/\//i.test(src) || src.startsWith('blob:')) {
      const bytes = await fetchImageBytes(src)
      builder.writeImage(bytes, opts)
      return true
    }
  } catch {
    return false
  }
  return false
}

async function renderTokens(builder, tokens, ctx = { indent: 0, quote: false }) {
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        break
      case 'heading':
        builder.writeHeading(inlineRuns(token.tokens), token.depth)
        break
      case 'paragraph': {
        const imgOnly = token.tokens?.length === 1 && token.tokens[0].type === 'image'
        if (imgOnly) {
          const img = token.tokens[0]
          const embedded = await embedImageSrc(builder, img.href, { caption: img.text, indent: ctx.indent })
          if (embedded) break
        }
        const hasInlinePagebreak = token.tokens?.some(isPagebreakToken)
        if (hasInlinePagebreak) {
          const segments = splitOnInlinePagebreak(token.tokens)
          segments.forEach((seg, i) => {
            if (i > 0) builder.addPage()
            if (!seg.length) return
            const runs = inlineRuns(seg, ctx.quote ? { color: [90, 96, 110], italic: true } : {})
            builder.writeRuns(runs, { indent: ctx.indent, spacingAfter: 10 })
          })
          break
        }
        const runs = inlineRuns(token.tokens, ctx.quote ? { color: [90, 96, 110], italic: true } : {})
        builder.writeRuns(runs, { indent: ctx.indent, spacingAfter: 10 })
        break
      }
      case 'code': {
        if (token.lang) {
          const lang = String(token.lang).split(/\s+/)[0]
          builder.writeRuns([{ text: lang.toUpperCase(), mono: true, color: [140, 145, 155] }], {
            indent: ctx.indent,
            size: 8.5,
            spacingAfter: 2,
          })
        }
        builder.writeCodeBlock(token.text, { indent: ctx.indent })
        break
      }
      case 'blockquote':
        await builder.writeBlockquote(async () => {
          await renderTokens(builder, token.tokens, { indent: ctx.indent + 16, quote: true })
        })
        break
      case 'list': {
        let n = Number(token.start) || 1
        for (const item of token.items) {
          const bulletText = token.ordered ? `${n++}.` : '•'
          await renderListItem(builder, item, bulletText, ctx)
        }
        builder.space(4)
        break
      }
      case 'table': {
        const header = token.header.map((c) => plainText(c.tokens))
        const rows = token.rows.map((row) => row.map((c) => plainText(c.tokens)))
        builder.writeTable(header, rows)
        // Linear text mirror so pdf→txt round-trips cell values reliably
        const mirror = [header, ...rows].map((r) => r.join(' | ')).join(' · ')
        if (mirror.trim()) {
          builder.writeRuns([{ text: mirror, mono: true }], { spacingAfter: 8 })
        }
        break
      }
      case 'hr':
        builder.writeHr()
        break
      case 'html': {
        const raw = token.text || ''
        if (PAGEBREAK_RE.test(raw)) {
          builder.addPage()
          const remainder = unescapeHtml(raw.replace(new RegExp(PAGEBREAK_RE, 'gi'), '').replace(/<[^>]*>/g, '')).trim()
          if (remainder) builder.writeRuns([{ text: remainder }], { indent: ctx.indent })
          break
        }
        const imgMatch = raw.match(IMG_TAG_RE)
        if (imgMatch) {
          const altMatch = raw.match(IMG_ALT_RE)
          const embedded = await embedImageSrc(builder, imgMatch[1], { caption: altMatch?.[1], indent: ctx.indent })
          if (embedded) break
        }
        const text = unescapeHtml(raw.replace(/<[^>]*>/g, '')).trim()
        if (text) builder.writeRuns([{ text }], { indent: ctx.indent })
        break
      }
      case 'text': {
        const runs = token.tokens?.length ? inlineRuns(token.tokens) : [{ text: unescapeHtml(token.text) }]
        builder.writeRuns(runs, { indent: ctx.indent, spacingAfter: 4 })
        break
      }
      default:
        if (token.text) builder.writeRuns([{ text: unescapeHtml(token.text) }], { indent: ctx.indent })
    }
  }
}

async function renderListItem(builder, item, bulletText, ctx) {
  const indent = ctx.indent + 18
  const blocks = item.tokens || []
  let first = true
  const checkbox = item.task ? (item.checked ? '[x] ' : '[ ] ') : ''

  for (const block of blocks) {
    if (first && (block.type === 'text' || block.type === 'paragraph')) {
      const runs = block.tokens?.length ? inlineRuns(block.tokens) : [{ text: unescapeHtml(block.text) }]
      if (checkbox) runs.unshift({ text: checkbox, mono: true })
      builder.writeRuns(runs, {
        indent,
        spacingAfter: 3,
        bullet: { text: bulletText, offset: 14, run: { color: [90, 96, 110] } },
      })
      first = false
    } else {
      await renderTokens(builder, [block], { ...ctx, indent })
      first = false
    }
  }
  if (blocks.length === 0) {
    builder.writeRuns([{ text: '' }], { indent, spacingAfter: 3, bullet: { text: bulletText, offset: 14 } })
  }
}

/** Render a Markdown string to a styled PDF Blob. */
export async function markdownToPdf(md, options = {}) {
  const tokens = marked.lexer(md, { gfm: true })
  const builder = new PdfBuilder({
    pageSize: options.pageSize,
    fontSize: options.fontSize,
    lineHeight: options.lineHeight,
    margin: options.margin,
    font: options.font,
    pageNumbers: options.pageNumbers !== false && options.pageNumbers !== 'off',
  })
  await builder.prepareFonts(md)
  if (options.title) builder.writeTitle(String(options.title))
  await renderTokens(builder, tokens)
  return builder.finish()
}

export default async function mdToPdf(file, options) {
  const md = await file.text()
  return markdownToPdf(md, options)
}
