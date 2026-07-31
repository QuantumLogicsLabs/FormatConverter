/**
 * Registry-first editor profiles for Review & Edit.
 * Determines which IR / output editors a from→to pair supports.
 */
import { FORMATS } from '../converters/registry.js'

const TEXT_LIKE = new Set([
  'txt', 'md', 'html', 'rtf', 'json', 'yaml', 'toml', 'ini', 'xml', 'jsonl',
  'csv', 'tsv', 'srt', 'vtt', 'ass', 'ssa',
])

const IMAGE_LIKE = new Set([
  'png', 'jpg', 'webp', 'bmp', 'gif', 'tiff', 'avif', 'ico', 'svg', 'heic',
])

const TABLE_LIKE = new Set(['csv', 'tsv', 'xlsx', 'xls', 'ods', 'json', 'jsonl'])

const SOURCE_TEXT_IN = new Set(['txt', 'md', 'html', 'rtf'])

/**
 * @returns {{
 *   profile: string,
 *   sourceModes: Array<'text'|'table'|'image'>,
 *   outputModes: Array<'text'|'pdf'|'image'|'none'>,
 *   defaultMode: 'source'|'output'|'preview',
 *   editable: boolean,
 *   label: string,
 * }}
 */
export function getEditorProfile(from, to) {
  const fromMeta = FORMATS[from]
  const toMeta = FORMATS[to]
  const fromKind = fromMeta?.kind
  const toKind = toMeta?.kind

  if (fromKind === 'audio' || fromKind === 'video' || toKind === 'audio' || toKind === 'video') {
    return {
      profile: 'binary-av',
      sourceModes: [],
      outputModes: ['none'],
      defaultMode: 'preview',
      editable: false,
      label: 'Preview only — media edits use Tools (trim / normalize).',
    }
  }

  if (to === 'zip' || from === 'zip') {
    return {
      profile: 'binary',
      sourceModes: [],
      outputModes: ['none'],
      defaultMode: 'preview',
      editable: false,
      label: 'Preview only for archives.',
    }
  }

  const sourceModes = []
  const outputModes = []

  // Source / IR
  if (SOURCE_TEXT_IN.has(from) || (TEXT_LIKE.has(from) && fromKind !== 'image')) {
    if (TABLE_LIKE.has(from) && (from === 'csv' || from === 'tsv' || from === 'json' || from === 'jsonl')) {
      sourceModes.push('table')
    } else if (!IMAGE_LIKE.has(from)) {
      sourceModes.push('text')
    }
  }
  if (IMAGE_LIKE.has(from) && IMAGE_LIKE.has(to)) {
    sourceModes.push('image')
  }
  if (TABLE_LIKE.has(from) && !sourceModes.includes('table') && toKind === 'data') {
    sourceModes.push('table')
  }

  // Output
  if (to === 'pdf') outputModes.push('pdf')
  if (TEXT_LIKE.has(to) || toMeta?.mime?.startsWith('text/') || to === 'json') {
    outputModes.push('text')
  }
  if (IMAGE_LIKE.has(to) && to !== 'svg' && to !== 'ico' && to !== 'heic') {
    outputModes.push('image')
  }

  if (!sourceModes.length && !outputModes.length) {
    return {
      profile: 'preview-only',
      sourceModes: [],
      outputModes: ['none'],
      defaultMode: 'preview',
      editable: false,
      label: 'Download ready — this format is preview-only in Review.',
    }
  }

  const hasSource = sourceModes.length > 0
  const hasOutput = outputModes.some((m) => m !== 'none')
  let defaultMode = 'preview'
  try {
    const saved = localStorage.getItem(`fc-edit-mode:${from}-to-${to}`)
    if (saved === 'source' || saved === 'output' || saved === 'preview') defaultMode = saved
    else if (hasSource) defaultMode = 'source'
    else if (hasOutput) defaultMode = 'output'
  } catch {
    defaultMode = hasSource ? 'source' : hasOutput ? 'output' : 'preview'
  }

  return {
    profile: hasSource && hasOutput ? 'dual' : hasSource ? 'source-only' : 'output-only',
    sourceModes,
    outputModes: outputModes.length ? outputModes : ['none'],
    defaultMode,
    editable: true,
    label: hasSource && hasOutput
      ? 'Edit the source (live re-convert) or tweak the output, then download.'
      : hasSource
        ? 'Edit the source and Apply to refresh the preview, then download.'
        : 'Edit the converted output (best-effort), then download.',
  }
}

export function rememberEditMode(from, to, mode) {
  try {
    localStorage.setItem(`fc-edit-mode:${from}-to-${to}`, mode)
  } catch {
    /* ignore */
  }
}

export function isTextLikeFormat(id) {
  return TEXT_LIKE.has(id)
}
