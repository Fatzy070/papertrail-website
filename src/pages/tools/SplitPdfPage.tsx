import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, Download, FileText, Save, UploadCloud } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { Link } from 'react-router-dom'
import { useToastStore } from '../../store/toast-store'
import { useUploadDocument } from '../../hooks/use-documents'

const maxBytes = 50 * 1024 * 1024

export function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [range, setRange] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<File | null>(null)
  
  const showToast = useToastStore((state) => state.show)
  const upload = useUploadDocument()

  const loadPdfInfo = async (f: File) => {
    try {
      const arrayBuffer = await f.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      setPageCount(pdfDoc.getPageCount())
      setFile(f)
      setResult(null)
    } catch (e) {
      console.error(e)
      showToast('Could not read PDF.', 'error')
    }
  }

  const dropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxBytes,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        void loadPdfInfo(acceptedFiles[0])
      }
    },
    onDropRejected: () => showToast('Choose a PDF no larger than 50 MB.', 'error'),
  })

  const parseRange = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>()
    const parts = rangeStr.split(',')
    
    for (const part of parts) {
      const p = part.trim()
      if (!p) continue
      
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(s => parseInt(s.trim(), 10))
        if (!isNaN(start) && !isNaN(end) && start <= end && start >= 1 && end <= maxPages) {
          for (let i = start; i <= end; i++) pages.add(i - 1)
        } else {
          throw new Error(`Invalid range: ${p}`)
        }
      } else {
        const page = parseInt(p, 10)
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          pages.add(page - 1)
        } else {
          throw new Error(`Invalid page number: ${p}`)
        }
      }
    }
    
    return Array.from(pages).sort((a, b) => a - b)
  }

  const handleSplit = async () => {
    if (!file) return
    
    let indices: number[]
    try {
      indices = parseRange(range, pageCount)
      if (indices.length === 0) {
        showToast('Please enter a valid page range.', 'error')
        return
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Invalid page range.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      
      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(srcDoc, indices)
      copiedPages.forEach((page) => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      const newFile = new File([pdfBytes as unknown as BlobPart], `split_${file.name}`, { type: 'application/pdf' })
      setResult(newFile)
      showToast('PDF split successfully!', 'success')
    } catch (e) {
      console.error(e)
      showToast('An error occurred while splitting the PDF.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const url = URL.createObjectURL(result)
    const a = document.createElement('a')
    a.href = url
    a.download = result.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSaveToDocuments = async () => {
    if (!result || upload.isPending) return
    try {
      await upload.mutateAsync(result)
      showToast('Saved to My Documents.', 'success')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Upload failed.', 'error')
    }
  }

  return (
    <div className="workspace-content tool-workflow">
      <header className="mb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-4 transition-colors">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] mb-1">Split / Extract Pages</h1>
        <p className="text-[var(--muted)] text-sm">Create a new PDF from selected pages.</p>
      </header>

      {!file && (
        <div
          {...dropzone.getRootProps()}
          className={`relative flex flex-col items-center justify-center p-10 mb-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
            dropzone.isDragActive
              ? 'border-blue-500 bg-[var(--primary-soft)] ring-4 ring-blue-500/20'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-blue-400 hover:bg-[var(--surface-muted)] hover:shadow-sm'
          }`}
        >
          <input {...dropzone.getInputProps()} />
          <div className="bg-[var(--primary-soft)] text-[var(--primary)] p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud size={24} />
          </div>
          <div className="text-base text-[var(--text)] text-center mb-1">
            <strong>Drop a PDF here</strong> <span className="font-normal text-[var(--muted)]">or click to browse</span>
          </div>
          <span className="text-xs font-medium text-[var(--muted)]">PDF files up to 50 MB</span>
        </div>
      )}

      {file && !result && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-6 mb-8 max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-[var(--primary-soft)] p-2 rounded-lg text-[var(--primary)]">
                <FileText size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--text)] truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {pageCount} page{pageCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null)
                setRange('')
              }}
              className="text-xs font-medium text-[var(--primary)] hover:text-blue-800"
            >
              Change file
            </button>
          </div>

          <div className="mb-6">
            <label htmlFor="range-input" className="block text-sm font-medium text-[var(--text)] mb-2">
              Pages to extract
            </label>
            <input
              id="range-input"
              type="text"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 1, 3-5, 8"
              className="w-full px-4 py-2 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Enter page numbers and/or ranges separated by commas. Max page is {pageCount}.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSplit}
              disabled={isProcessing || !range.trim()}
              className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? 'Extracting...' : 'Extract Pages'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} />
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Extraction Complete!</h2>
          <p className="text-emerald-700 text-sm mb-8">Your new PDF has been created successfully.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--surface)] border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-sm font-medium rounded-xl shadow-sm transition-all"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={handleSaveToDocuments}
              disabled={upload.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <Save size={16} />
              {upload.isPending ? 'Saving...' : 'Save to My Documents'}
            </button>
          </div>
          
          <button 
            onClick={() => {
              setResult(null)
              setFile(null)
              setRange('')
            }}
            className="mt-6 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
