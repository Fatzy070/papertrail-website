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

    // 1. Get all eligible text elements
    const searchableElements = elements.filter((el): el is TextElement => {
      if (el.type !== 'text') return false
      if (el.deleted) return false
      // If it's a PDF text that is edited, el.text contains the edit.
      // If it's user text, el.text contains the user text.
      // If it's unedited PDF text, el.text contains the original text.
      return !!el.text
    })

    // 2. Find matches
    const results: SearchResult[] = []

    for (const el of searchableElements) {
      const normalizedElementText = normalizeText(el.text)
      let startIndex = 0
      
      while (startIndex < normalizedElementText.length) {
        const matchIndex = normalizedElementText.indexOf(normalizedQuery, startIndex)
        if (matchIndex === -1) break

        const pageIndex = document.pages.findIndex(p => p.id === el.pageId)
        
        results.push({
          id: `${el.id}-${matchIndex}`,
          elementId: el.id,
          pageId: el.pageId,
          pageNumber: pageIndex >= 0 ? pageIndex + 1 : 999, // 1-indexed
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
      
      const elA = searchableElements.find(e => e.id === a.elementId)!
      const elB = searchableElements.find(e => e.id === b.elementId)!
      
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
