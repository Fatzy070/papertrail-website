import fontkit, { type Font } from '@pdf-lib/fontkit'
import { FONT_REGISTRY } from './font-registry'
import type { EditorPage, TextElement } from '../types/editor'

type Rect = [number, number, number, number]
type Glyph = { text: string; x: number; y: number; rect: Rect; size: number }
type Program = { bytes: Uint8Array; font: Font; name: string }
type Source = Program & { fallback: Program; glyphs: Glyph[]; pageGlyphs: Glyph[] }
// Source styles survive immutable element edits. Weak keys release fonts when
// the document/history is released; font programs are never document JSON.
const sources = new WeakMap<NonNullable<TextElement['sourceStyle']>, Source>()
const overlaps = (a: Rect, b: Rect) => Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1])
const interior = (r: Rect): Rect => [r[0] + .01, r[1] + .01, r[2] - .01, r[3] - .01]

/** SF UI subsets omit weight/name metadata. Preserve their actual outlines for
 * numeric corrections rather than substituting another font for an entire run. */
export async function registerSourceNumbers(elements: TextElement[], bytes: ArrayBuffer, pages: EditorPage[]) {
  const targets = elements.filter(e => e.rotation === 0 && /\d/.test(e.originalText) && /\.SFUI-/.test(e.sourceStyle?.muPdfFontName ?? ''))
  if (!targets.length) return
  const mupdf = await import('mupdf')
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF()!
  const fallbacks = new Map<string, Program>()
  async function fallbackFor(name: string): Promise<Program> {
    // SF UI's variable weight survives in the full PDF resource name, even
    // when MuPDF reports Regular/isBold=false for a bold instance.
    const weight = /wght([0-9a-f]+)/i.exec(name)
    const bold = weight ? parseInt(weight[1], 16) / 65536 >= 600 : /bold/i.test(name)
    const variant = bold ? 'bold' : 'regular'
    const cached = fallbacks.get(variant)
    if (cached) return cached
    const response = await fetch(FONT_REGISTRY.liberationSans.urls![variant]!)
    if (!response.ok) throw new Error('Unable to load the local numeric fallback font.')
    const data = new Uint8Array(await response.arrayBuffer())
    const program = { bytes: data, font: fontkit.create(data), name: bold ? 'Arimo-Bold' : 'Arimo-Regular' }
    fallbacks.set(variant, program)
    return program
  }
  try {
    for (const info of pages) {
      const local = targets.filter(e => e.pageId === info.id)
      if (!local.length || info.kind !== 'source') continue
      const page = doc.loadPage(info.sourcePageIndex) as import('mupdf').PDFPage
      const structured = page.toStructuredText('')
      const pageGlyphs: Glyph[] = []
      structured.walk({ onChar(text, origin, _font, size, q) {
        pageGlyphs.push({ text, x: origin[0], y: origin[1], size, rect: [
          Math.min(q[0], q[2], q[4], q[6]), Math.min(q[1], q[3], q[5], q[7]),
          Math.max(q[0], q[2], q[4], q[6]), Math.max(q[1], q[3], q[5], q[7]),
        ] })
      } })
      structured.destroy()
      const fonts: Pick<Source, 'bytes' | 'font' | 'name'>[] = []
      page.getObject().get('Resources', 'Font').forEach(resource => {
        const name = resource.get('BaseFont').asName()
        if (!/\.SFUI-/.test(name)) return
        const descendants = resource.get('DescendantFonts')
        const owner = descendants.isArray() ? descendants.get(0) : resource
        const stream = owner.get('FontDescriptor', 'FontFile2')
        if (!stream.isIndirect()) return
        const buffer = stream.readStream()
        const data = buffer.asUint8Array().slice()
        buffer.destroy()
        try {
          const font = fontkit.create(data)
          // Export subsets may omit cmap; retain the original Unicode-capable program.
          if (font.characterSet.length) fonts.push({ name, bytes: data, font })
        } catch { /* Existing fallback handles unsupported fonts. */ }
      })
      for (const element of local) {
        const style = element.sourceStyle!
        const start = pageGlyphs.findIndex(g => Math.abs(g.x - element.x) < .05 && Math.abs(g.y - style.baselineY) < .05)
        if (start < 0) continue
        const glyphs = pageGlyphs.slice(start, start + [...element.originalText].length)
        if (glyphs.map(g => g.text).join('') !== element.originalText) continue
        // Compare real advances, not MuPDF's truncated font name. Distinct SF UI
        // weight subsets can have the same reported name and isBold=false.
        const matching = fonts.filter(({ font }) => glyphs.every(g => font.hasGlyphForCodePoint(g.text.codePointAt(0)!) &&
          Math.abs(font.glyphForCodePoint(g.text.codePointAt(0)!).advanceWidth * g.size / font.unitsPerEm - (g.rect[2] - g.rect[0])) < .03))
        if (matching.length && matching.every(f => f.name === matching[0].name)) {
          // A saved PDF can contain the original program and an equivalent
          // smaller export subset. Prefer the one with more available glyphs.
          matching.sort((a, b) => b.font.characterSet.length - a.font.characterSet.length)
          sources.set(style, { ...matching[0], fallback: await fallbackFor(matching[0].name), glyphs, pageGlyphs })
        }
      }
      page.destroy()
    }
  } finally { doc.destroy() }
}

