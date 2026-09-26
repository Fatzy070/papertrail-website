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
    <div className="link-modal-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="link-modal-content" style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        width: '320px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--foreground)' }}>
          <Link2 size={16} /> Add link
        </div>
        
        <label className="field-label" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Text
          <input 
            type="text" 
            className="text-input" 
            value={text} 
            onChange={e => setText(e.target.value)} 
          />
        </label>
        
        <label className="field-label" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button className="toolbar-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={handleApply}>Add link</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
