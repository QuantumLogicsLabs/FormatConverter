import { useState } from 'react'
import { runTool } from '../../converters/index.js'

/** Image source IR ops: rotate / resize then re-encode via tools. */
export default function ImageSourceEditor({ file, to = 'png', onApply, applying = false }) {
  const [width, setWidth] = useState(0)
  const [angle, setAngle] = useState(90)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (toolId, options) => {
    setBusy(true)
    setError('')
    try {
      const out = await runTool(toolId, [file], { ...options, to })
      onApply?.(out.blob)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="editor-pane image-source-editor" data-editor="source-image">
      <div className="editor-pane-head">
        <span className="meta">Image adjustments (re-encode)</span>
      </div>
      <div className="editor-controls">
        <label className="option">
          <span className="option-label">Rotate</span>
          <select value={angle} onChange={(e) => setAngle(Number(e.target.value))}>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
          <button
            type="button"
            className="btn"
            disabled={busy || applying}
            onClick={() => run('rotate-image', { angle })}
          >
            Apply rotate
          </button>
        </label>
        <label className="option">
          <span className="option-label">Width (px)</span>
          <input
            type="number"
            min={1}
            max={4096}
            value={width || ''}
            placeholder="original"
            onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : 0)}
          />
          <button
            type="button"
            className="btn"
            disabled={busy || applying || !width}
            onClick={() => run('resize-image', { width, to })}
          >
            Apply resize
          </button>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="meta">Ops run locally with the same image tools as /tools.</p>
    </div>
  )
}
