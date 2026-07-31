import { useEffect, useMemo, useState } from 'react'
import { downloadBlob, formatBytes } from '../lib/format.js'

const BITMAP_TYPES = /^(image\/(png|jpeg|jpg|webp|gif|bmp|avif|tiff))$/i

export default function ResultPanel({ result, onReset, sourceFile = null }) {
  const { blob, filename } = result
  const isText = blob.type.startsWith('text/') || blob.type === 'application/json'
  const isImage = blob.type.startsWith('image/') && blob.type !== 'image/x-icon'
  const isPdf = blob.type === 'application/pdf'
  const canCompare =
    isImage &&
    sourceFile &&
    (BITMAP_TYPES.test(sourceFile.type) || /\.(png|jpe?g|webp|gif|bmp|avif|tiff)$/i.test(sourceFile.name || ''))

  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const objectUrl = useMemo(
    () => (isImage || isPdf ? URL.createObjectURL(blob) : null),
    [blob, isImage, isPdf]
  )
  const sourceUrl = useMemo(
    () => (canCompare ? URL.createObjectURL(sourceFile) : null),
    [canCompare, sourceFile]
  )

  useEffect(() => {
    if (isText) blob.text().then(setText)
  }, [blob, isText])

  useEffect(() => () => objectUrl && URL.revokeObjectURL(objectUrl), [objectUrl])
  useEffect(() => () => sourceUrl && URL.revokeObjectURL(sourceUrl), [sourceUrl])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="toolbar">
        <span className="meta">
          {filename} · {formatBytes(blob.size)}
        </span>
        <div className="toolbar-actions">
          {isText && (
            <button className="btn" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => downloadBlob(blob, filename)}>
            Download {filename.split('.').pop().toUpperCase()}
          </button>
        </div>
      </div>

      {isText && <textarea className="output" value={text} readOnly />}
      {isImage && canCompare && (
        <div className="compare-preview" data-compare="1">
          <figure className="compare-pane">
            <figcaption>Before</figcaption>
            <img src={sourceUrl} alt="Original input" className="preview-image" />
          </figure>
          <figure className="compare-pane">
            <figcaption>After</figcaption>
            <img src={objectUrl} alt="Converted output" className="preview-image" />
          </figure>
        </div>
      )}
      {isImage && !canCompare && (
        <div className="preview-frame">
          <img src={objectUrl} alt="Converted output" className="preview-image" />
        </div>
      )}
      {isPdf && <iframe src={objectUrl} title="Converted PDF" className="preview-pdf" />}
      {!isText && !isImage && !isPdf && (
        <p className="meta preview-note">
          Ready to download{blob.type === 'application/zip' ? ' — pages are bundled in a .zip.' : '.'}
        </p>
      )}

      <p className="convert-again">
        <button className="btn-link" onClick={onReset}>
          Convert another file
        </button>
      </p>
    </>
  )
}
