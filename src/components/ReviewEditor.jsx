import { useEffect, useMemo, useRef, useState } from 'react'
import { convert, FORMATS } from '../converters/index.js'
import { fileToTable, tableToCsvBlob } from '../converters/data/csv.js'
import { treeToTable } from '../converters/data/tableModel.js'
import { getEditorProfile, rememberEditMode } from '../lib/editProfiles.js'
import { setLiveSession, saveTextDraft, loadTextDraft, saveTableDraft, loadTableDraft } from '../lib/editSession.js'
import { downloadBlob, formatBytes } from '../lib/format.js'
import { FormatConvertError, ErrorCodes, userFacingMessage } from '../lib/errors.js'
import ResultPanel from './ResultPanel.jsx'
import SourceTextEditor from './editors/SourceTextEditor.jsx'
import TextOutputEditor from './editors/TextOutputEditor.jsx'
import DataTableEditor from './editors/DataTableEditor.jsx'
import ImageSourceEditor from './editors/ImageSourceEditor.jsx'
import PdfOutputEditor from './editors/PdfOutputEditor.jsx'
import ImageOutputEditor from './editors/ImageOutputEditor.jsx'

const EDIT_SOFT = 25 * 1024 * 1024

function mimeFor(to, text) {
  const m = FORMATS[to]?.mime
  if (m) return `${m}${m.startsWith('text/') || m.includes('json') || m.includes('xml') ? ';charset=utf-8' : ''}`
  return 'text/plain;charset=utf-8'
}

/**
 * Review & Edit shell after a successful single-file convert.
 * Modes: Preview | Source (IR) | Output — plus always-visible Download.
 */
