export function parseHexColor(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  return [
    Number.isNaN(red) ? 1 : red,
    Number.isNaN(green) ? 1 : green,
    Number.isNaN(blue) ? 0 : blue
  ]
}

export function rgbToHex(color: [number, number, number] | null | undefined): string {
  if (!color) return '#fef08a' // Default yellow
  const [r, g, b] = color
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Convert EditorElement rect (DOM-like, top-left origin, y increases downwards)
 * to PDF rect (bottom-left origin, y increases upwards).
 * 
 * In pdf-lib, x is from left, y is from bottom.
 */
export function domToPdfRect(x: number, y: number, width: number, height: number, pageHeight: number): [number, number, number, number] {
  // llx, lly, urx, ury
  const llx = x
  const urx = x + width
  const ury = pageHeight - y
  const lly = pageHeight - (y + height)
  return [llx, lly, urx, ury]
}

export function pdfToDomRect(rect: number[], pageHeight: number): { x: number, y: number, width: number, height: number } {
  // rect is [llx, lly, urx, ury]
  const [llx, lly, urx, ury] = rect
  const x = llx
  const width = urx - llx
  const height = ury - lly
  const y = pageHeight - ury
  return { x, y, width, height }
}
