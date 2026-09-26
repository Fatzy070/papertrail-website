/**
 * Central font registry for Papertrail.
 *
 * ONE source of truth for:
 *  - React preview CSS font-family names
 *  - text-measurement canvas font strings
 *  - pdf-lib standard font names
 *  - TTF fetch URLs for custom font embedding
 *
 * Rules:
 *  - Standard PDF fonts (Helvetica, Times, Courier) NEVER need fetching.
 *  - Custom fonts (Inter, Roboto, etc.) are fetched from Google Fonts CDN at export time.
 *  - Bold/Italic fallback: if a variant URL is not available, we fall back to the regular variant.
 */

export type FontVariant = 'regular' | 'bold' | 'italic' | 'boldItalic'

export interface FontEntry {
  /** Human-readable label shown in the UI */
  label: string
  /** CSS font-family value for preview and measurement */
  cssFamily: string
  /** Whether this font uses pdf-lib StandardFonts (no fetching needed) */
  isStandard: boolean
  /**
   * For custom fonts: Google Fonts CDN URLs for each variant.
   * For standard fonts: undefined (use pdf-lib StandardFonts enum values instead).
   */
  urls?: Partial<Record<FontVariant, string>>
}

export type FontId =
  | 'inter'
  | 'roboto'
  | 'openSans'
  | 'montserrat'
  | 'lato'
  | 'helvetica'
  | 'times'
  | 'courier'

/**
 * The canonical font list. Edit this list ONLY to add/remove supported fonts.
 * Do not add separate font lists anywhere else in the codebase.
 */
export const FONT_REGISTRY: Record<FontId, FontEntry> = {
  inter: {
    label: 'Inter',
    cssFamily: 'Inter',
    isStandard: false,
    urls: {
      regular: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
      bold:    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2',
      italic:  'https://fonts.gstatic.com/s/inter/v13/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dphjZ-Ek-_EeA6eUA.woff2',
      boldItalic: 'https://fonts.gstatic.com/s/inter/v13/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dphjZ-Ek-_EeA6eUA.woff2',
    },
  },
  roboto: {
    label: 'Roboto',
    cssFamily: 'Roboto',
    isStandard: false,
    urls: {
      regular:   'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
      bold:      'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2',
      italic:    'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xIIzIXKMny.woff2',
      boldItalic:'https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51TzBic6CsQ.woff2',
    },
  },
  openSans: {
    label: 'Open Sans',
    cssFamily: '"Open Sans"',
    isStandard: false,
    urls: {
      regular:   'https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C24tA.woff2',
      bold:      'https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B24tA.woff2',
      italic:    'https://fonts.gstatic.com/s/opensans/v40/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hbd0Rw.woff2',
      boldItalic:'https://fonts.gstatic.com/s/opensans/v40/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hbd0Rw.woff2',
    },
  },
  montserrat: {
    label: 'Montserrat',
    cssFamily: 'Montserrat',
    isStandard: false,
    urls: {
      regular:   'https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.woff2',
      bold:      'https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459WlhyiTh89Y.woff2',
      italic:    'https://fonts.gstatic.com/s/montserrat/v26/JTUQjIg1_i6t8kCHKm459WxhyyTh89ZNpQ.woff2',
      boldItalic:'https://fonts.gstatic.com/s/montserrat/v26/JTUPjIg1_i6t8kCHKm459WxZYgzz8fZwnCo.woff2',
    },
  },
  lato: {
    label: 'Lato',
    cssFamily: 'Lato',
    isStandard: false,
    urls: {
      regular:   'https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXg.woff2',
      bold:      'https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.woff2',
      italic:    'https://fonts.gstatic.com/s/lato/v24/S6u8w4BMUTPHjxsAXC-v.woff2',
      boldItalic:'https://fonts.gstatic.com/s/lato/v24/S6u_w4BMUTPHjxsI5wq_Gwftx9897g.woff2',
    },
  },
  helvetica: {
    label: 'Helvetica',
    cssFamily: 'Helvetica, Arial, sans-serif',
    isStandard: true,
  },
  times: {
    label: 'Times Roman',
    cssFamily: '"Times New Roman", Times, serif',
    isStandard: true,
  },
  courier: {
    label: 'Courier',
    cssFamily: '"Courier New", Courier, monospace',
    isStandard: true,
  },
}

/** Ordered list of font IDs for use in dropdowns */
export const FONT_ORDER: FontId[] = [
  'inter',
  'roboto',
  'openSans',
  'montserrat',
  'lato',
  'helvetica',
  'times',
  'courier',
]

/**
 * Given a raw fontFamily string (from an element), return the canonical FontId.
 * Fuzzy-matches so that existing elements and PDF-extracted font names still resolve.
 */
export function resolveFontId(fontFamily: string): FontId {
  const f = fontFamily.toLowerCase().replace(/['"]/g, '')
  if (f.includes('inter')) return 'inter'
  if (f.includes('roboto')) return 'roboto'
  if (f.includes('open sans') || f.includes('opensans')) return 'openSans'
  if (f.includes('montserrat')) return 'montserrat'
  if (f.includes('lato')) return 'lato'
  if (f.includes('times') || f.includes('serif')) return 'times'
  if (f.includes('courier') || f.includes('mono')) return 'courier'
  // Default: Helvetica for anything else (includes extracted PDF fonts)
  return 'helvetica'
}

/**
 * Return the CSS font-family string for a given FontId.
 * Use this for React preview styles and canvas measurement.
 */
export function getCssFontFamily(fontId: FontId): string {
  return FONT_REGISTRY[fontId].cssFamily
}

/**
 * Build the CSS @font-face import URL for Google Fonts CDN.
 * Used to inject a <link> for preloading custom fonts in the browser.
 */
export function getGoogleFontsUrl(): string {
  const customFonts = FONT_ORDER.filter((id) => !FONT_REGISTRY[id].isStandard)
  const families = customFonts
    .map((id) => {
      const label = FONT_REGISTRY[id].label
      return `family=${label.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

// ── Per-export font bytes cache ──────────────────────────────────────────────
// Cleared between page loads. Prevents redundant fetches during a single export.

const fontBytesCache = new Map<string, ArrayBuffer>()

/**
 * Fetch TTF bytes for a custom font variant. Results are cached in memory
 * for the lifetime of the page (re-used across multiple elements in one export).
 */
export async function fetchFontBytes(fontId: FontId, variant: FontVariant): Promise<ArrayBuffer | null> {
  const entry = FONT_REGISTRY[fontId]
  if (entry.isStandard) return null // standard fonts don't need fetching

  const url = entry.urls?.[variant] ?? entry.urls?.regular
  if (!url) return null

  const cacheKey = url
  const cached = fontBytesCache.get(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(url)
    const bytes = await response.arrayBuffer()
    fontBytesCache.set(cacheKey, bytes)
    return bytes
  } catch {
    console.warn(`[font-registry] Failed to fetch ${fontId} ${variant} from ${url}`)
    return null
  }
}