export default function ReviewEditor({
  from,
  to,
  sourceFile,
  result: initialResult,
  options = {},
  onReset,
  onResult,
}) {
  const profile = useMemo(() => getEditorProfile(from, to), [from, to])
  const [mode, setMode] = useState(profile.defaultMode)
  const [result, setResult] = useState(initialResult)
  const [sourceText, setSourceText] = useState('')
  const [table, setTable] = useState(null)
  const [applying, setApplying] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  useEffect(() => {
    setResult(initialResult)
  }, [initialResult])

  useEffect(() => {
    setLiveSession({
      from,
      to,
      sourceFile,
      result,
      options,
      ir: { type: 'blob', value: null },
    })
  }, [from, to, sourceFile, result, options])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (e.target?.closest?.('textarea, input, [contenteditable]')) return
      onReset?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onReset])

  const softWarn = (sourceFile?.size || 0) > EDIT_SOFT || (result?.blob?.size || 0) > EDIT_SOFT

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!profile.sourceModes.includes('text') || !sourceFile) return
      try {
        const draft = loadTextDraft(from, to)
        if (draft != null) {
          if (!cancelled) setSourceText(draft)
          return
        }
        if ((sourceFile.size || 0) > EDIT_SOFT) {
          throw new FormatConvertError(ErrorCodes.EDIT_TOO_LARGE)
        }
        const t = await sourceFile.text()
        if (!cancelled) setSourceText(t)
      } catch (e) {
        if (!cancelled) setError(userFacingMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [from, to, sourceFile, profile.sourceModes])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!profile.sourceModes.includes('table') || !sourceFile) return
      try {
        const draft = loadTableDraft(from, to)
        if (draft) {
          if (!cancelled) setTable(draft)
          return
        }
        if (from === 'csv' || from === 'tsv') {
          const t = await fileToTable(sourceFile, from === 'tsv' ? '\t' : ',')
          if (!cancelled) setTable(t)
        } else if (from === 'json' || from === 'jsonl') {
          const text = await sourceFile.text()
          const data =
            from === 'jsonl'
              ? text
                  .split('\n')
                  .filter((l) => l.trim())
                  .map((l) => JSON.parse(l))
              : JSON.parse(text)
          if (!cancelled) setTable(treeToTable(Array.isArray(data) ? data : [data]))
        }
      } catch (e) {
        if (!cancelled) setError(userFacingMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [from, to, sourceFile, profile.sourceModes])

  const switchMode = (next) => {
    setMode(next)
    rememberEditMode(from, to, next)
    setError('')
  }

  const applySourceText = async (text) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setApplying(true)
    setStatusMsg('Preview updating…')
    setError('')
    saveTextDraft(from, to, text)
    setSourceText(text)
    try {
      const file = new File([text], sourceFile?.name || `edited.${FORMATS[from].exts[0]}`, {
        type: FORMATS[from].mime,
      })
      const res = await convert(file, to, { ...options, from, signal: ac.signal })
      if (ac.signal.aborted) return
      setResult(res)
      onResult?.(res)
      setStatusMsg('Preview updated')
    } catch (e) {
      if (e?.name === 'AbortError') return
      setError(userFacingMessage(e))
    } finally {
      setApplying(false)
      abortRef.current = null
    }
  }

  const applyTable = async (nextTable) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setApplying(true)
    setStatusMsg('Preview updating…')
    setError('')
    saveTableDraft(from, to, nextTable)
    setTable(nextTable)
    try {
      const delim = from === 'tsv' ? '\t' : ','
      const mime = from === 'tsv' ? 'text/tab-separated-values' : 'text/csv'
      const csvBlob = tableToCsvBlob(nextTable, delim, mime)
      const file = new File([csvBlob], 'edited.csv', { type: 'text/csv' })
      const res = await convert(file, to, { ...options, from: 'csv', signal: ac.signal })
      if (ac.signal.aborted) return
      setResult(res)
      onResult?.(res)
      setStatusMsg('Preview updated')
    } catch (e) {
      if (e?.name === 'AbortError') return
      setError(userFacingMessage(e))
    } finally {
      setApplying(false)
      abortRef.current = null
    }
  }

  const applyImageBlob = async (blob) => {
    setApplying(true)
    setStatusMsg('Preview updating…')
    setError('')
    try {
      // Image tools already re-encode to the pair target mime.
      const res = {
        ...result,
        blob,
        filename: result.filename,
      }
      setResult(res)
      onResult?.(res)
      setStatusMsg('Preview updated')
    } catch (e) {
      setError(userFacingMessage(e))
    } finally {
      setApplying(false)
    }
  }

  const applyOutputText = (text) => {
    const blob = new Blob([text.endsWith('\n') ? text : text + '\n'], { type: mimeFor(to) })
    const res = { ...result, blob }
    setResult(res)
    onResult?.(res)
    setStatusMsg('Output text applied')
  }

  const applyOutputBlob = (blob) => {
    const res = { ...result, blob }
    setResult(res)
    onResult?.(res)
    setStatusMsg('Output updated')
  }

  const download = () => downloadBlob(result.blob, result.filename)

  const showSource = profile.sourceModes.length > 0
  const showOutput = profile.outputModes.some((m) => m !== 'none')

  return (
    <div className="review-editor result" data-review="1">
      <div className="review-header">
        <div>
          <h2 className="review-title">Review &amp; Edit</h2>
          <p className="meta">{profile.label}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-primary" onClick={download} data-review-download="1">
            Download {result.filename.split('.').pop().toUpperCase()}
          </button>
          <button type="button" className="btn-link" onClick={onReset}>
            Convert another
          </button>
        </div>
      </div>

      <div className="review-tabs" role="tablist" aria-label="Review modes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          className={mode === 'preview' ? 'chip chip-active' : 'chip'}
          onClick={() => switchMode('preview')}
        >
          Preview
        </button>
        {showSource && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'source'}
            className={mode === 'source' ? 'chip chip-active' : 'chip'}
            onClick={() => switchMode('source')}
          >
            Source
          </button>
        )}
        {showOutput && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'output'}
            className={mode === 'output' ? 'chip chip-active' : 'chip'}
            onClick={() => switchMode('output')}
          >
            Output
          </button>
        )}
      </div>

      <p className="meta" aria-live="polite">
        {result.filename} · {formatBytes(result.blob.size)}
        {statusMsg ? ` · ${statusMsg}` : ''}
        {applying ? ' · working…' : ''}
      </p>
      {softWarn && (
        <p className="meta" role="status" data-edit-soft-warn="1">
          Large file — editing may be slow or hit browser memory limits. Download still works.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!profile.editable && (
        <p className="meta" data-edit-unsupported="1">
          {ErrorCodes.EDIT_UNSUPPORTED}: editing is not available for this pair — download is ready.
        </p>
      )}

      {mode === 'preview' && (
        <div className="review-preview">
          <ResultPanel result={result} onReset={onReset} sourceFile={sourceFile} hideDownload hideReset />
        </div>
      )}

      {mode === 'source' && showSource && (
        <div className="review-edit">
          {profile.sourceModes.includes('text') && (
            <SourceTextEditor
              initialText={sourceText}
              label={`${FORMATS[from].label} source`}
              applying={applying}
              onApply={applySourceText}
            />
          )}
          {profile.sourceModes.includes('table') && table && (
            <DataTableEditor table={table} applying={applying} onApply={applyTable} />
          )}
          {profile.sourceModes.includes('image') && sourceFile && (
            <ImageSourceEditor file={sourceFile} to={to} applying={applying} onApply={applyImageBlob} />
          )}
          <div className="review-preview-side">
            <p className="meta">Live preview</p>
            <ResultPanel result={result} onReset={() => {}} sourceFile={null} hideDownload hideReset />
          </div>
        </div>
      )}

      {mode === 'output' && showOutput && (
        <div className="review-edit">
          {profile.outputModes.includes('text') && (
            <OutputTextLoader blob={result.blob} onChange={applyOutputText} />
          )}
          {profile.outputModes.includes('pdf') && (
            <PdfOutputEditor blob={result.blob} filename={result.filename} onChange={applyOutputBlob} />
          )}
          {profile.outputModes.includes('image') && (
            <ImageOutputEditor
              blob={result.blob}
              mime={result.blob.type || FORMATS[to].mime}
              onChange={applyOutputBlob}
            />
          )}
        </div>
      )}
    </div>
  )
}

function OutputTextLoader({ blob, onChange }) {
  const [text, setText] = useState('')
  useEffect(() => {
    blob.text().then(setText)
  }, [blob])
  if (!text && text !== '') return <p className="meta">Loading text…</p>
  return <TextOutputEditor initialText={text} onChange={onChange} />
}
