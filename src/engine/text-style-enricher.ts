/**
 * text-style-enricher.ts
 *
 * Engine helper that enriches PDF.js TextElements with more reliable font
 * metadata extracted from MuPDF StructuredText.
 *
 * Architecture:
 *  - PDF.js remains the authoritative source for geometry, baseline, and text.
 *  - MuPDF is used ONLY to supply better font name / bold / italic metadata.
 *  - Matching is conservative: only apply MuPDF data when exactly one span
 *    candidate passes all geometric and content checks.
 *
 * This module is engine-layer only. No React imports or store access.
 */

import * as mupdf from 'mupdf'
import { normalizePdfFontName } from './font-registry'
import type { TextElement, EditorPage } from '../types/editor'

// ─── Internal types ──────────────────────────────────────────────────────────

interface MuPdfSpan {
  pageIndex: number
  /** Bounding box in MuPDF page-space (top-left origin, points) */
  x0: number
  y0: number
  x1: number
  y1: number
  /** Baseline Y of the first character in this span (MuPDF origin.y) */
  baselineY: number
  /** Character content of the span */
  text: string
  /** Font metadata from MuPDF */
  fontName: string
  isBold: boolean
  isItalic: boolean
  isMono: boolean
  isSerif: boolean
  fontSize: number
  color: string
}

function mupdfColorToHex(color: number[]): string {
  if (!color || color.length === 0) return '#000000'

  let r: number, g: number, b: number

  if (color.length === 1) {
    // Grayscale
    r = g = b = Math.round(color[0] * 255)
  } else if (color.length === 3) {
    // RGB
    r = Math.round(color[0] * 255)
    g = Math.round(color[1] * 255)
    b = Math.round(color[2] * 255)
  } else if (color.length === 4) {
    // CMYK
    const c = color[0]
    const m = color[1]
    const y = color[2]
    const k = color[3]
    r = Math.round(255 * (1 - c) * (1 - k))
    g = Math.round(255 * (1 - m) * (1 - k))
    b = Math.round(255 * (1 - y) * (1 - k))
  } else {
    // Fallback for unknown color spaces
    return '#000000'
  }

  // Ensure bounds
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

// ─── MuPDF span extraction ────────────────────────────────────────────────────

/**
 * Walk MuPDF StructuredText for all pages and collect per-character span
 * data, grouping consecutive characters that share the same font.
 */
export function extractMuPdfSpans(pdfBytes: ArrayBuffer | Uint8Array): MuPdfSpan[] {
  const spans: MuPdfSpan[] = []

  try {
    const baseDoc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
    const doc = baseDoc.asPDF()
    if (!doc) return spans

    const pageCount = doc.countPages()

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = doc.loadPage(pageIndex) as mupdf.PDFPage
        const structuredText = page.toStructuredText('preserve-spans')


        // Accumulate characters into spans sharing the same font
        let currentSpan: {
          fontName: string
          isBold: boolean
          isItalic: boolean
          isMono: boolean
          isSerif: boolean
          fontSize: number
          color: string
          chars: string[]
          x0: number
          y0: number
          x1: number
          y1: number
          baselineY: number
        } | null = null

        const flushSpan = () => {
          if (currentSpan && currentSpan.chars.length > 0) {
            spans.push({
              pageIndex,
              x0: currentSpan.x0,
              y0: currentSpan.y0,
              x1: currentSpan.x1,
              y1: currentSpan.y1,
              baselineY: currentSpan.baselineY,
              text: currentSpan.chars.join(''),
              fontName: currentSpan.fontName,
              isBold: currentSpan.isBold,
              isItalic: currentSpan.isItalic,
              isMono: currentSpan.isMono,
              isSerif: currentSpan.isSerif,
              fontSize: currentSpan.fontSize,
              color: currentSpan.color,
            })
          }
          currentSpan = null
        }

        structuredText.walk({
          onChar(c: string, origin: [number, number], font: mupdf.Font, size: number, quad: number[], color: number[]) {
            const fontName = font.getName()
            const isBold = font.isBold()
            const isItalic = font.isItalic()
            const hexColor = mupdfColorToHex(color)

            // Flush when font changes
            if (
              currentSpan &&
              (currentSpan.fontName !== fontName ||
                currentSpan.isBold !== isBold ||
                currentSpan.isItalic !== isItalic ||
                currentSpan.color !== hexColor ||
                Math.abs(currentSpan.fontSize - size) > 0.5)
            ) {
              flushSpan()
            }

            // Compute bounding box from quad (4 points: ul, ur, ll, lr in MuPDF)
            const qx0 = Math.min(quad[0], quad[2], quad[4], quad[6])
            const qy0 = Math.min(quad[1], quad[3], quad[5], quad[7])
            const qx1 = Math.max(quad[0], quad[2], quad[4], quad[6])
            const qy1 = Math.max(quad[1], quad[3], quad[5], quad[7])

            if (!currentSpan) {
              currentSpan = {
                fontName,
                isBold,
                isItalic,
                isMono: font.isMono(),
                isSerif: font.isSerif(),
                fontSize: size,
                color: hexColor,
                chars: [],
                x0: qx0,
                y0: qy0,
                x1: qx1,
                y1: qy1,
                baselineY: origin[1],
              }
            } else {
              // Extend bounding box
              currentSpan.x0 = Math.min(currentSpan.x0, qx0)
              currentSpan.y0 = Math.min(currentSpan.y0, qy0)
              currentSpan.x1 = Math.max(currentSpan.x1, qx1)
              currentSpan.y1 = Math.max(currentSpan.y1, qy1)
            }
            currentSpan.chars.push(c)
          },
          endLine() { flushSpan() },
          endTextBlock() { flushSpan() },
        })

        flushSpan()
    }

  } catch (err) {
    console.warn('[text-style-enricher] Failed to extract MuPDF spans:', err)
  }

  return spans
}

