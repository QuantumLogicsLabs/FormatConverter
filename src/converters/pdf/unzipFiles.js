import JSZip from 'jszip'

export default async function unzipFiles(files, options = {}, onProgress = () => {}) {
  const file = files[0]
  if (!file) throw new Error('Choose a zip archive.')
  onProgress({ stage: 'decode' })
  const zip = await JSZip.loadAsync(file)
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
  if (!names.length) throw new Error('Zip archive is empty.')
  // Re-pack as a flat zip of extracted files (browser can't download a folder)
  const out = new JSZip()
  onProgress({ stage: 'encode', page: 0, total: names.length })
  for (let i = 0; i < names.length; i++) {
    const data = await zip.files[names[i]].async('uint8array')
    const base = names[i].split('/').pop() || `file-${i + 1}`
    out.file(base, data)
    onProgress({ stage: 'encode', page: i + 1, total: names.length })
  }
  const blob = await out.generateAsync({ type: 'blob' })
  const name = (file.name || 'archive.zip').replace(/\.zip$/i, '') + '-extracted.zip'
  return { blob, filename: name, ext: 'zip' }
}
