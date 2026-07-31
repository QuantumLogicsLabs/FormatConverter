/**
 * JSON Lines / NDJSON — one JSON value per line.
 */
import { treeToTable, tableToObjects } from './tableModel.js'

export async function parseJsonl(file) {
  const text = await file.text()
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  const rows = []
  for (let i = 0; i < lines.length; i++) {
    try {
      rows.push(JSON.parse(lines[i]))
    } catch (e) {
      throw new Error(`Invalid JSON on line ${i + 1}: ${e.message}`)
    }
  }
  return rows
}

export function jsonlToTable(rows) {
  return treeToTable(rows, { label: 'JSONL' })
}

export function valueToJsonlBlob(value) {
  const rows = Array.isArray(value) ? value : [value]
  const text = rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
  return new Blob([text], { type: 'application/x-ndjson;charset=utf-8' })
}

export function tableToJsonlBlob(table) {
  return valueToJsonlBlob(tableToObjects(table))
}
