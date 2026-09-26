import { useRef, useEffect } from 'react'
import {
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  StarOff,
  RotateCcw,
} from 'lucide-react'
import { type DocumentMetadata } from '../api/documents.api'

interface DocumentActionsProps {
  document: DocumentMetadata
  filter: string
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onRestore: (document: DocumentMetadata) => void
  onDeletePermanently: (document: DocumentMetadata) => void
  onToggleStar: (document: DocumentMetadata) => void
  onRename: (document: DocumentMetadata) => void
  onDownload: (id: string) => void
  onDelete: (document: DocumentMetadata) => void
}

export function DocumentActions({
  document,
  filter,
  isOpen,
  onToggle,
  onClose,
  onRestore,
  onDeletePermanently,
  onToggleStar,
  onRename,
  onDownload,
  onDelete,
}: DocumentActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, onClose])

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-colors ${
          isOpen ? 'text-slate-700 bg-slate-200/50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/50'
        }`}
        aria-label={`Actions for ${document.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-1 w-44 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none divide-y divide-slate-100 py-1">
          {filter === 'trash' ? (
            <>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                onClick={() => {
                  onClose()
                  onRestore(document)
                }}
              >
                <RotateCcw size={14} /> Restore
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => {
                  onClose()
                  onDeletePermanently(document)
                }}
              >
                <Trash2 size={14} /> Delete permanently
              </button>
            </>
          ) : (
            <>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onClose()
                  onToggleStar(document)
                }}
              >
                {document.isStarred ? <StarOff size={14} className="text-yellow-500" /> : <Star size={14} className="text-slate-400" />} {document.isStarred ? 'Unstar' : 'Star'}
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onClose()
                  onRename(document)
                }}
              >
                <Pencil size={14} className="text-slate-400" /> Rename
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onClose()
                  onDownload(document.id)
                }}
              >
                <Download size={14} className="text-slate-400" /> Download
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => {
                  onClose()
                  onDelete(document)
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
