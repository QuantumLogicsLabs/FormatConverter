/**
 * Lightweight RTF ↔ plain text / markdown / html.
 * Strips control words for read; wraps escaped text for write.
 */

/** Remove RTF destination groups {\* ... } with nested-brace awareness. */
function stripDestinations(input) {
  let out = ''
  let i = 0
  const s = String(input || '')
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '\\' && s[i + 2] === '*') {
      let depth = 0
      while (i < s.length) {
        if (s[i] === '{') depth++
        else if (s[i] === '}') {
          depth--
          i++
          if (depth === 0) break
          continue
        }
        i++
      }
      continue
    }
    out += s[i++]
  }
  return out
}

function rtfToText(rtf) {
  let s = stripDestinations(rtf)

  // Hex escapes \'hh
  s = s.replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
    try {
      return decodeURIComponent('%' + m.slice(2))
    } catch {
      return ''
    }
  })

  // Unicode \uN?
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    const code = Number(n)
    if (code < 0) return String.fromCharCode(65536 + code)
    return String.fromCharCode(code)
  })

  // Escaped specials before control-word strip
  s = s.replace(/\\\\/g, '\u0000')
  s = s.replace(/\\[{}]/g, (m) => m[1])

  s = s.replace(/\\par[d]?/gi, '\n')
  s = s.replace(/\\line/gi, '\n')
  s = s.replace(/\\tab/gi, '\t')

  // Control words / symbols — leave a space so adjacent text doesn't glue
  s = s.replace(/\\[a-z]+(-?\d+)?[ ]?/gi, ' ')
  s = s.replace(/\\[^a-z\\]/gi, '')

  s = s.replace(/[{}]/g, '')
  s = s.replace(/\u0000/g, '\\')
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  s = s.replace(/[ \t]{2,}/g, ' ')
  return s.trim() + '\n'
}

function escapeRtf(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par\n')
}

function textToRtf(text) {
  return `{\\rtf1\\ansi\\deff0\n${escapeRtf(text)}}\n`
}

export default async function convertRtf(file, options = {}) {
  const { from, to } = options
  const raw = await file.text()

  let text
  if (from === 'rtf') text = rtfToText(raw)
  else if (from === 'html') {
    text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
  } else {
    text = raw
  }

  if (to === 'rtf') {
    return new Blob([textToRtf(text)], { type: 'application/rtf;charset=utf-8' })
  }
  if (to === 'txt') {
    return new Blob([text.endsWith('\n') ? text : text + '\n'], { type: 'text/plain;charset=utf-8' })
  }
  if (to === 'md') {
    return new Blob([text.endsWith('\n') ? text : text + '\n'], { type: 'text/markdown;charset=utf-8' })
  }
  if (to === 'html') {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted</title></head><body><p>${escaped}</p></body></html>\n`
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  }
  throw new Error(`Unsupported RTF conversion ${from} → ${to}`)
}
