import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FORMATS, listConversions, listTools } from '../converters/index.js'
import { trapTabKey } from '../lib/focusTrap.js'

/**
 * Ctrl/Cmd+K command palette — jump to convert pairs and tools.
 */
export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  const items = useMemo(() => {
    const pairs = listConversions().map(({ from, to }) => ({
      id: `c-${from}-${to}`,
      label: `${FORMATS[from]?.label || from} → ${FORMATS[to]?.label || to}`,
      path: `/convert/${from}-to-${to}`,
      kind: 'convert',
    }))
    const tools = listTools().map((t) => ({
      id: `t-${t.id}`,
      label: t.label,
      path: `/tools/${t.id}`,
      kind: 'tool',
    }))
    return [...pairs, ...tools]
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!needle) return items.slice(0, 40)
    return items
      .filter((it) => {
        const hay = `${it.label} ${it.path}`.toLowerCase().replace(/→/g, 'to')
        return hay.includes(needle) || needle.split(/\s+/).every((p) => hay.includes(p))
      })
      .slice(0, 40)
  }, [items, q])

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => previouslyFocused.current?.focus?.())
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => {
          if (v) {
            requestAnimationFrame(() => previouslyFocused.current?.focus?.())
            return false
          }
          previouslyFocused.current = document.activeElement
          return true
        })
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQ('')
    requestAnimationFrame(() => inputRef.current?.focus())
    const onTab = (e) => trapTabKey(e, panelRef.current)
    document.addEventListener('keydown', onTab)
    return () => document.removeEventListener('keydown', onTab)
  }, [open])

  if (!open) return null

  const go = (path) => {
    close()
    navigate(path)
  }

  return (
    <div
      className="palette-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={close}
    >
      <div className="palette" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search converters and tools…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) go(filtered[0].path)
          }}
        />
        <ul className="palette-list">
          {filtered.map((it) => (
            <li key={it.id}>
              <button type="button" className="palette-item" onClick={() => go(it.path)}>
                <span>{it.label}</span>
                <span className="meta">{it.kind}</span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="meta">No matches</li>}
        </ul>
        <p className="meta palette-hint">Enter to open · Esc to close · Ctrl/Cmd+K</p>
      </div>
    </div>
  )
}
