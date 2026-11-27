import { useMemo } from 'react'
import { useEditorStore } from '../store/editor-store'
import { useSearchStore } from '../store/search-store'
import type { TextElement } from '../types/editor'

export interface SearchResult {
  id: string
  elementId: string
  pageId: string
  pageNumber: number
  startIndex: number
  endIndex: number
}

// Simple normalization: collapse multiple spaces and newlines to single space, trim.
// This is used ONLY for matching, not for rendering or saving.
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').toLowerCase()
}

export function useSearchResults() {
  const query = useSearchStore(s => s.query)
  const isOpen = useSearchStore(s => s.isOpen)
  const elements = useEditorStore(s => s.elements)
  const document = useEditorStore(s => s.document)

  return useMemo(() => {
    if (!isOpen || !query.trim() || !document) return []

    const normalizedQuery = normalizeText(query.trim())
    if (!normalizedQuery) return []

    // 1. Build O(1) lookup maps for page numbers and elements
    const pageNumberById = new Map<string, number>()
    document.pages.forEach((p, idx) => {
      pageNumberById.set(p.id, idx + 1)
    })

    const elementById = new Map<string, TextElement>()
    const searchableElements: TextElement[] = []
    for (const el of elements) {
      if (el.type === 'text' && !el.deleted && el.text) {
        searchableElements.push(el)
        elementById.set(el.id, el)
      }
    }

    // 2. Find matches
    const results: SearchResult[] = []

    for (const el of searchableElements) {
      const normalizedElementText = normalizeText(el.text)
      const pageNumber = pageNumberById.get(el.pageId) ?? 999
      let startIndex = 0
      
      while (startIndex < normalizedElementText.length) {
        const matchIndex = normalizedElementText.indexOf(normalizedQuery, startIndex)
        if (matchIndex === -1) break
        
        results.push({
          id: `${el.id}-${matchIndex}`,
          elementId: el.id,
          pageId: el.pageId,
          pageNumber, // 1-indexed
          startIndex: matchIndex,
          endIndex: matchIndex + normalizedQuery.length
        })

        // Move past this match to find the next one
        startIndex = matchIndex + normalizedQuery.length
      }
    }

    // 3. Sort by page order, then roughly Y (top to bottom), then X (left to right)
    results.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber
      
      const elA = elementById.get(a.elementId)
      const elB = elementById.get(b.elementId)
      if (!elA || !elB) return 0
      
      // If Y difference is significant (e.g., > 10px, different line), sort by Y
      if (Math.abs(elA.y - elB.y) > 10) {
        return elA.y - elB.y
      }
      // Otherwise sort by X
      return elA.x - elB.x
    })

    return results
  }, [query, isOpen, elements, document])
}
