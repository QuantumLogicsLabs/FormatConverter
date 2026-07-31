import { encodeBmp } from './bmp.js'
import { encodeIco } from './ico.js'

const CANVAS_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const NO_ALPHA = new Set(['jpg', 'bmp'])

/** Optionally resize, and flatten transparency for formats without alpha. */
export function prepareCanvas(canvas, { width, background = '#ffffff', flatten = false } = {}) {
  const targetW = width ? Math.round(Number(width)) : canvas.width
  const targetH = width
    ? Math.max(1, Math.round(canvas.height * (targetW / canvas.width)))
    : canvas.height

  if (targetW === canvas.width && !flatten) return canvas

  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (flatten) {
    ctx.fillStyle = background || '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
  }
  ctx.drawImage(canvas, 0, 0, targetW, targetH)
  return out
}

/**
 * Best-effort raster → SVG: no vector tracing, just an <svg> wrapping an
 * embedded PNG data URL so the file opens correctly anywhere SVG is expected.
 */
function encodeSvg(canvas) {
  const dataUrl = canvas.toDataURL('image/png')
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">\n` +
    `  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}" href="${dataUrl}"/>\n` +
    `</svg>\n`
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

export async function encodeCanvas(canvas, to, options = {}) {
  const prepared = prepareCanvas(canvas, {
    width: options.width,
    background: options.background,
    flatten: NO_ALPHA.has(to),
  })

  if (to === 'bmp') return encodeBmp(prepared)
  if (to === 'ico') return encodeIco(prepared, options.sizes)
  if (to === 'gif') {
    const { encodeGif } = await import('./gifEncode.js')
    return encodeGif(prepared, options)
  }
  if (to === 'tiff') {
    const { encodeTiff } = await import('./tiff.js')
    return encodeTiff(prepared, options)
  }
  if (to === 'avif') {
    const { encodeAvifFile } = await import('./avif.js')
    return encodeAvifFile(prepared, options)
  }
  if (to === 'svg') return encodeSvg(prepared)

  const mime = CANVAS_MIME[to]
  if (!mime) throw new Error(`Cannot encode to ${to} in the browser.`)
  const quality = to === 'png' ? undefined : Number(options.quality ?? 0.92)

  return new Promise((resolve, reject) => {
    prepared.toBlob(
      (blob) => {
        if (blob && blob.type === mime) resolve(blob)
        else if (blob) reject(new Error(`Your browser cannot encode ${to.toUpperCase()} images.`))
        else reject(new Error(`Encoding to ${to.toUpperCase()} failed.`))
      },
      mime,
      quality
    )
  })
}
