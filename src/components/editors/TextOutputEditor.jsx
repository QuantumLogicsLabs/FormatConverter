import { useEffect, useState } from 'react'

/** Direct edit of text-like output blobs (no reconvert). */
export default function TextOutputEditor({ initialText = '', onChange }) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    setText(initialText)
  }, [initialText])

  return (
    <div className="editor-pane text-output-editor" data-editor="output-text">
      <div className="editor-pane-head">
        <span className="meta">Edit output text</span>
        <button
          type="button"
          className="btn"
          onClick={() => onChange?.(text)}
        >
          Apply to download
        </button>
      </div>
      <textarea
        className="output editor-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Output text"
      />
    </div>
  )
}
