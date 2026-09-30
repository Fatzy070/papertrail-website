import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
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
    <div className="editor-search">
      {!isOpen ? (
        <button
          onClick={() => setOpen(true)}
          className="toolbar-button"
          title="Search document (Ctrl+F)"
          aria-label="Open search"
        >
          <Search size={16} />
          <span>Search</span>
        </button>
      ) : (
        <div 
          className="editor-search-panel"
        >
          <div className="editor-search-input">
            <Search className="w-4 h-4 text-[var(--muted)] mr-2 shrink-0" />
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

          <div className="editor-search-actions">
            {query.trim() && (
              <span>
                {results.length > 0 ? activeMatchIndex + 1 : 0} of {results.length}
              </span>
            )}
            
            <button
              onClick={() => prevMatch(results.length)}
              disabled={results.length === 0}
              className="icon-button"
              aria-label="Previous match"
            >
              ↑
            </button>
            <button
              onClick={() => nextMatch(results.length)}
              disabled={results.length === 0}
              className="icon-button"
              aria-label="Next match"
            >
              ↓
            </button>
            
            <div className="editor-search-divider" />
            
            <button
              onClick={() => setOpen(false)}
              className="icon-button"
              aria-label="Close find"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
