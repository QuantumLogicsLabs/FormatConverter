import { useCallback, useEffect, useRef, useState } from 'react'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import pdfjsLib from '../../converters/pdfjs.js'

const THUMB_WIDTH = 150

let opSeq = 0
const nextOpId = () => `op${++opSeq}`

async function loadPdfLib(bytes) {
  try {
    return await PDFDocument.load(bytes)
  } catch (e) {
    const msg = e?.message || String(e)
    if (/encrypt|password|encrypted/i.test(msg)) {
      throw new Error('This PDF is password-protected. Unlock it first, then edit.')
    }
    throw new Error(`Could not read PDF: ${msg}`)
  }
}

async function renderThumbnails(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
  const thumbs = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = THUMB_WIDTH / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    thumbs.push({ page: i, dataUrl: canvas.toDataURL('image/png') })
  }
  return thumbs
}

function describeOp(op) {
  switch (op.type) {
    case 'text':
      return `Add text "${op.text}" on page ${op.page} at (${op.x}, ${op.y})`
    case 'redact':
      return `Redact rectangle on page ${op.page} at (${op.x}, ${op.y}) ${op.w}×${op.h}`
    case 'rotate':
      return `Rotate page ${op.page} +90°`
    case 'delete':
      return `Delete page ${op.page}`
    default:
      return 'Edit'
  }
}

/**
 * Best-effort client-only PDF page editor: thumbnails from pdf.js, edits
 * queued and applied as vector ops (pdf-lib) — text draw, redact rectangle,
 * page rotate/delete. Apply rebuilds from the original bytes each time.
 */
