import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useSearchStore } from '../../store/search-store'
import { useSearchResults } from '../../hooks/use-search-results'

export function FindBar() {
  const isOpen = useSearchStore(s => s.isOpen)
  const query = useSearchStore(s => s.query)
  const activeMatchIndex = useSearchStore(s => s.activeMatchIndex)
  const setOpen = useSearchStore(s => s.setOpen)
  const setQuery = useSearchStore(s => s.setQuery)
  const setActiveMatchIndex = useSearchStore(s => s.setActiveMatchIndex)
  const nextMatch = useSearchStore(s => s.nextMatch)
  const prevMatch = useSearchStore(s => s.prevMatch)

  const results = useSearchResults()
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isOpen])

  // Handle active match bounding/scrolling
  useEffect(() => {
    if (!isOpen) return
    
    // Auto-select first result if query changes and results come in
    if (results.length > 0 && activeMatchIndex === -1) {
      setActiveMatchIndex(0)
    }

    if (results.length === 0 && activeMatchIndex !== -1) {
      setActiveMatchIndex(-1)
    }

    const activeResult = results[activeMatchIndex]
    if (activeResult) {
      // Find the text element DOM node
      const el = window.document.querySelector(`[data-element-id="${activeResult.elementId}"]`)
      if (el) {
        // Scroll the element into view (center it)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        // Fallback: try scrolling the page if element isn't in DOM yet
        const pageEl = window.document.getElementById(`pdf-page-${activeResult.pageNumber - 1}`)
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }, [isOpen, results, activeMatchIndex, setActiveMatchIndex])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        prevMatch(results.length)
      } else {
        nextMatch(results.length)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="sticky top-4 z-40 w-full h-0 flex justify-end px-4 pointer-events-none" style={{ marginTop: '16px' }}>
      {!isOpen ? (
        <button
          onClick={() => setOpen(true)}
          className="flex gap-2 border border-gray-600 items-center py-3 px-4 bg-white rounded-md shadow-lg text-sm text-gray-700 pointer-events-auto hover:bg-gray-50 transition-colors"
          title="Search document (Ctrl+F)"
          aria-label="Open search"
        >
          <Search size={14} className="text-gray-500" />
          <span>Search</span>
        </button>
      ) : (
        <div 
          className="flex items-center bg-white shadow-lg rounded-md border border-gray-200 p-2 text-sm text-gray-700 pointer-events-auto"
          style={{ width: '300px' }}
        >
          <div className="flex-1 flex items-center bg-gray-50 rounded px-2 py-1 border border-gray-300">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search text..."
              className="bg-transparent border-none outline-none flex-1 w-full text-sm"
              aria-label="Search query"
            />
          </div>

          <div className="ml-3 flex items-center space-x-2 text-xs text-gray-500 whitespace-nowrap">
            {query.trim() && (
              <span>
                {results.length > 0 ? activeMatchIndex + 1 : 0} of {results.length}
              </span>
            )}
            
            <button
              onClick={() => prevMatch(results.length)}
              disabled={results.length === 0}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
              aria-label="Previous match"
            >
              ↑
            </button>
            <button
              onClick={() => nextMatch(results.length)}
              disabled={results.length === 0}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
              aria-label="Next match"
            >
              ↓
            </button>
            
            <div className="w-px h-4 bg-gray-300 mx-1" />
            
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
              aria-label="Close find"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
