import { fetchFile } from '@ffmpeg/util'
import { runFFmpeg, assertAvFileSize, listEncoders, hasEncoder } from './engine.js'
import { AUDIO_OUT } from './audio.js'

async function assertWebmEncoder(onProgress) {
  const text = await listEncoders(onProgress)
  if (!hasEncoder(text, 'libvpx') && !hasEncoder(text, 'libvpx-vp9')) {
    throw new Error(
      'WebM output is not available in this conversion engine build (libvpx missing). Use MP4 instead.'
    )
  }
  return hasEncoder(text, 'libvpx-vp9') ? 'libvpx-vp9' : 'libvpx'
}

function videoFilterArgs(options = {}) {
  const width = Number(options.width) || 0
  if (width > 0) return ['-vf', `scale=${Math.round(width)}:-2`]
  return []
}

/** Video → mp4 / webm or audio extraction. */
export default async function convertVideo(file, options = {}, onProgress = () => {}) {
  const { from, to, signal, mute } = options
  assertAvFileSize(file)
  const inputName = `input.${from === 'mov' ? 'mov' : from === 'webm' ? 'webm' : from === 'gif' ? 'gif' : 'mp4'}`
  const inputData = await fetchFile(file)
  onProgress({ stage: 'encode' })
  const vf = videoFilterArgs(options)

  if (to === 'mp4') {
    const outputName = 'output.mp4'
    const args =
      from === 'gif'
        ? [
            '-i', inputName,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
            ...vf,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k',
            '-shortest', '-movflags', 'faststart',
            outputName,
          ]
        : [
            '-i', inputName,
            ...vf,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            ...(mute ? ['-an'] : ['-c:a', 'aac']),
            '-movflags', 'faststart',
            outputName,
          ]
    return runFFmpeg(args, {
      inputName,
      inputData,
      outputName,
      outputMime: 'video/mp4',
      signal,
    }, onProgress)
  }

  if (to === 'webm') {
    const vcodec = await assertWebmEncoder(onProgress)
    const outputName = 'output.webm'
    const args =
      from === 'gif'
        ? ['-i', inputName, ...vf, '-c:v', vcodec, '-b:v', '1M', '-an', outputName]
        : [
            '-i', inputName,
            ...vf,
            '-c:v', vcodec, '-b:v', '1M',
            ...(mute ? ['-an'] : ['-c:a', 'libvorbis']),
            outputName,
          ]
    return runFFmpeg(
      args,
      { inputName, inputData, outputName, outputMime: 'video/webm', signal },
      onProgress
    )
  }

  if (AUDIO_OUT[to]) {
    if (to === 'opus') {
      const text = await listEncoders(onProgress)
      if (!hasEncoder(text, 'libopus')) {
        throw new Error('Opus output is not available in this conversion engine build (libopus missing).')
      }
    }
    const spec = AUDIO_OUT[to]
    const outputName = `output.${spec.ext}`
    return runFFmpeg(spec.args(inputName, outputName), {
      inputName,
      inputData,
      outputName,
      outputMime: spec.mime,
      signal,
    }, onProgress)
  }

  throw new Error(`Unsupported video target "${to}".`)
}
