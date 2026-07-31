import { useEffect, useRef, useState } from 'react'

const JPEG_TYPES = new Set(['image/jpeg', 'image/jpg'])

function pointerPos(canvas, e) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const point = e.touches?.[0] || e.changedTouches?.[0] || e
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  }
}

/** Simple freehand annotate over an output image, re-encoded to the same mime on Apply. */
export default function ImageOutputEditor({ blob, mime, onChange }) {
  const canvasRef = useRef(null)
  const imgUrlRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [color, setColor] = useState('#ff3b30')
  const [lineWidth, setLineWidth] = useState(4)

  useEffect(() => {
    if (!blob) return undefined
    setReady(false)
    setError('')
    const url = URL.createObjectURL(blob)
    imgUrlRef.current = url
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth || 1
      canvas.height = img.naturalHeight || 1
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      setReady(true)
    }
    img.onerror = () => setError('Could not load image for editing.')
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  const draw = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = pointerPos(canvas, e)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastRef.current = pos
  }

  const startDraw = (e) => {
    if (!ready) return
    e.preventDefault()
    drawingRef.current = true
    lastRef.current = pointerPos(canvasRef.current, e)
  }
  const moveDraw = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    draw(e)
  }
  const endDraw = (e) => {
    if (!drawingRef.current) return
    e?.preventDefault?.()
    drawingRef.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas || !imgUrlRef.current) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = imgUrlRef.current
  }

  const apply = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const outMime = JPEG_TYPES.has(mime) ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png'
    canvas.toBlob(
      (newBlob) => {
        if (newBlob) onChange?.(newBlob)
        else setError('Could not encode the edited image.')
      },
      outMime,
      outMime === 'image/png' ? undefined : 0.92
    )
  }

  return (
    <div className="editor-pane image-output-editor" data-editor="output-image" data-testid="image-output-editor">
      <div className="editor-pane-head">
        <span className="meta">Annotate output image (freehand)</span>
        <div className="toolbar-actions">
          <label className="option" htmlFor="image-output-color">
            <span className="option-label">Color</span>
            <input
              id="image-output-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label className="option" htmlFor="image-output-size">
            <span className="option-label">Brush</span>
            <input
              id="image-output-size"
              type="number"
              min={1}
              max={40}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value) || 1)}
            />
          </label>
          <button type="button" className="btn" disabled={!ready} onClick={clear}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={apply}>
            Apply
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="preview-frame image-output-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="image-output-canvas"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
      </div>
      <p className="meta">Draws directly on the output image. Apply re-encodes as {mime || 'the current format'}.</p>
    </div>
  )
}
