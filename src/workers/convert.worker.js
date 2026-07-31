/**
 * Module worker that runs DOM-free converters off the main thread.
 * Uses the lean WORKER_LOADERS map — never the full registry.
 */
import { WORKER_LOADERS, workerLoaderKey } from './loaders.js'

const DEFAULT_EXT = {
  md: 'md',
  html: 'html',
  txt: 'txt',
  csv: 'csv',
  tsv: 'tsv',
  json: 'json',
  yaml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  epub: 'epub',
  srt: 'srt',
  vtt: 'vtt',
  ass: 'ass',
  ssa: 'ssa',
}

/** @type {Map<number, AbortController>} */
const inflight = new Map()

self.onmessage = async (e) => {
  const { id, method, payload } = e.data || {}

  if (method === 'abort') {
    const ac = inflight.get(id)
    if (ac) ac.abort()
    inflight.delete(id)
    return
  }

  if (method !== 'convert' || !payload) return

  const ac = new AbortController()
  inflight.set(id, ac)

  try {
    if (ac.signal.aborted) throw new DOMException('Conversion aborted.', 'AbortError')
    const { buffer, name, type, from, to, opts } = payload
    const load = WORKER_LOADERS[workerLoaderKey(from, to)]
    if (!load) throw new Error(`Worker cannot run ${from} → ${to}.`)

    const file = new File([buffer], name || 'input', { type: type || 'application/octet-stream' })
    const mod = await load()
    if (ac.signal.aborted) throw new DOMException('Conversion aborted.', 'AbortError')
    const onProgress = (p = {}) => {
      if (ac.signal.aborted) return
      self.postMessage({ id, type: 'progress', progress: p })
    }
    const result = await mod.default(file, { ...opts, from, to, signal: ac.signal }, onProgress)
    if (ac.signal.aborted) throw new DOMException('Conversion aborted.', 'AbortError')

    const blob = result instanceof Blob ? result : result.blob
    const ext = result instanceof Blob ? (DEFAULT_EXT[to] || to) : result.ext
    const outBuf = await blob.arrayBuffer()
    self.postMessage(
      { id, type: 'result', result: { buffer: outBuf, type: blob.type, ext } },
      [outBuf]
    )
  } catch (err) {
    const aborted = ac.signal.aborted || err?.name === 'AbortError'
    self.postMessage({
      id,
      type: 'error',
      error: aborted ? 'Conversion aborted.' : err?.message || String(err),
      code: aborted ? 'ABORTED' : undefined,
    })
  } finally {
    inflight.delete(id)
  }
}
