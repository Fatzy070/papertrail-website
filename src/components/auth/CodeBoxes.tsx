import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'

export function CodeBoxes({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  
  useEffect(() => { 
    refs.current[0]?.focus() 
  }, [])
  
  const digits = value.padEnd(6, ' ').slice(0, 6).split('').map((digit) => digit.trim())

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const newDigits = [...digits]
      
      if (digits[index]) {
        newDigits[index] = ''
        onChange(newDigits.join(''))
      } else if (index > 0) {
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        refs.current[index - 1]?.focus()
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (index > 0) refs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (index < 5) refs.current[index + 1]?.focus()
    }
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const inputVal = event.target.value.replace(/\D/g, '')
    
    if (!inputVal) {
      if (digits[index]) {
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join(''))
      }
      return
    }

    const nativeEvent = event.nativeEvent as InputEvent
    let isPaste = false
    
    if (nativeEvent.inputType === 'insertFromPaste' || nativeEvent.inputType === 'insertReplacementText') {
      isPaste = true
    } else if (inputVal.length > 1 && !digits[index]) {
      isPaste = true
    } else if (inputVal.length > 2) {
      isPaste = true
    }

    if (isPaste) {
      const newDigits = [...digits]
      for (let i = 0; i < inputVal.length; i++) {
        if (index + i < 6) {
          newDigits[index + i] = inputVal[i]
        }
      }
      onChange(newDigits.join(''))
      const nextFocus = Math.min(5, index + inputVal.length)
      refs.current[nextFocus]?.focus()
      return
    }

    // Normal typing behavior
    const lastChar = inputVal[inputVal.length - 1]
    const newDigits = [...digits]
    newDigits[index] = lastChar
    
    onChange(newDigits.join(''))
    if (index < 5) refs.current[index + 1]?.focus()
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pastedText = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pastedText) return
    
    const newDigits = [...digits]
    for (let i = 0; i < pastedText.length; i++) {
      if (index + i < 6) {
        newDigits[index + i] = pastedText[i]
      }
    }
    
    onChange(newDigits.join(''))
    const nextFocus = Math.min(5, index + pastedText.length)
    refs.current[nextFocus]?.focus()
  }

  return (
    <div className="code-boxes" role="group" aria-label="Six digit verification code">
      {digits.map((digit, index) => (
        <input 
          key={index} 
          ref={(element) => { refs.current[index] = element }} 
          className="code-box" 
          aria-label={`Verification digit ${index + 1}`} 
          type="text"
          inputMode="numeric" 
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={digit} 
          disabled={disabled} 
          onChange={(event) => handleChange(index, event)} 
          onKeyDown={(event) => handleKeyDown(index, event)} 
          onPaste={(event) => handlePaste(index, event)} 
        />
      ))}
    </div>
  )
}
