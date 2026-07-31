import { fetchFile } from '@ffmpeg/util'
import { runFFmpeg, assertAvFileSize } from '../av/engine.js'

export default async function trimAudio(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an audio file to trim.')
  assertAvFileSize(file)
  const start = Math.max(0, Number(options.start) || 0)
  const duration = Math.max(0.1, Number(options.duration) || 5)
  const ext = (file.name || 'a.mp3').split('.').pop() || 'mp3'
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
      outputMime: file.type || 'audio/mpeg',
      signal: options.signal,
    },
    onProgress
  )
  const name = (file.name || 'trimmed').replace(/\.[^.]+$/, '') + `-trim.${ext}`
  return { blob, filename: name, ext }
}
