import { fetchFile } from '@ffmpeg/util'
import { runFFmpeg, assertAvFileSize } from '../av/engine.js'

export default async function normalizeAudio(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose an audio file to normalize.')
  assertAvFileSize(file)
  const ext = (file.name || 'a.mp3').split('.').pop() || 'mp3'
  const inputName = `input.${ext}`
  const outputName = 'output.mp3'
  const inputData = await fetchFile(file)
  onProgress({ stage: 'encode' })
  const blob = await runFFmpeg(
    ['-i', inputName, '-filter:a', 'loudnorm', '-c:a', 'libmp3lame', '-q:a', '2', outputName],
    {
      inputName,
      inputData,
      outputName,
      outputMime: 'audio/mpeg',
      signal: options.signal,
    },
    onProgress
  )
  const name = (file.name || 'normalized').replace(/\.[^.]+$/, '') + '-normalized.mp3'
  return { blob, filename: name, ext: 'mp3' }
}
