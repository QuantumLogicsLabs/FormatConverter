import { fetchFile } from '@ffmpeg/util'
import { runFFmpeg, assertAvFileSize } from '../av/engine.js'

const KNOWN_CONTAINERS = new Set(['mp4', 'webm', 'mov'])

export default async function trimVideo(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose a video file to trim.')
  assertAvFileSize(file)
  const start = Math.max(0, Number(options.start) || 0)
  const duration = Math.max(0.1, Number(options.duration) || 5)
  const rawExt = (file.name || 'v.mp4').split('.').pop()?.toLowerCase() || 'mp4'
  const ext = KNOWN_CONTAINERS.has(rawExt) ? rawExt : 'mp4'
  const inputName = `input.${ext}`
  const outputName = `output.${ext}`
  const inputData = await fetchFile(file)
  onProgress({ stage: 'encode' })
  const blob = await runFFmpeg(
    ['-ss', String(start), '-t', String(duration), '-i', inputName, '-c', 'copy', outputName],
    {
      inputName,
      inputData,
      outputName,
      outputMime: file.type || 'video/mp4',
      signal: options.signal,
    },
    onProgress
  )
  const name = (file.name || 'trimmed').replace(/\.[^.]+$/, '') + `-trim.${ext}`
  return { blob, filename: name, ext }
}
