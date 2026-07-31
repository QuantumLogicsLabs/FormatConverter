import JSZip from 'jszip'

export default async function zipFiles(files, options = {}, onProgress = () => {}) {
  if (!files?.length) throw new Error('Choose files to zip.')
  const zip = new JSZip()
  const used = new Set()
  onProgress({ stage: 'encode', page: 0, total: files.length })
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    let name = f.name || `file-${i + 1}`
    for (let n = 2; used.has(name); n++) {
      name = (f.name || `file-${i + 1}`).replace(/(\.[^.]+)?$/, `-${n}$1`)
    }
    used.add(name)
    zip.file(name, f)
    onProgress({ stage: 'encode', page: i + 1, total: files.length })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, filename: options.filename || 'files.zip', ext: 'zip' }
}
