import { PDFDocument, rgb } from 'pdf-lib'
import { parsePageRanges } from '../../lib/pageRanges.js'

async function loadPdf(file) {
  const bytes = await file.arrayBuffer()
  try {
    return await PDFDocument.load(bytes)
  } catch (e) {
    const msg = e?.message || String(e)
    if (/encrypt|password|encrypted/i.test(msg)) {
      throw new Error('This PDF is password-protected. Use the Unlock PDF tool to remove the password, then try again.')
    }
    throw new Error(`Could not read PDF: ${msg}`)
  }
}

/** Draw black rectangles over selected pages (full-page redact). */
export default async function redactPdf(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose a PDF to redact.')
  const doc = await loadPdf(file)
  const count = doc.getPageCount()
  const pages = parsePageRanges(options.pages || `1-${count}`, count)
  onProgress({ stage: 'encode', page: 0, total: pages.length })
  for (let i = 0; i < pages.length; i++) {
    const page = doc.getPage(pages[i] - 1)
    const { width, height } = page.getSize()
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0, 0, 0),
    })
    onProgress({ stage: 'encode', page: i + 1, total: pages.length })
  }
  const bytes = await doc.save({ useObjectStreams: true })
  const name = (file.name || 'redacted.pdf').replace(/\.pdf$/i, '') + '-redacted.pdf'
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: name, ext: 'pdf' }
}
