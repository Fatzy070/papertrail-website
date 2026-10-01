import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link2 } from 'lucide-react'

interface LinkModalProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  initialUrl: string
  onApply: (text: string, url: string) => void
}

export function LinkModal({ isOpen, onClose, initialText, initialUrl, onApply }: LinkModalProps) {
  const [text, setText] = useState(initialText)
  const [url, setUrl] = useState(initialUrl)
  
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(initialText)
      setUrl(initialUrl)
    }
  }, [isOpen, initialText, initialUrl])

  if (!isOpen) return null

  const handleApply = () => {
    let finalUrl = url.trim()
    if (!finalUrl) {
      alert('URL cannot be empty')
      return
    }

    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`
    }

    onApply(text, finalUrl)
    onClose()
  }

  return createPortal(
    <div className="link-modal-overlay fixed inset-0 bg-black/20 flex items-center justify-center z-[1000]">
      <div className="link-modal-content bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 w-[320px] shadow-lg flex flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <Link2 size={16} /> Add link
        </div>
        
        <label className="field-label flex flex-col gap-1">
          Text
          <input 
            type="text" 
            className="text-input" 
            value={text} 
            onChange={e => setText(e.target.value)} 
          />
        </label>
        
        <label className="field-label flex flex-col gap-1">
          URL
          <input 
            type="url" 
            className="text-input" 
            placeholder="https://example.com"
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleApply()}
          />
        </label>
        
        <div className="flex justify-end gap-2 mt-1">
          <button className="toolbar-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={handleApply}>Add link</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
