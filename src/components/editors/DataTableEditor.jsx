import { useMemo, useState } from 'react'

/**
 * Minimal editable table grid over { header, rows } IR.
 */
export default function DataTableEditor({ table, onApply, applying = false }) {
  const [header, setHeader] = useState(() => [...(table?.header || [])])
  const [rows, setRows] = useState(() => (table?.rows || []).map((r) => [...r]))

  const colCount = header.length

  const setCell = (ri, ci, value) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r])
      next[ri] = next[ri] || Array(colCount).fill('')
      next[ri][ci] = value
      return next
    })
  }

  const setHead = (ci, value) => {
    setHeader((prev) => {
      const next = [...prev]
      next[ci] = value
      return next
    })
  }

  const addRow = () => setRows((prev) => [...prev, Array(colCount).fill('')])
  const addCol = () => {
    setHeader((prev) => [...prev, `col${prev.length + 1}`])
    setRows((prev) => prev.map((r) => [...r, '']))
  }

  const snapshot = useMemo(() => ({ header, rows, label: table?.label || 'Table' }), [header, rows, table?.label])

  return (
    <div className="editor-pane data-table-editor" data-editor="source-table">
      <div className="editor-pane-head">
        <span className="meta">Edit table</span>
        <span className="toolbar-actions">
          <button type="button" className="btn" onClick={addRow}>
            Add row
          </button>
          <button type="button" className="btn" onClick={addCol}>
            Add column
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={applying}
            onClick={() => onApply?.(snapshot)}
          >
            {applying ? 'Updating…' : 'Apply & refresh'}
          </button>
        </span>
      </div>
      <div className="table-editor-scroll">
        <table className="edit-grid">
          <thead>
            <tr>
              {header.map((h, ci) => (
                <th key={ci}>
                  <input value={h} onChange={(e) => setHead(ci, e.target.value)} aria-label={`Header ${ci + 1}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {header.map((_, ci) => (
                  <td key={ci}>
                    <input
                      value={row[ci] ?? ''}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      aria-label={`Row ${ri + 1} col ${ci + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
