/**
 * Minimal INI parse/stringify (sections + key=value).
 */
import { treeToTable, tableToObjects } from './tableModel.js'

export async function parseIniFile(file) {
  const text = await file.text()
  return parseIni(text)
}

export function parseIni(text) {
  const root = {}
  let section = root
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue
    const sec = /^\[([^\]]+)\]$/.exec(line)
    if (sec) {
      const name = sec[1].trim()
      root[name] = root[name] && typeof root[name] === 'object' ? root[name] : {}
      section = root[name]
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    } else if (/^(true|false)$/i.test(val)) {
      val = /^true$/i.test(val)
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      val = Number(val)
    }
    section[key] = val
  }
  return root
}

export function stringifyIni(obj) {
  const lines = []
  const writePairs = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (v != null && typeof v === 'object' && !Array.isArray(v)) continue
      lines.push(`${k} = ${formatIniValue(v)}`)
    }
  }
  const nested = []
  for (const [k, v] of Object.entries(obj || {})) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) nested.push([k, v])
    else lines.push(`${k} = ${formatIniValue(v)}`)
  }
  for (const [name, body] of nested) {
    if (lines.length) lines.push('')
    lines.push(`[${name}]`)
    writePairs(body)
  }
  return lines.join('\n') + '\n'
}

function formatIniValue(v) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  const s = String(v ?? '')
  if (/[=\n#;\[\]]/.test(s) || s !== s.trim()) return `"${s.replace(/"/g, '\\"')}"`
  return s
}

export function valueToIniBlob(value) {
  return new Blob([stringifyIni(value)], { type: 'text/plain;charset=utf-8' })
}

export function iniToTable(data) {
  const rows = []
  for (const [k, v] of Object.entries(data || {})) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [kk, vv] of Object.entries(v)) {
        rows.push({ section: k, key: kk, value: vv })
      }
    } else {
      rows.push({ section: '', key: k, value: v })
    }
  }
  return treeToTable(rows, { label: 'INI' })
}

export function tableToIniBlob(table) {
  const rows = tableToObjects(table)
  const root = {}
  for (const row of rows) {
    const section = String(row.section || '')
    const key = String(row.key || '')
    if (!key) continue
    if (section) {
      if (!root[section] || typeof root[section] !== 'object') root[section] = {}
      root[section][key] = row.value
    } else {
      root[key] = row.value
    }
  }
  return valueToIniBlob(root)
}
