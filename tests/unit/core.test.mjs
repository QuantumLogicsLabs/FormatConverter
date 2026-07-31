import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePageRanges } from '../../src/lib/pageRanges.js'
import { treeToTable, tableToObjects, makeTable } from '../../src/converters/data/tableModel.js'
import { parseSrt, cuesToSrt, parseAss } from '../../src/converters/subtitles/convert.js'
import { toFormatConvertError, ErrorCodes, FormatConvertError } from '../../src/lib/errors.js'

describe('parsePageRanges', () => {
  it('parses lists and ranges', () => {
    assert.deepEqual(parsePageRanges('1-3,7', 10), [1, 2, 3, 7])
  })
  it('supports open end', () => {
    assert.deepEqual(parsePageRanges('9-', 12), [9, 10, 11, 12])
  })
  it('rejects garbage', () => {
    assert.throws(() => parsePageRanges('nope', 5))
  })
})

describe('tableModel', () => {
  it('objects to table and back', () => {
    const table = treeToTable([{ a: 1, b: true }, { a: 2, b: false }])
    assert.deepEqual(table.header, ['a', 'b'])
    const objs = tableToObjects(table)
    assert.equal(objs[0].a, 1)
    assert.equal(objs[0].b, true)
  })
  it('rejects nested objects', () => {
    assert.throws(() => treeToTable({ a: 1 }), /table/)
  })
  it('makeTable stringifies', () => {
    const t = makeTable(['x'], [[null]])
    assert.equal(t.rows[0][0], '')
  })
})

describe('subtitles', () => {
  it('srt round-trip', () => {
    const src = `1\n00:00:01,000 --> 00:00:02,000\nHi\n`
    const cues = parseSrt(src)
    assert.equal(cues[0].text, 'Hi')
    assert.match(cuesToSrt(cues), /00:00:01,000/)
  })
  it('parses ass dialogue', () => {
    const ass = `[Script Info]\nScriptType: v4.00+\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello\n`
    const cues = parseAss(ass)
    assert.equal(cues[0].text, 'Hello')
  })
})

describe('errors', () => {
  it('maps abort', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    const e = toFormatConvertError(err)
    assert.equal(e.code, ErrorCodes.ABORTED)
  })
  it('maps oom', () => {
    const e = toFormatConvertError(new Error('out of memory'))
    assert.equal(e.code, ErrorCodes.OOM)
  })
  it('preserves FormatConvertError', () => {
    const orig = new FormatConvertError(ErrorCodes.TOO_LARGE, 'big')
    assert.equal(toFormatConvertError(orig).code, ErrorCodes.TOO_LARGE)
  })
})