export function sourceNumberEdit(element: TextElement) {
  const source = element.sourceStyle && sources.get(element.sourceStyle)
  if (!source || element.deleted || element.rotation !== 0 || Object.keys(element.styleOverrides ?? {}).length || element.link ||
      element.x !== element.originalBounds?.x || element.y !== element.originalBounds?.y ||
      Math.abs(element.fontSize - source.glyphs[0].size) > .01) return null
  const text = [...element.text]
  if (text.length !== source.glyphs.length) return null
  const changed = new Set<number>()
  for (let i = 0; i < text.length; i++) {
    if (text[i] === source.glyphs[i].text) continue
    if (!/\d/.test(text[i]) || !/\d/.test(source.glyphs[i].text)) return null
    changed.add(i)
  }
  // Keep each corrected number searchable as a complete text run. Preserve the
  // original positions/font for its unchanged digits as well as changed digits.
  for (const i of changed) {
    for (let j = i - 1; j >= 0 && /[\d,.]/.test(source.glyphs[j].text); j--) changed.add(j)
    for (let j = i + 1; j < text.length && /[\d,.]/.test(source.glyphs[j].text); j++) changed.add(j)
  }
  // Kerning can make character boxes overlap. Include and faithfully redraw
  // any affected characters from the same run; never touch another run.
  for (const i of changed) for (let j = 0; j < source.glyphs.length; j++) {
    if (overlaps(interior(source.glyphs[i].rect), source.glyphs[j].rect)) changed.add(j)
  }
  const selected = [...changed].sort((a, b) => a - b)
  const rects = selected.map(i => interior(source.glyphs[i].rect))
  const kept = source.pageGlyphs.filter(g => !selected.some(i => source.glyphs[i] === g))
  if (rects.some(r => kept.some(g => overlaps(r, g.rect)))) return null
  const glyphs = selected.map(i => {
    const original = source.glyphs[i]
    const program = source.font.hasGlyphForCodePoint(text[i].codePointAt(0)!) ? source : source.fallback
    const glyph = program.font.glyphForCodePoint(text[i].codePointAt(0)!)
    return { ...original, text: text[i], path: glyph.path.toSVG(), scale: original.size / program.font.unitsPerEm,
      bytes: program.bytes, name: program.name, box: glyph.bbox, standardFont: program === source ? undefined : (program.name === 'Arimo-Bold' ? 'Helvetica-Bold' : 'Helvetica') as 'Helvetica-Bold' | 'Helvetica' }
  })
  // A replacement outline must stay within the physical range being replaced.
  if (glyphs.some(g => {
    const box = g.box
    return kept.some(k => overlaps([g.x + box.minX * g.scale, g.y - box.maxY * g.scale, g.x + box.maxX * g.scale, g.y - box.minY * g.scale], k.rect))
  })) return null
  return { bytes: source.bytes, name: source.name, rects, glyphs }
}
