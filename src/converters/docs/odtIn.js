/**
 * ODT → md/html/txt via content.xml text extraction.
 */
import JSZip from 'jszip'

function decodeEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

function stripInline(inner) {
  return decodeEntities(
    inner
      .replace(/<text:line-break\/>/gi, '\n')
      .replace(/<text:tab\/>/gi, '\t')
      .replace(/<[^>]+>/g, '')
  ).trim()
}

/** @returns {{ kind: 'h'|'p', level?: number, text: string }[]} */
function parseBlocks(xml) {
  const blocks = []
  const re = /<text:(p|h)([^>]*)>([\s\S]*?)<\/text:\1>/gi
  let m
  while ((m = re.exec(xml))) {
    const tag = m[1].toLowerCase()
    const attrs = m[2] || ''
    const text = stripInline(m[3])
    if (!text) continue
    if (tag === 'h') {
      const outline = /text:outline-level="(\d+)"/i.exec(attrs)
      const level = Math.min(6, Math.max(1, Number(outline?.[1] || 1)))
      blocks.push({ kind: 'h', level, text })
    } else {
      blocks.push({ kind: 'p', text })
    }
  }
  return blocks
}

function blocksToTxt(blocks) {
  return blocks.map((b) => b.text).join('\n\n') + '\n'
}

function blocksToMd(blocks) {
  return (
    blocks
      .map((b) => {
        if (b.kind === 'h') return `${'#'.repeat(b.level)} ${b.text}`
        return b.text
      })
      .join('\n\n') + '\n'
  )
}

function blocksToHtml(blocks) {
  const body = blocks
    .map((b) => {
      const esc = b.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      if (b.kind === 'h') return `<h${b.level}>${esc}</h${b.level}>`
      return `<p>${esc}</p>`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ODT</title></head><body>\n${body}\n</body></html>\n`
}

export default async function convertOdt(file, options = {}, onProgress = () => {}) {
  const { to } = options
  onProgress({ stage: 'decode' })
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('content.xml')
  if (!entry) throw new Error('Not a valid ODT (missing content.xml).')
  const xml = await entry.async('string')
  const blocks = parseBlocks(xml)
  const fallback =
    blocks.length === 0
      ? xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + '\n'
      : null
  onProgress({ stage: 'encode' })

  if (to === 'txt') {
    return new Blob([fallback || blocksToTxt(blocks)], { type: 'text/plain;charset=utf-8' })
  }
  if (to === 'md') {
    return new Blob([fallback || blocksToMd(blocks)], { type: 'text/markdown;charset=utf-8' })
  }
  if (to === 'html') {
    const html = fallback
      ? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ODT</title></head><body><p>${fallback
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p></body></html>\n`
      : blocksToHtml(blocks)
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  }
  throw new Error(`Unsupported ODT target "${to}".`)
}
