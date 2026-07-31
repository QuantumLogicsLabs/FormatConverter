import { decodeImage } from './decode.js'
import { encodeCanvas } from './encode.js'

/** Crop image by pixel box (x,y,width,height). */
export default async function cropImage(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an image to crop.')
  onProgress({ stage: 'decode' })
  const canvas = await decodeImage(file)
  const x = Math.max(0, Number(options.x) || 0)
  const y = Math.max(0, Number(options.y) || 0)
  const width = Math.min(canvas.width - x, Number(options.width) || canvas.width)
  const height = Math.min(canvas.height - y, Number(options.height) || canvas.height)
  if (width < 1 || height < 1) throw new Error('Crop region is empty.')
  const out = document.createElement('canvas')
  out.width = Math.round(width)
  out.height = Math.round(height)
  out.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, out.width, out.height)
  onProgress({ stage: 'encode' })
  const to = options.to || 'png'
  const blob = await encodeCanvas(out, to, options)
  const name = (file.name || 'cropped').replace(/\.[^.]+$/, '') + `-cropped.${to === 'jpg' ? 'jpg' : to}`
  return { blob, filename: name, ext: to === 'jpg' ? 'jpg' : to }
}
