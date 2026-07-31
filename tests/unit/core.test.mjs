import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePageRanges } from '../../src/lib/pageRanges.js'
import { treeToTable, tableToObjects, makeTable } from '../../src/converters/data/tableModel.js'
import { parseSrt, cuesToSrt, parseAss } from '../../src/converters/subtitles/convert.js'
import { toFormatConvertError, ErrorCodes, FormatConvertError } from '../../src/lib/errors.js'
import { rtfToText } from '../../src/converters/docs/rtfConvert.js'
import { parseIni } from '../../src/converters/data/ini.js'
import { parseJsonl, valueToJsonlBlob } from '../../src/converters/data/jsonl.js'
import { listConversions, getConversion, FORMATS } from '../../src/converters/registry.js'
import { listTools, getTool } from '../../src/converters/tools.js'
import { WORKER_LOADERS, workerLoaderKey } from '../../src/workers/loaders.js'
import { needsCjkFont, needsUnicodeFont } from '../../src/converters/docs/pdfFonts.js'

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
    const table = treeToTable([
      { a: 1, b: true },
      { a: 2, b: false },
    ])
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
    const err = toFormatConvertError(Object.assign(new Error('x'), { name: 'AbortError' }))
    assert.equal(err.code, ErrorCodes.ABORTED)
  })
  it('maps oom', () => {
    assert.equal(toFormatConvertError(new Error('out of memory')).code, ErrorCodes.OOM)
  })
  it('preserves FormatConvertError', () => {
    const e = new FormatConvertError(ErrorCodes.ENCRYPT_PDF, 'locked')
    assert.equal(toFormatConvertError(e).code, ErrorCodes.ENCRYPT_PDF)
  })
  it('maps password exceptions', () => {
    const e = Object.assign(new Error('No password given'), { name: 'PasswordException' })
    assert.equal(toFormatConvertError(e).code, ErrorCodes.ENCRYPT_PDF)
  })
})

describe('rtf', () => {
  it('strips control words', () => {
    const t = rtfToText('{\\rtf1\\ansi\\deff0 Hello RTF world}')
    assert.match(t, /Hello\s+RTF\s+world/)
  })
  it('maps bold to markdown', () => {
    const t = rtfToText('{\\rtf1\\ansi\\b bold\\b0 plain}', { markdown: true })
    assert.match(t, /\*\*\s*bold\*\*/)
  })
})

describe('ini/jsonl', () => {
  it('parses ini sections', () => {
    const data = parseIni('[db]\nhost = localhost\nport = 5432\n')
    assert.equal(data.db.host, 'localhost')
    assert.equal(data.db.port, 5432)
  })
  it('jsonl round-trip blob', async () => {
    const blob = valueToJsonlBlob([{ a: 1 }, { a: 2 }])
    const rows = await parseJsonl(new File([blob], 't.jsonl'))
    assert.equal(rows.length, 2)
    assert.equal(rows[0].a, 1)
  })
})

describe('fonts helpers', () => {
  it('detects unicode and cjk', () => {
    assert.equal(needsUnicodeFont('€ price'), true)
    assert.equal(needsCjkFont('你好'), true)
    assert.equal(needsCjkFont('hello'), false)
  })
})

describe('registry invariants', () => {
  it('every worker pair has a loader', () => {
    const missing = []
    for (const { from, to } of listConversions()) {
      const entry = getConversion(from, to)
      if (entry?.env === 'worker') {
        const key = workerLoaderKey(from, to)
        if (!WORKER_LOADERS[key]) missing.push(key)
      }
    }
    assert.deepEqual(missing, [])
  })
  it('tool ids are unique and options well-formed', () => {
    const tools = listTools()
    const ids = tools.map((t) => t.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const t of tools) {
      assert.ok(t.label)
      assert.ok(getTool(t.id)?.load)
      for (const opt of t.options || []) {
        assert.ok(opt.key)
        assert.ok(opt.type)
        assert.ok('default' in opt)
      }
    }
  })
  it('formats declare kinds', () => {
    for (const [id, f] of Object.entries(FORMATS)) {
      assert.ok(f.kind, id)
      assert.ok(Array.isArray(f.exts) && f.exts.length, id)
    }
  })
})

describe('editProfiles', () => {
  it('md→pdf is dual editable', async () => {
    const { getEditorProfile } = await import('../../src/lib/editProfiles.js')
    const p = getEditorProfile('md', 'pdf')
    assert.equal(p.editable, true)
    assert.ok(p.sourceModes.includes('text'))
    assert.ok(p.outputModes.includes('pdf'))
  })
  it('wav→mp3 is EDIT_UNSUPPORTED profile', async () => {
    const { getEditorProfile } = await import('../../src/lib/editProfiles.js')
    const p = getEditorProfile('wav', 'mp3')
    assert.equal(p.editable, false)
    assert.equal(p.profile, 'binary-av')
  })
  it('csv→json has table source', async () => {
    const { getEditorProfile } = await import('../../src/lib/editProfiles.js')
    const p = getEditorProfile('csv', 'json')
    assert.ok(p.sourceModes.includes('table'))
    assert.ok(p.outputModes.includes('text'))
  })
})
