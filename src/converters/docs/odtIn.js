/**
 * ODT → md/html/txt via content.xml text extraction.
 */
import JSZip from 'jszip'

function xmlTextContent(xml) {
  // Prefer text:p / text:h paragraphs
  const paras = []
  const re = /<text:(?:p|h)[^>]*>([\s\S]*?)<\/text:(?:p|h)>/gi
  let m
  while ((m = re.exec(xml))) {
    const inner = m[1]
      .replace(/<text:line-break\/>/gi, '\n')
      .replace(/<text:tab\/>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim()
    if (inner) paras.push(inner)
  }
  if (paras.length) return paras.join('\n\n') + '\n'
  // Fallback: strip all tags
  return (
    xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() + '\n'
  )
}

export default async function convertOdt(file, options = {}, onProgress = () => {}) {
  const { to } = options
  onProgress({ stage: 'decode' })
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('content.xml')
  if (!entry) throw new Error('Not a valid ODT (missing content.xml).')
  const xml = await entry.async('string')
  const text = xmlTextContent(xml)
  onProgress({ stage: 'encode' })

  if (to === 'txt') return new Blob([text], { type: 'text/plain;charset=utf-8' })
  if (to === 'md') return new Blob([text], { type: 'text/markdown;charset=utf-8' })
  if (to === 'html') {
    const body = text
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
      .join('\n')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ODT</title></head><body>\n${body}\n</body></html>\n`
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  }
  throw new Error(`Unsupported ODT target "${to}".`)
}
