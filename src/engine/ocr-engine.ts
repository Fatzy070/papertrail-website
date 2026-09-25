import type { TextElement } from '../types/editor'

export async function recognizePage(): Promise<TextElement[]> {
  // OCR is intentionally deferred until native text extraction proves insufficient.
  return []
}
