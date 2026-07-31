/**
 * Focus trap helpers for modal dialogs (command palette, etc.).
 */
export function getFocusable(root) {
  if (!root) return []
  return [
    ...root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

export function trapTabKey(e, root) {
  if (e.key !== 'Tab' || !root) return
  const nodes = getFocusable(root)
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