// ─── Geometric matching ───────────────────────────────────────────────────────

/**
 * Compute the overlap area between two axis-aligned rectangles.
 * Returns 0 if there is no overlap.
 */
function overlapArea(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx0: number, by0: number, bx1: number, by1: number,
): number {
  const ix0 = Math.max(ax0, bx0)
  const iy0 = Math.max(ay0, by0)
  const ix1 = Math.min(ax1, bx1)
  const iy1 = Math.min(ay1, by1)
  if (ix1 <= ix0 || iy1 <= iy0) return 0
  return (ix1 - ix0) * (iy1 - iy0)
}

/**
 * Returns true if the MuPDF span text is "compatible" with the PDF.js element
 * text. We do a relaxed check: one must be a substring of the other, or they
 * share at least 50% of their shorter string as a common prefix/substring.
 */
function textCompatible(pdfJsText: string, muPdfText: string): boolean {
  const a = pdfJsText.trim()
  const b = muPdfText.trim()
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  // Partial overlap: at least 3 chars and at least 40% of the shorter
  const shorter = a.length < b.length ? a : b
  if (shorter.length < 3) return false
  const minLen = Math.ceil(shorter.length * 0.4)
  for (let i = 0; i <= a.length - minLen; i++) {
    if (b.includes(a.substring(i, i + minLen))) return true
  }
  return false
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich an array of PDF.js TextElements with MuPDF font metadata.
 *
 * - Extracts all StructuredText spans from MuPDF (once, for all pages).
 * - For each TextElement that is a source PDF element, finds the best-matching
 *   MuPDF span using geometric overlap + text + font-size signals.
 * - Applies MuPDF font metadata to element.sourceStyle ONLY when exactly one
 *   candidate span passes all confidence checks.
 * - Never overwrites baselineY (it comes from PDF.js transform[5] and must be
 *   preserved).
 *
 * @param elements  Array of TextElements to enrich (mutated in place)
 * @param pdfBytes  Raw bytes of the original PDF
 * @param pages     Editor pages (used to map pageId → zero-based page index)
 * @returns         The same array (mutated), for convenience
 */
export async function enrichTextElementsWithMuPDF(
  elements: TextElement[],
  pdfBytes: ArrayBuffer,
  pages: EditorPage[],
): Promise<TextElement[]> {
  let spans: MuPdfSpan[]
  try {
    spans = extractMuPdfSpans(pdfBytes)
  } catch (err) {
    console.warn('[text-style-enricher] MuPDF span extraction failed — skipping enrichment:', err)
    return elements
  }

  if (spans.length === 0) return elements

  // Build a fast lookup: pageIndex → spans
  const spansByPage = new Map<number, MuPdfSpan[]>()
  for (const span of spans) {
    if (!spansByPage.has(span.pageIndex)) spansByPage.set(span.pageIndex, [])
    spansByPage.get(span.pageIndex)!.push(span)
  }

  // Build pageId → pageIndex map
  const pageIndexById = new Map<string, number>()
  for (const page of pages) {
    if (page.kind === 'source') {
      pageIndexById.set(page.id, page.sourcePageIndex)
    }
  }

  for (const el of elements) {
    // Only enrich source PDF elements that haven't been edited/deleted
    if (el.type !== 'text' || el.source !== 'pdf') continue
    if (!el.sourceStyle) continue

    const pageIndex = pageIndexById.get(el.pageId)
    if (pageIndex === undefined) continue

    const pageSpans = spansByPage.get(pageIndex)
    if (!pageSpans || pageSpans.length === 0) continue

    // PDF.js element bounding box in page-space (top-down origin)
    const elX0 = el.x
    const elY0 = el.y
    const elX1 = el.x + el.width
    const elY1 = el.y + el.height
    const elArea = el.width * el.height

    // MuPDF page uses top-down origin same as Papertrail's canonical coords.
    // Find all candidate spans that overlap this element's bounding box.
    const candidates: Array<{ span: MuPdfSpan; score: number }> = []

    for (const span of pageSpans) {
      // 1. Geometric overlap (primary signal)
      const overlap = overlapArea(elX0, elY0, elX1, elY1, span.x0, span.y0, span.x1, span.y1)
      if (overlap <= 0) continue

      const spanArea = (span.x1 - span.x0) * (span.y1 - span.y0)
      const minArea = Math.min(elArea, spanArea)
      if (minArea <= 0) continue

      // Overlap must be at least 40% of the smaller of the two boxes
      const overlapRatio = overlap / minArea
      if (overlapRatio < 0.4) continue

      // 2. Font size must be similar (within 3pt)
      if (Math.abs(span.fontSize - el.fontSize) > 3) continue

      // 3. Text content must be compatible (relaxed)
      if (!textCompatible(el.text, span.text)) continue

      // Score = overlap ratio (higher is better)
      candidates.push({ span, score: overlapRatio })
    }

    // Confidence threshold: exactly one candidate must survive, or all surviving candidates
    // must completely agree on font metadata (this happens when PDF.js merges words but MuPDF doesn't).
    if (candidates.length === 0) continue

    const span = candidates[0].span
    if (candidates.length > 1) {
      // Check if all candidates agree on the font metadata
      const first = candidates[0].span
      const allAgree = candidates.every(c => 
        c.span.fontName === first.fontName &&
        c.span.isBold === first.isBold &&
        c.span.isItalic === first.isItalic
      )
      
      if (!allAgree) {
        continue // Ambiguous font matching
      }
      // If they all agree, it's safe to use the first one's metadata
    }

    const normalizedFontName = normalizePdfFontName(span.fontName)

    // Enrich sourceStyle — never overwrite baselineY
    el.sourceStyle = {
      ...el.sourceStyle,
      muPdfFontName: span.fontName,
      normalizedFontName,
      isBold: span.isBold,
      isItalic: span.isItalic,
      isMono: span.isMono,
      isSerif: span.isSerif,
      color: span.color,
    }
  }

  return elements
}
