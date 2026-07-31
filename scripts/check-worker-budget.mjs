/**
 * Fail CI if convert.worker or SDK facade gzip exceeds soft budgets.
 * Worker: 900 KB gzip. SDK facade (sdk.js entry only): 250 KB gzip.
 */
import { createGzip } from 'node:zlib'
import { readdirSync, createReadStream, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Writable } from 'node:stream'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const assets = join(dist, 'assets')
const WORKER_BUDGET = 900 * 1024
const SDK_FACADE_BUDGET = 250 * 1024

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

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

const workerPath = findWorker()
const workerRaw = statSync(workerPath).size
const workerGzip = await gzipSize(workerPath)
const workerReport = {
  file: workerPath.slice(root.length + 1).replace(/\\/g, '/'),
  rawBytes: workerRaw,
  gzipBytes: workerGzip,
  budgetGzipBytes: WORKER_BUDGET,
  ok: workerGzip <= WORKER_BUDGET,
}

const sdkPath = join(dist, 'sdk.js')
if (!existsSync(sdkPath)) throw new Error('dist/sdk.js missing — run build first')
const sdkRaw = statSync(sdkPath).size
const sdkGzip = await gzipSize(sdkPath)
const sdkReport = {
  file: 'dist/sdk.js',
  rawBytes: sdkRaw,
  gzipBytes: sdkGzip,
  budgetGzipBytes: SDK_FACADE_BUDGET,
  ok: sdkGzip <= SDK_FACADE_BUDGET,
  note: 'Facade only; kind chunks under dist/sdk/ load on demand',
}

const out = join(dist, 'bundle-report.json')
let existing = {}
try {
  existing = JSON.parse(readFileSync(out, 'utf8'))
} catch {
  /* first write */
}
existing.worker = workerReport
existing.sdkFacade = sdkReport
writeFileSync(out, JSON.stringify(existing, null, 2))

console.log(`Worker budget: ${kb(workerGzip)} gzip / ${kb(WORKER_BUDGET)} limit (${kb(workerRaw)} raw)`)
console.log(`SDK facade budget: ${kb(sdkGzip)} gzip / ${kb(SDK_FACADE_BUDGET)} limit (${kb(sdkRaw)} raw)`)

let failed = false
if (!workerReport.ok) {
  console.error('FAIL: convert.worker exceeds gzip soft budget. Keep SheetJS/xlsx off the worker.')
  failed = true
} else {
  console.log('Worker budget OK')
}
if (!sdkReport.ok) {
  console.error('FAIL: sdk.js facade exceeds gzip soft budget. Keep heavy engines in lazy chunks.')
  failed = true
} else {
  console.log('SDK facade budget OK')
}
if (failed) process.exit(1)
