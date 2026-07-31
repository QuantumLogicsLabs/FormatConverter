/**
 * AV size limits + load-source flag — kept free of @ffmpeg imports
 * so the SDK facade does not pull the engine until a media convert runs.
 */
import { FormatConvertError, ErrorCodes } from '../../lib/errors.js'

const AV_SOFT_BYTES = 100 * 1024 * 1024
const AV_HARD_BYTES = 600 * 1024 * 1024

/** @type {'network'|'cache'|null} */
let lastLoadSource = null

export function getLastFFmpegLoadSource() {
  return lastLoadSource
}

export function setLastFFmpegLoadSource(source) {
  lastLoadSource = source
}

export function assertAvFileSize(file) {
  const size = file?.size || 0
  if (size > AV_HARD_BYTES) {
    throw new FormatConvertError(
      ErrorCodes.TOO_LARGE,
      'This media file is larger than 600 MB. Browser memory limits make conversion unreliable — please use a smaller file.'
    )
  }
  return size > AV_SOFT_BYTES
}
