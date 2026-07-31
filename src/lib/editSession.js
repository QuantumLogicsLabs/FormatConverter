/**
 * In-memory + sessionStorage edit session for Review & Edit.
 * Blobs cannot live in storage — only small IR drafts (text / table JSON).
 */

const LAST_KEY = 'fc-last-review-meta'
const DRAFT_PREFIX = 'fc-edit-draft:'
const MAX_DRAFT_CHARS = 400_000

/** @type {null | {
 *   from: string,
 *   to: string,
 *   filename: string,
 *   sourceName: string,
 *   at: number,
 * }} */
let lastMeta = null

/** @type {null | {
 *   from: string,
 *   to: string,
 *   sourceFile: File|Blob,
 *   result: { blob: Blob, filename: string, from: string, to: string },
 *   options: object,
 *   ir: { type: string, value: any },
 * }} */
let liveSession = null

export function setLiveSession(session) {
  liveSession = session
  lastMeta = {
    from: session.from,
    to: session.to,
    filename: session.result?.filename || '',
    sourceName: session.sourceFile?.name || '',
    at: Date.now(),
  }
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(lastMeta))
  } catch {
    /* ignore */
  }
}

export function getLiveSession() {
  return liveSession
}

export function clearLiveSession() {
  liveSession = null
}

export function getLastReviewMeta() {
  if (lastMeta) return lastMeta
  try {
    const raw = JSON.parse(sessionStorage.getItem(LAST_KEY) || 'null')
    if (raw?.from && raw?.to) {
      lastMeta = raw
      return raw
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveTextDraft(from, to, text) {
  if (typeof text !== 'string' || text.length > MAX_DRAFT_CHARS) return
  try {
    sessionStorage.setItem(`${DRAFT_PREFIX}${from}-to-${to}`, text)
  } catch {
    /* ignore */
  }
}

export function loadTextDraft(from, to) {
  try {
    return sessionStorage.getItem(`${DRAFT_PREFIX}${from}-to-${to}`)
  } catch {
    return null
  }
}

export function saveTableDraft(from, to, table) {
  try {
    const json = JSON.stringify(table)
    if (json.length > MAX_DRAFT_CHARS) return
    sessionStorage.setItem(`${DRAFT_PREFIX}table:${from}-to-${to}`, json)
  } catch {
    /* ignore */
  }
}

export function loadTableDraft(from, to) {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_PREFIX}table:${from}-to-${to}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
