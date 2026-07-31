import { useEffect, useState } from 'react'

/** Editable text / markdown / html source with Apply → re-convert. */
export default function SourceTextEditor({
  initialText = '',
  label = 'Source',
  applying = false,
  onApply,
}) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    setText(initialText)
  }, [initialText])

  return (
    <div className="editor-pane source-text-editor" data-editor="source-text">
      <div className="editor-pane-head">
        <span className="meta">{label}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={applying}
          onClick={() => onApply?.(text)}
        >
          {applying ? 'Updating…' : 'Apply & refresh preview'}
        </button>
      </div>
      <textarea
        className="output editor-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label={label}
      />
    </div>
  )
}
