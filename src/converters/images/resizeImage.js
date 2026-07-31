import { decodeImage } from './decode.js'
import { encodeCanvas } from './encode.js'

/** Scale an image to a target width; height follows to keep aspect ratio. */
export default async function resizeImage(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an image to resize.')
  const to = options.to === 'jpg' ? 'jpg' : 'png'

  onProgress({ stage: 'decode' })
  const canvas = await decodeImage(file)
  const width = Math.max(1, Math.round(Number(options.width) || canvas.width))
  onProgress({ stage: 'encode' })
  const blob = await encodeCanvas(canvas, to, { ...options, width })
  const name = (file.name || 'image').replace(/\.[^.]+$/, '') + `-resized.${to}`
  return { blob, filename: name, ext: to }
}
