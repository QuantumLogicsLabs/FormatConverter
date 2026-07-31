import { PDFDocument } from 'pdf-lib'
import pdfjsLib from '../pdfjs.js'
import { FormatConvertError, ErrorCodes } from '../../lib/errors.js'

async function openEncrypted(bytes, password) {
  const task = pdfjsLib.getDocument({ data: bytes, password: password || undefined })
  try {
    return await task.promise
  } catch (e) {
    if (e?.name === 'PasswordException') {
      const message = password
        ? 'Incorrect password. Check it and try again.'
        : 'This PDF requires a password to open.'
      throw new FormatConvertError(ErrorCodes.ENCRYPT_PDF, message, { cause: e })
    }
    throw e
  }
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not render page for unlocking.'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

/**
 * Remove PDF encryption. pdf-lib can't parse encrypted PDFs, so pages are
 * decoded with pdf.js (which supports the password) and rebuilt as a new,
 * unencrypted PDF from page-image snapshots — a lossy but reliable unlock.
 */
export default async function unlockPdf(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose a PDF to unlock.')
  const bytes = new Uint8Array(await file.arrayBuffer())

  onProgress({ stage: 'decode' })
  const pdf = await openEncrypted(bytes, options.password)

  const scale = 2
  const out = await PDFDocument.create()
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress({ stage: 'render', page: i, total: pdf.numPages })
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    onProgress({ stage: 'encode', page: i, total: pdf.numPages })
    const pngBytes = await canvasToPngBytes(canvas)
    const embedded = await out.embedPng(pngBytes)
    const outPage = out.addPage([canvas.width, canvas.height])
    outPage.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height })
  }

  const outBytes = await out.save({ useObjectStreams: true })
  const name = (file.name || 'document').replace(/\.pdf$/i, '') + '-unlocked.pdf'
  return { blob: new Blob([outBytes], { type: 'application/pdf' }), filename: name, ext: 'pdf' }
}
