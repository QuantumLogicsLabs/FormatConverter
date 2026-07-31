const KEY = 'fc-favorites'
const MAX = 24

export function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((e) => e && typeof e.from === 'string' && typeof e.to === 'string')
  } catch {
    return []
  }
}

export function isFavorite(from, to) {
  return loadFavorites().some((e) => e.from === from && e.to === to)
}

export function toggleFavorite(from, to) {
  const list = loadFavorites().filter((e) => !(e.from === from && e.to === to))
  const was = loadFavorites().some((e) => e.from === from && e.to === to)
  if (!was) list.unshift({ from, to, at: Date.now() })
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore */
  }
  return !was
}
