import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react-dom'

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function ColorPicker({ color, onChange, disabled }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles } = useFloating({
    placement: 'left-start',
    middleware: [offset(10), flip(), shift({ padding: 10 })],
    whileElementsMounted: autoUpdate,
  })
  
  const { setReference, setFloating, reference, floating } = refs

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        floating.current &&
        !(floating.current as HTMLElement).contains(event.target as Node) &&
        reference.current &&
        'contains' in reference.current &&
        !(reference.current as HTMLElement).contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, floating, reference])

  return (
    <div className="color-picker-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        ref={setReference}
        type="button"
        className="color-preview-btn"
        style={{ 
          backgroundColor: color, 
          width: '43px', 
          height: '43px', 
          borderRadius: '10px', 
          border: '1px solid var(--border-strong)',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-label="Choose color"
        disabled={disabled}
      />
      <input
        type="text"
        value={color}
        className="text-input"
        style={{ flex: 1, fontFamily: 'monospace' }}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />

      {isOpen && !disabled && (
        <div
          ref={setFloating}
          style={{ ...floatingStyles, zIndex: 1000, background: 'var(--surface)', padding: '12px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
          className="color-popover"
        >
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
