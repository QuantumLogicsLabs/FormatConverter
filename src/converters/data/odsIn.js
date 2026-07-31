/**
 * ODS (OpenDocument Spreadsheet) → shared table model.
 * Parses content.xml directly (JSZip + fast-xml-parser) since SheetJS's free
 * build doesn't read ODS. Cell/row repeats are expanded, with a cap so a
 * sheet's "rest is blank" filler rows/cols don't blow up memory.
 */
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { makeTable } from './tableModel.js'

const PARSER_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: false,
}

const MAX_ROW_REPEAT = 5000
const MAX_COL_REPEAT = 5000

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function extractText(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  let out = node['#text'] != null ? String(node['#text']) : ''
  for (const key of ['text:span', 'text:a']) {
    for (const child of asArray(node[key])) out += extractText(child)
  }
  return out
}

function cellText(cell) {
  const paras = asArray(cell?.['text:p'])
  if (!paras.length) return ''
  return paras.map(extractText).join('\n')
}

function cellValue(cell) {
  const type = cell?.['@_office:value-type']
  if (type === 'float' || type === 'percentage' || type === 'currency') {
    const v = cell['@_office:value']
    if (v != null) return String(v)
  }
  if (type === 'boolean' && cell['@_office:boolean-value'] != null) {
    return String(cell['@_office:boolean-value'])
  }
  if (type === 'date' && cell['@_office:date-value'] != null) {
    return String(cell['@_office:date-value'])
  }
  return cellText(cell)
}

function isBlankCell(cell) {
  return !cell || (cell['@_office:value-type'] == null && !cellText(cell).trim())
}

function expandRow(row) {
  const cells = asArray(row?.['table:table-cell'])
  const out = []
  for (const cell of cells) {
    const repeat = Math.min(MAX_COL_REPEAT, Math.max(1, Number(cell?.['@_table:number-columns-repeated']) || 1))
    const value = isBlankCell(cell) ? '' : cellValue(cell)
    for (let i = 0; i < repeat; i++) out.push(value)
  }
  return out
}

function trimTrailingEmpty(arr) {
  let end = arr.length
  while (end > 0 && !String(arr[end - 1] ?? '').trim()) end--
  return arr.slice(0, end)
}

function sheetToRows(table) {
  const rows = asArray(table?.['table:table-row'])
  const out = []
  for (const row of rows) {
    const cells = trimTrailingEmpty(expandRow(row))
    const repeat = Math.max(1, Number(row?.['@_table:number-rows-repeated']) || 1)
    // A blank row repeated thousands of times is just sheet padding — keep at most one.
    const times = cells.length ? Math.min(repeat, MAX_ROW_REPEAT) : Math.min(repeat, 1)
    for (let i = 0; i < times; i++) out.push(cells)
  }
  return out
}

/**
 * @param {File|Blob} file
 * @param {{ sheet?: 'first'|'all' }} [options]
 * @returns {Promise<{ tables: { name: string, table: object }[], single: object|null }>}
 */
export async function parseOds(file, { sheet = 'first' } = {}) {
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('content.xml')
  if (!entry) throw new Error('Not a valid ODS file (missing content.xml).')
  const xml = await entry.async('string')

  let doc
  try {
    doc = new XMLParser(PARSER_OPTS).parse(xml)
  } catch (e) {
    throw new Error(`Could not read ODS content.xml: ${e.message}`)
  }

  const spreadsheet = doc?.['office:document-content']?.['office:body']?.['office:spreadsheet']
  const rawTables = asArray(spreadsheet?.['table:table'])
  if (!rawTables.length) return { tables: [], single: makeTable([], []) }

  const tables = rawTables.map((t, i) => {
    const rows = sheetToRows(t).filter((r) => r.length)
    const header = (rows[0] || []).map((c) => String(c ?? ''))
    const body = rows.slice(1)
    return { name: String(t?.['@_table:name'] || `Sheet${i + 1}`), table: makeTable(header, body) }
  })

  if (sheet === 'all') return { tables, single: null }
  return { tables: [tables[0]], single: tables[0].table }
}
