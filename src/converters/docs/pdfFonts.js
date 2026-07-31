/**
 * Lazy-load and register Noto Sans with a jsPDF document for Unicode text.
 * Latin Noto lives under /fonts/. CJK pack downloads on demand from jsDelivr
 * and is cached in memory for the session (and HTTP cache).
 */

const FONT_FILES = {
  normal: { file: 'NotoSans-Regular.ttf', vfs: 'NotoSans-Regular.ttf' },
  bold: { file: 'NotoSans-Bold.ttf', vfs: 'NotoSans-Bold.ttf' },
}

/** Subset-friendly SC regular from jsDelivr (first CJK PDF use). */
const CJK_URL =
  'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf'
const CJK_VFS = 'NotoSansSC-Regular.otf'

const cache = new Map()
const registered = new WeakSet()
const cjkRegistered = new WeakSet()

async function bufferToBinary(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return binary
}

async function fetchFont(file) {
  if (cache.has(file)) return cache.get(file)
  const res = await fetch(`/fonts/${file}`)
  if (!res.ok) throw new Error(`Font ${file} not found (${res.status})`)
  const binary = await bufferToBinary(await res.arrayBuffer())
  cache.set(file, binary)
  return binary
}

async function fetchCjkFont() {
  if (cache.has(CJK_VFS)) return cache.get(CJK_VFS)
  const res = await fetch(CJK_URL)
  if (!res.ok) throw new Error(`CJK font download failed (${res.status})`)
  const binary = await bufferToBinary(await res.arrayBuffer())
  cache.set(CJK_VFS, binary)
  return binary
}

/** Register NotoSans on this doc if not already. */
export async function ensureNotoFont(doc) {
  if (registered.has(doc)) return 'NotoSans'
  for (const [style, meta] of Object.entries(FONT_FILES)) {
    const binary = await fetchFont(meta.file)
    doc.addFileToVFS(meta.vfs, binary)
    doc.addFont(meta.vfs, 'NotoSans', style)
  }
  doc.addFont(FONT_FILES.normal.vfs, 'NotoSans', 'italic')
  doc.addFont(FONT_FILES.bold.vfs, 'NotoSans', 'bolditalic')
  registered.add(doc)
  return 'NotoSans'
}

/** Register Simplified Chinese Noto subset when CJK glyphs are present. */
export async function ensureCjkFont(doc) {
  if (cjkRegistered.has(doc)) return 'NotoSansSC'
  await ensureNotoFont(doc)
  const binary = await fetchCjkFont()
  doc.addFileToVFS(CJK_VFS, binary)
  doc.addFont(CJK_VFS, 'NotoSansSC', 'normal')
  doc.addFont(CJK_VFS, 'NotoSansSC', 'bold')
  doc.addFont(CJK_VFS, 'NotoSansSC', 'italic')
  doc.addFont(CJK_VFS, 'NotoSansSC', 'bolditalic')
  cjkRegistered.add(doc)
  return 'NotoSansSC'
}

/** True if text has chars outside Latin-1 that standard PDF fonts can't draw well. */
export function needsUnicodeFont(text) {
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0)
    if (code > 0xff) return true
  }
  return false
}

/** CJK Unified Ideographs + Hangul + Hiragana/Katakana ranges. */
export function needsCjkFont(text) {
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0)
    if (
      (code >= 0x3400 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      return true
    }
  }
  return false
}
