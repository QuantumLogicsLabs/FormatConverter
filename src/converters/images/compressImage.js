import { decodeImage } from './decode.js'
import { encodeCanvas } from './encode.js'

/** Re-encode a photo as JPEG or WebP at a lower quality to shrink file size. */
export default async function compressImage(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an image to compress.')
  const to = options.to === 'webp' ? 'webp' : 'jpg'
  const quality = Math.min(1, Math.max(0.1, Number(options.quality ?? 0.7)))

  onProgress({ stage: 'decode' })
  const canvas = await decodeImage(file)
  onProgress({ stage: 'encode' })
  const blob = await encodeCanvas(canvas, to, { ...options, quality, background: options.background || '#ffffff' })
  const name = (file.name || 'image').replace(/\.[^.]+$/, '') + `-compressed.${to}`
  return { blob, filename: name, ext: to }
}
