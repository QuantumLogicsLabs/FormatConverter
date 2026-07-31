import { decodeImage } from './decode.js'
import { encodeCanvas } from './encode.js'

/** Rotate image 90/180/270. */
export default async function rotateImage(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an image to rotate.')
  const angle = Number(options.angle) || 90
  if (![90, 180, 270].includes(angle)) throw new Error('Angle must be 90, 180, or 270.')
  onProgress({ stage: 'decode' })
  const canvas = await decodeImage(file)
  const out = document.createElement('canvas')
  if (angle === 180) {
    out.width = canvas.width
    out.height = canvas.height
  } else {
    out.width = canvas.height
    out.height = canvas.width
  }
  const ctx = out.getContext('2d')
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  onProgress({ stage: 'encode' })
  const to = options.to || 'png'
  const blob = await encodeCanvas(out, to, options)
  const name = (file.name || 'rotated').replace(/\.[^.]+$/, '') + `-rotated.${to === 'jpg' ? 'jpg' : to}`
  return { blob, filename: name, ext: to === 'jpg' ? 'jpg' : to }
}
