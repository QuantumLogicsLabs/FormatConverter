/**
 * Emit dist/bundle-report.json with gzip sizes for index, sdk, convert.worker.
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

async function gzipSize(path) {
  if (!existsSync(path)) return null
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

function findAsset(re) {
  if (!existsSync(assets)) return null
  const hit = readdirSync(assets).find((f) => re.test(f))
  return hit ? join(assets, hit) : null
}

const entries = {
  indexJs: findAsset(/^index-.*\.js$/),
  indexCss: findAsset(/^index-.*\.css$/),
  worker: findAsset(/^convert\.worker-.*\.js$/),
  sdk: join(dist, 'sdk.js'),
}

const report = { generatedAt: new Date().toISOString(), entries: {} }
for (const [key, path] of Object.entries(entries)) {
  if (!path || !existsSync(path)) {
    report.entries[key] = null
    continue
  }
  const gzip = await gzipSize(path)
  report.entries[key] = {
    file: path.slice(root.length + 1).replace(/\\/g, '/'),
    rawBytes: statSync(path).size,
    gzipBytes: gzip,
  }
}

const out = join(dist, 'bundle-report.json')
let prev = {}
if (existsSync(out)) {
  try {
    prev = JSON.parse(readFileSync(out, 'utf8'))
  } catch {
    /* ignore */
  }
}
writeFileSync(out, JSON.stringify({ ...prev, ...report, worker: prev.worker || report.entries.worker }, null, 2))
console.log('bundle-report.json written')
for (const [k, v] of Object.entries(report.entries)) {
  if (!v) continue
  console.log(`  ${k}: ${(v.gzipBytes / 1024).toFixed(1)} KB gzip`)
}
