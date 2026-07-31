/**
 * Fail CI if convert.worker-*.js gzip size exceeds the soft budget.
 * Soft ceiling: 900 KB gzip (xlsx must stay off the worker graph).
 */
import { createGzip } from 'node:zlib'
import { readdirSync, createReadStream, writeFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Writable } from 'node:stream'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(root, 'dist', 'assets')
const BUDGET = 900 * 1024 // 900 KB gzip

function findWorker() {
  const files = readdirSync(assets).filter((f) => /^convert\.worker-.*\.js$/.test(f))
  if (!files.length) throw new Error('No convert.worker-*.js in dist/assets — run build first')
  return join(assets, files[0])
}

async function gzipSize(path) {
  let size = 0
  const counter = new Writable({
    write(chunk, _enc, cb) {
      size += chunk.length
      cb()
    },
  })
  await pipeline(createReadStream(path), createGzip({ level: 9 }), counter)
  return size
}

const path = findWorker()
const raw = statSync(path).size
const gzip = await gzipSize(path)
const report = {
  file: path.replace(root + '\\', '').replace(root + '/', ''),
  rawBytes: raw,
  gzipBytes: gzip,
  budgetGzipBytes: BUDGET,
  ok: gzip <= BUDGET,
}

const out = join(root, 'dist', 'bundle-report.json')
let existing = {}
try {
  existing = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(out, 'utf8')))
} catch {
  /* first write */
}
existing.worker = report
writeFileSync(out, JSON.stringify(existing, null, 2))

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`Worker budget: ${kb(gzip)} gzip / ${kb(BUDGET)} limit (${kb(raw)} raw)`)
if (!report.ok) {
  console.error('FAIL: convert.worker exceeds gzip soft budget. Keep SheetJS/xlsx off the worker.')
  process.exit(1)
}
console.log('Worker budget OK')
