import { decodeImage } from '../images/decode.js'
import { detectFormat } from '../detect.js'
import { renderPdfPages } from '../pdfRender.js'
import { ocrCanvases } from './ocr.js'

const IMAGE_FORMATS = new Set(['png', 'jpg', 'webp', 'bmp', 'gif', 'heic', 'tiff', 'avif'])

/** OCR one or more images and/or PDFs into a single text file. */
export default async function ocrPages(files, options = {}, onProgress = () => {}) {
  if (!files?.length) throw new Error('Add at least one image or PDF to OCR.')

  const canvases = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress({ stage: 'decode', page: i + 1, total: files.length, file, fileIndex: i, fileCount: files.length })
    const format = await detectFormat(file)
    if (format === 'pdf') {
      canvases.push(...(await renderPdfPages(file, 2, onProgress)))
    } else if (IMAGE_FORMATS.has(format)) {
      canvases.push(await decodeImage(file, format))
    } else {
      throw new Error(`Cannot OCR "${format || 'this file'}" — use images or PDFs.`)
    }
  }

  const texts = await ocrCanvases(canvases, options, onProgress)
  const text = texts.filter(Boolean).join('\n\n--- Page Break ---\n\n')
  if (!text) throw new Error('No readable text was found.')
  return new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' })
}
