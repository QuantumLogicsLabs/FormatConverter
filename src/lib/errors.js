/**
 * Typed conversion / tool errors with stable codes for UI + SDK.
 */

export const ErrorCodes = {
  UNSUPPORTED_PAIR: 'UNSUPPORTED_PAIR',
  DETECT_FAILED: 'DETECT_FAILED',
  TOO_LARGE: 'TOO_LARGE',
  OOM: 'OOM',
  ABORTED: 'ABORTED',
  ENGINE_MISSING: 'ENGINE_MISSING',
  PARSE_FAILED: 'PARSE_FAILED',
  ENCRYPT_PDF: 'ENCRYPT_PDF',
  UNKNOWN: 'UNKNOWN',
}

const COPY = {
  [ErrorCodes.UNSUPPORTED_PAIR]: {
    title: 'Conversion not supported',
    hint: 'Pick a different target format from the list on this page.',
  },
  [ErrorCodes.DETECT_FAILED]: {
    title: 'Could not detect the file format',
    hint: 'Rename the file with the correct extension, or open a converter and force the source format.',
  },
  [ErrorCodes.TOO_LARGE]: {
    title: 'File is too large for the browser',
    hint: 'Try a smaller file, fewer pages, or a lower quality/scale setting.',
  },
  [ErrorCodes.OOM]: {
    title: 'Ran out of memory',
    hint: 'Close other tabs, use a smaller file, or convert fewer pages at once.',
  },
  [ErrorCodes.ABORTED]: {
    title: 'Conversion cancelled',
    hint: 'Start again when you are ready.',
  },
  [ErrorCodes.ENGINE_MISSING]: {
    title: 'Conversion engine unavailable',
    hint: 'Check your network, then retry. Media engines download once and cache locally.',
  },
  [ErrorCodes.PARSE_FAILED]: {
    title: 'Could not read this file',
    hint: 'The file may be corrupted, encrypted, or not the format we detected.',
  },
  [ErrorCodes.ENCRYPT_PDF]: {
    title: 'This PDF is password-protected',
    hint: 'Use the Unlock PDF tool with the correct password, then try again.',
  },
  [ErrorCodes.UNKNOWN]: {
    title: 'Something went wrong',
    hint: 'Try again. If it keeps failing, use a smaller or simpler file.',
  },
}

export class FormatConvertError extends Error {
  constructor(code, message, { cause, hint } = {}) {
    super(message || COPY[code]?.title || 'Error')
    this.name = 'FormatConvertError'
    this.code = code || ErrorCodes.UNKNOWN
    this.hint = hint || COPY[this.code]?.hint || ''
    if (cause) this.cause = cause
  }
}

export function isOomMessage(msg = '') {
  return /memory|oom|out of memory/i.test(String(msg))
}

export function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === ErrorCodes.ABORTED
}

/** Map an unknown thrown value into a FormatConvertError. */
export function toFormatConvertError(err) {
  if (err instanceof FormatConvertError) return err
  if (isAbortError(err)) {
    return new FormatConvertError(ErrorCodes.ABORTED, COPY[ErrorCodes.ABORTED].title, { cause: err })
  }
  const msg = err?.message || String(err || 'Unknown error')
  if (isOomMessage(msg)) {
    return new FormatConvertError(ErrorCodes.OOM, COPY[ErrorCodes.OOM].title, { cause: err })
  }
  if (/password|PasswordException|No password given/i.test(msg) || err?.name === 'PasswordException') {
    return new FormatConvertError(ErrorCodes.ENCRYPT_PDF, msg, { cause: err })
  }
  if (/600 MB|too large|larger than/i.test(msg)) {
    return new FormatConvertError(ErrorCodes.TOO_LARGE, msg, { cause: err })
  }
  if (/not supported/i.test(msg)) {
    return new FormatConvertError(ErrorCodes.UNSUPPORTED_PAIR, msg, { cause: err })
  }
  if (/detect|unknown target|already /i.test(msg)) {
    return new FormatConvertError(ErrorCodes.DETECT_FAILED, msg, { cause: err })
  }
  if (/engine|ffmpeg|libvpx|could not load/i.test(msg)) {
    return new FormatConvertError(ErrorCodes.ENGINE_MISSING, msg, { cause: err })
  }
  if (/invalid|corrupt|encrypt|parse|could not read/i.test(msg)) {
    return new FormatConvertError(ErrorCodes.PARSE_FAILED, msg, { cause: err })
  }
  return new FormatConvertError(ErrorCodes.UNKNOWN, msg, { cause: err })
}

export function userFacingMessage(err) {
  const e = toFormatConvertError(err)
  return e.hint ? `${e.message} ${e.hint}` : e.message
}
