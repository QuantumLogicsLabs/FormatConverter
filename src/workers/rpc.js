/**
 * Hand-rolled postMessage RPC for the conversion worker.
 * Singleton module worker; falls back is handled by callers.
 */

let worker = null
let nextId = 1
const pending = new Map()

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./convert.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const { id, type, result, error, progress, code } = e.data || {}
    const entry = pending.get(id)
    if (!entry) return
    if (type === 'progress') {
      entry.onProgress?.(progress)
      return
    }
    pending.delete(id)
    if (type === 'error') {
      const err =
        code === 'ABORTED' || /abort/i.test(error || '')
          ? new DOMException(error || 'Conversion aborted.', 'AbortError')
          : new Error(error || 'Worker conversion failed.')
      entry.reject(err)
    } else entry.resolve(result)
  }
  worker.onerror = (err) => {
    for (const [, entry] of pending) {
      entry.reject(err instanceof Error ? err : new Error(String(err?.message || err)))
    }
    pending.clear()
    worker = null
  }
  return worker
}

/** Tear down the singleton (abort / OOM recovery). */
export function resetConvertWorker() {
  if (worker) {
    try {
      worker.terminate()
    } catch {
      /* ignore */
    }
    worker = null
  }
  for (const [, entry] of pending) {
    entry.reject(new DOMException('Conversion aborted.', 'AbortError'))
  }
  pending.clear()
}

/**
 * Run a conversion inside the module worker.
 * @param {{ buffer: ArrayBuffer, name: string, type: string, from: string, to: string, opts: object }} payload
 * @param {(p: object) => void} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ buffer: ArrayBuffer, type: string, ext: string }>}
 */
export function convertInWorker(payload, onProgress, signal) {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Conversion aborted.', 'AbortError'))
  }
  const w = ensureWorker()
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      pending.delete(id)
      try {
        w.postMessage({ id, method: 'abort' })
      } catch {
        /* ignore */
      }
      // Hard-stop: terminate frees memory from runaway work
      resetConvertWorker()
      reject(new DOMException('Conversion aborted.', 'AbortError'))
    }
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    pending.set(id, {
      resolve: (v) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      },
      reject: (e) => {
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
      onProgress,
    })
    w.postMessage({ id, method: 'convert', payload }, [payload.buffer])
  })
}