export default function PdfOutputEditor({ blob, filename, onChange, onBusy }) {
  const [thumbs, setThumbs] = useState([])
  const [ops, setOps] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [textForm, setTextForm] = useState({ page: 1, text: '', x: 72, y: 72 })
  const [redactForm, setRedactForm] = useState({ page: 1, x: 72, y: 72, w: 120, h: 40 })
  const bytesRef = useRef(null)

  const setBusyBoth = useCallback(
    (v) => {
      setBusy(v)
      onBusy?.(v)
    },
    [onBusy]
  )

  useEffect(() => {
    let cancelled = false
    if (!blob) return undefined
    setBusyBoth(true)
    setError('')
    ;(async () => {
      try {
        const buf = new Uint8Array(await blob.arrayBuffer())
        if (cancelled) return
        bytesRef.current = buf
        const thumbnails = await renderThumbnails(buf)
        if (cancelled) return
        setThumbs(thumbnails)
        setOps([])
        setTextForm((f) => ({ ...f, page: 1 }))
        setRedactForm((f) => ({ ...f, page: 1 }))
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e))
      } finally {
        if (!cancelled) setBusyBoth(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blob, setBusyBoth])

  const addOp = (op) => {
    setOps((prev) => [...prev, { id: nextOpId(), ...op }])
    setError('')
  }
  const removeOp = (id) => setOps((prev) => prev.filter((o) => o.id !== id))

  const pageCount = thumbs.length
  const pendingDeletes = new Set(ops.filter((o) => o.type === 'delete').map((o) => o.page))
  const rotationFor = (page) =>
    ops.filter((o) => o.type === 'rotate' && o.page === page).length * 90

  const apply = async () => {
    if (!ops.length || !bytesRef.current) return
    setBusyBoth(true)
    setError('')
    try {
      const doc = await loadPdfLib(bytesRef.current.slice(0))
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const toDelete = new Set()

      for (const op of ops) {
        if (op.type === 'delete') {
          toDelete.add(op.page - 1)
          continue
        }
        const idx = op.page - 1
        if (idx < 0 || idx >= doc.getPageCount()) continue
        const page = doc.getPage(idx)
        if (op.type === 'text') {
          page.drawText(String(op.text ?? ''), {
            x: Number(op.x) || 0,
            y: Number(op.y) || 0,
            size: 14,
            font,
            color: rgb(0, 0, 0),
          })
        } else if (op.type === 'redact') {
          page.drawRectangle({
            x: Number(op.x) || 0,
            y: Number(op.y) || 0,
            width: Number(op.w) || 0,
            height: Number(op.h) || 0,
            color: rgb(0, 0, 0),
          })
        } else if (op.type === 'rotate') {
          const current = page.getRotation().angle || 0
          page.setRotation(degrees((current + 90) % 360))
        }
      }

      for (const idx of [...toDelete].sort((a, b) => b - a)) {
        if (idx >= 0 && idx < doc.getPageCount()) doc.removePage(idx)
      }
      if (doc.getPageCount() === 0) {
        throw new Error('Cannot delete every page — at least one page must remain.')
      }

      const outBytes = await doc.save({ useObjectStreams: true })
      onChange?.(new Blob([outBytes], { type: 'application/pdf' }))
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusyBoth(false)
    }
  }

  return (
    <div className="editor-pane pdf-output-editor" data-editor="output-pdf" data-testid="pdf-output-editor">
      <div className="editor-pane-head">
        <span className="meta">Edit PDF{filename ? ` · ${filename}` : ''}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !ops.length}
          onClick={apply}
        >
          {busy ? 'Applying…' : `Apply ${ops.length ? `(${ops.length})` : ''}`.trim()}
        </button>
      </div>
      <p className="meta">Best-effort PDF edit — layout may differ from desktop apps.</p>
      {error && <p className="error">{error}</p>}

      <div className="pdf-thumb-grid">
        {thumbs.map((t) => (
          <div
            key={t.page}
            className={`pdf-thumb${pendingDeletes.has(t.page) ? ' pdf-thumb-deleting' : ''}`}
          >
            <img
              src={t.dataUrl}
              alt={`Page ${t.page}`}
              className="pdf-thumb-img"
              style={rotationFor(t.page) ? { transform: `rotate(${rotationFor(t.page)}deg)` } : undefined}
            />
            <div className="pdf-thumb-actions">
              <span className="meta">
                Page {t.page}
                {pendingDeletes.has(t.page) ? ' (delete pending)' : ''}
                {rotationFor(t.page) ? ` (+${rotationFor(t.page)}°)` : ''}
              </span>
              <button type="button" className="btn btn-icon" onClick={() => addOp({ type: 'rotate', page: t.page })}>
                Rotate 90°
              </button>
              <button
                type="button"
                className="btn btn-icon"
                disabled={pendingDeletes.has(t.page)}
                onClick={() => addOp({ type: 'delete', page: t.page })}
              >
                Delete page
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="editor-controls pdf-tools">
        <div className="option">
          <span className="option-label">Add text</span>
          <input
            type="number"
            min={1}
            max={pageCount || 1}
            value={textForm.page}
            aria-label="Text page"
            onChange={(e) => setTextForm((f) => ({ ...f, page: Number(e.target.value) || 1 }))}
          />
          <input
            type="text"
            placeholder="Text to add"
            value={textForm.text}
            aria-label="Text to add"
            onChange={(e) => setTextForm((f) => ({ ...f, text: e.target.value }))}
          />
          <input
            type="number"
            value={textForm.x}
            aria-label="Text x"
            onChange={(e) => setTextForm((f) => ({ ...f, x: Number(e.target.value) || 0 }))}
          />
          <input
            type="number"
            value={textForm.y}
            aria-label="Text y"
            onChange={(e) => setTextForm((f) => ({ ...f, y: Number(e.target.value) || 0 }))}
          />
          <button
            type="button"
            className="btn"
            disabled={!textForm.text.trim() || !pageCount}
            onClick={() => addOp({ type: 'text', ...textForm })}
          >
            Add
          </button>
        </div>
        <p className="option-help">Page 1–{pageCount || 1}, x/y in PDF points from the bottom-left corner.</p>

        <div className="option">
          <span className="option-label">Redact rectangle</span>
          <input
            type="number"
            min={1}
            max={pageCount || 1}
            value={redactForm.page}
            aria-label="Redact page"
            onChange={(e) => setRedactForm((f) => ({ ...f, page: Number(e.target.value) || 1 }))}
          />
          <input
            type="number"
            value={redactForm.x}
            aria-label="Redact x"
            onChange={(e) => setRedactForm((f) => ({ ...f, x: Number(e.target.value) || 0 }))}
          />
          <input
            type="number"
            value={redactForm.y}
            aria-label="Redact y"
            onChange={(e) => setRedactForm((f) => ({ ...f, y: Number(e.target.value) || 0 }))}
          />
          <input
            type="number"
            value={redactForm.w}
            aria-label="Redact width"
            onChange={(e) => setRedactForm((f) => ({ ...f, w: Number(e.target.value) || 0 }))}
          />
          <input
            type="number"
            value={redactForm.h}
            aria-label="Redact height"
            onChange={(e) => setRedactForm((f) => ({ ...f, h: Number(e.target.value) || 0 }))}
          />
          <button
            type="button"
            className="btn"
            disabled={!pageCount || !redactForm.w || !redactForm.h}
            onClick={() => addOp({ type: 'redact', ...redactForm })}
          >
            Add
          </button>
        </div>
      </div>

      {ops.length > 0 && (
        <ul className="pdf-ops-list">
          {ops.map((op) => (
            <li key={op.id}>
              <span>{describeOp(op)}</span>
              <button type="button" className="btn-link" onClick={() => removeOp(op.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
