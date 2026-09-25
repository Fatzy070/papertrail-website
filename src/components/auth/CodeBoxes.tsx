import { useEffect, useRef } from 'react'

export function CodeBoxes({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => { refs.current[0]?.focus() }, [])
  const digits = value.padEnd(6, ' ').slice(0, 6).split('').map((digit) => digit.trim())
  function update(index: number, input: string) {
    const cleaned = input.replace(/\D/g, '')
    if (!cleaned) return
    const next = digits.map((digit, position) => position === index ? cleaned[0] : digit).join('').trim()
    onChange(next)
    if (index < 5) refs.current[index + 1]?.focus()
  }
  return <div className="code-boxes" role="group" aria-label="Six digit verification code">{digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element }} className="code-box" aria-label={`Verification digit ${index + 1}`} inputMode="numeric" maxLength={1} value={digit} disabled={disabled} onChange={(event) => update(index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus() }} onPaste={(event) => { event.preventDefault(); onChange(event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)); refs.current[Math.min(5, event.clipboardData.getData('text').length - 1)]?.focus() }} />)}</div>
}
