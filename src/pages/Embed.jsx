import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FORMATS, getConversion } from '../converters/index.js'
import ConverterWidget from '../components/ConverterWidget.jsx'
import Seo from '../components/Seo.jsx'
import { applyTheme } from '../lib/theme.js'

function isValidParentOrigin(value) {
  if (!value || value === '*') return true
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function post(type, payload, targetOrigin) {
  window.parent?.postMessage({ type, ...payload }, targetOrigin || '*')
}

/**
 * Chrome-less converter for embedding in an <iframe>.
 * Query: from, to, theme=light|dark, parentOrigin (postMessage target — preferred).
 */
export default function Embed() {
  const [params] = useSearchParams()
  const from = params.get('from') || 'pdf'
  const to = params.get('to') || 'txt'
  const theme = params.get('theme')
  const rawOrigin = params.get('parentOrigin')
  const parentOrigin = useMemo(() => {
    if (!rawOrigin) return '*'
    return isValidParentOrigin(rawOrigin) ? rawOrigin : '*'
  }, [rawOrigin])
  const entry = getConversion(from, to)
  const rootRef = useRef(null)

  useEffect(() => {
    if (theme === 'light' || theme === 'dark') applyTheme(theme)
  }, [theme])

  useEffect(() => {
    post('formatconvert:ready', { from, to }, parentOrigin)
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      post('formatconvert:height', { height: el.scrollHeight }, parentOrigin)
    })
    ro.observe(el)
    post('formatconvert:height', { height: el.scrollHeight }, parentOrigin)
    return () => ro.disconnect()
  }, [from, to, parentOrigin])

  if (!entry) {
    return (
      <div className="embed" ref={rootRef}>
        <Seo title="Embed" description="FormatConvert embed widget" path="/embed" noindex />
        <p className="error">
          Unsupported conversion “{from} → {to}”. See /developers for the supported matrix.
        </p>
      </div>
    )
  }

  const handleResult = (result) => {
    post(
      'formatconvert:result',
      {
        from: result.from,
        to: result.to,
        filename: result.filename,
        blob: result.blob,
      },
      parentOrigin
    )
  }

  const handleProgress = (progress) => {
    post('formatconvert:progress', { progress }, parentOrigin)
  }

  return (
    <div className="embed" ref={rootRef}>
      <Seo
        title={`${FORMATS[from].label} → ${FORMATS[to].label} embed`}
        description="Chrome-less FormatConvert widget for iframes."
        path="/embed"
        noindex
      />
      <p className="embed-title">
        {FORMATS[from].label} → {FORMATS[to].label}
      </p>
      {!rawOrigin && (
        <p className="meta embed-origin-hint">
          Tip: pass <code>parentOrigin</code> (your site origin) so postMessage targets only your page.
        </p>
      )}
      <ConverterWidget
        key={`${from}-${to}`}
        from={from}
        to={to}
        onResult={handleResult}
        onProgress={handleProgress}
        single
      />
      <p className="embed-credit">
        Powered by{' '}
        <a href="https://formatconvert.quantumlogicslimited.com" target="_blank" rel="noreferrer">
          FormatConvert
        </a>
      </p>
    </div>
  )
}
