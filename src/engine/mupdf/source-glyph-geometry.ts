import type { PDFPage, Rect } from 'mupdf'

export interface SourceTextTarget {
  text: string
  x: number
  baselineY: number
  width: number
}

/** Resolve the original character range, never the edited text or its new width. */
export function sourceGlyphRect(page: PDFPage, target: SourceTextTarget): Rect {
  const glyphs: { text: string; x: number; baseline: number; rect: Rect }[] = []
  const structured = page.toStructuredText('')
  structured.walk({
    onChar(text, origin, _font, _size, quad) {
      glyphs.push({ text, x: origin[0], baseline: origin[1], rect: [
        Math.min(quad[0], quad[2], quad[4], quad[6]),
        Math.min(quad[1], quad[3], quad[5], quad[7]),
        Math.max(quad[0], quad[2], quad[4], quad[6]),
        Math.max(quad[1], quad[3], quad[5], quad[7]),
      ] })
    },
  })
  structured.destroy()
  const matches: { start: number; end: number; rect: Rect }[] = []
  const savedMatches: typeof matches = []
  for (let start = 0; start < glyphs.length; start++) {
    const first = glyphs[start]
    if (Math.abs(first.x - target.x) > 0.5 || Math.abs(first.baseline - target.baselineY) > 0.5) continue
    let text = ''
    for (let end = start; end < glyphs.length; end++) {
      const glyph = glyphs[end]
      if (Math.abs(glyph.baseline - target.baselineY) > 0.5) break
      text += glyph.text
      const selected = glyphs.slice(start, end + 1)
      const rect: Rect = [
        Math.min(...selected.map(g => g.rect[0])), Math.min(...selected.map(g => g.rect[1])),
        Math.max(...selected.map(g => g.rect[2])), Math.max(...selected.map(g => g.rect[3])),
      ]
      const fitsMinimumHitBox = target.width === 4 && rect[2] - rect[0] <= 4
      if (Math.abs(rect[2] - (target.x + target.width)) < 0.5 || fitsMinimumHitBox) {
        if (text === target.text) matches.push({ start, end, rect })
        // Saving replaces the PDF bytes while the live overlay retains its
        // extraction metadata. A same-extent saved replacement is still the
        // same physical range. Require BOTH boundaries, not just overlap.
        else if (Math.abs(first.x - target.x) < 0.05 && (fitsMinimumHitBox || Math.abs(rect[2] - (target.x + target.width)) < 0.05)) savedMatches.push({ start, end, rect })
      }
      if (text === target.text && fitsMinimumHitBox) break
      if (rect[2] >= target.x + target.width - 0.05) break
    }
  }
  const candidates = matches.length ? matches : savedMatches
  if (candidates.length !== 1) throw new Error('Cannot safely locate the original text for redaction.')
  const { start, end, rect } = candidates[0]
  // MuPDF removes an entire glyph when its box intersects the annotation. An
  // interior rectangle avoids floating-point contact with adjacent glyph boxes;
  // it does not leave the outside of the selected glyph painted in the PDF.
  const inset = 0.01
  const result: Rect = [rect[0] + inset, rect[1] + inset, rect[2] - inset, rect[3] - inset]
  if (result[0] >= result[2] || result[1] >= result[3] || glyphs.some((g, i) =>
    (i < start || i > end) &&
    Math.min(g.rect[2], result[2]) > Math.max(g.rect[0], result[0]) &&
    Math.min(g.rect[3], result[3]) > Math.max(g.rect[1], result[1])
  )) throw new Error('Cannot safely redact this text without affecting neighboring text.')
  return result
}
