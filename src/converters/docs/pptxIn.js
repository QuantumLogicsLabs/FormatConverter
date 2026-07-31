/**
 * PPTX → txt / md / pdf / png (text extraction best-effort; raster via canvas).
 */
import JSZip from 'jszip'

async function extractSlideTexts(file, onProgress) {
  const zip = await JSZip.loadAsync(file)
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = Number(/slide(\d+)/i.exec(a)?.[1] || 0)
      const nb = Number(/slide(\d+)/i.exec(b)?.[1] || 0)
      return na - nb
    })
  if (!names.length) throw new Error('Not a valid PPTX (no slides found).')

  const slides = []
  for (let i = 0; i < names.length; i++) {
    onProgress?.({ stage: 'extract', page: i + 1, total: names.length })
    const xml = await zip.file(names[i]).async('string')
    const bits = []
    const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi
    let m
    while ((m = re.exec(xml))) {
      const t = m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim()
      if (t) bits.push(t)
    }
    slides.push(bits.join(' ').trim() || `(Slide ${i + 1})`)
  }
  return slides
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

async function slideToPngBlob(text, index, total) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(`Slide ${index + 1}${total > 1 ? ` / ${total}` : ''}`, 64, 72)
  ctx.font = '28px sans-serif'
  const lines = wrapLines(ctx, text, canvas.width - 128)
  let y = 140
  for (const line of lines.slice(0, 16)) {
    ctx.fillText(line, 64, y)
    y += 40
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  })
  return blob
}

export default async function convertPptx(file, options = {}, onProgress = () => {}) {
  const { to } = options
  const slides = await extractSlideTexts(file, onProgress)
  onProgress({ stage: 'encode' })

  if (to === 'txt') {
    const text = slides.map((s, i) => `--- Slide ${i + 1} ---\n${s}`).join('\n\n') + '\n'
    return new Blob([text], { type: 'text/plain;charset=utf-8' })
  }
  if (to === 'md') {
    const text = slides.map((s, i) => `## Slide ${i + 1}\n\n${s}`).join('\n\n') + '\n'
    return new Blob([text], { type: 'text/markdown;charset=utf-8' })
  }
  if (to === 'pdf') {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 48
    const width = doc.internal.pageSize.getWidth() - margin * 2
    for (let i = 0; i < slides.length; i++) {
      if (i > 0) doc.addPage()
      doc.setFontSize(14)
      doc.text(`Slide ${i + 1}`, margin, margin)
      doc.setFontSize(11)
      const lines = doc.splitTextToSize(slides[i] || '', width)
      doc.text(lines, margin, margin + 24)
    }
    const buf = doc.output('arraybuffer')
    return new Blob([buf], { type: 'application/pdf' })
  }
  if (to === 'png') {
    if (slides.length === 1) {
      return slideToPngBlob(slides[0], 0, 1)
    }
    const zip = new JSZip()
    for (let i = 0; i < slides.length; i++) {
      onProgress({ stage: 'encode', page: i + 1, total: slides.length })
      const png = await slideToPngBlob(slides[i], i, slides.length)
      zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, png)
    }
    return zip.generateAsync({ type: 'blob' })
  }
  throw new Error(`Unsupported PPTX target "${to}".`)
}
