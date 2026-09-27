import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileText, Save, Trash2, UploadCloud } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { Link } from 'react-router-dom'
import { useToastStore } from '../../store/toast-store'
import { useUploadDocument } from '../../hooks/use-documents'

const maxBytes = 50 * 1024 * 1024

export function MergePdfPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<File | null>(null)
  const showToast = useToastStore((state) => state.show)
  const upload = useUploadDocument()

  const dropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxBytes,
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles])
      setResult(null)
    },
    onDropRejected: () => showToast('Choose PDFs no larger than 50 MB.', 'error'),
  })

  const moveUp = (index: number) => {
    if (index === 0) return
    const newFiles = [...files]
    const temp = newFiles[index - 1]
    newFiles[index - 1] = newFiles[index]
    newFiles[index] = temp
    setFiles(newFiles)
  }

  const moveDown = (index: number) => {
    if (index === files.length - 1) return
    const newFiles = [...files]
    const temp = newFiles[index + 1]
    newFiles[index + 1] = newFiles[index]
    newFiles[index] = temp
    setFiles(newFiles)
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleMerge = async () => {
    if (files.length < 2) {
      showToast('Please add at least 2 PDFs to merge.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const mergedPdf = await PDFDocument.create()

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }

      const pdfBytes = await mergedPdf.save()
      const mergedFile = new File([pdfBytes as unknown as BlobPart], 'merged_document.pdf', { type: 'application/pdf' })
      setResult(mergedFile)
      showToast('PDFs merged successfully!', 'success')
    } catch (e) {
      console.error(e)
      showToast('An error occurred while merging PDFs.', 'error')
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
    <div className="max-w-7xl mx-auto p-8 w-full">
      <header className="mb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Merge PDF</h1>
        <p className="text-slate-500 text-sm">Combine multiple PDFs into a single document.</p>
      </header>

      <div
        {...dropzone.getRootProps()}
        className={`relative flex flex-col items-center justify-center p-10 mb-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
          dropzone.isDragActive
            ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/20'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-sm'
        }`}
      >
        <input {...dropzone.getInputProps()} />
        <div className="bg-blue-100 text-blue-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
          <UploadCloud size={24} />
        </div>
        <div className="text-base text-slate-700 text-center mb-1">
          <strong>Drop PDFs here</strong> <span className="font-normal text-slate-500">or click to browse</span>
        </div>
        <span className="text-xs font-medium text-slate-400">Add multiple PDFs to combine them</span>
      </div>

      {files.length > 0 && !result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Files to merge</h2>
          <div className="space-y-3 mb-6">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <FileText size={18} className="text-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors">
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={() => moveDown(idx)} disabled={idx === files.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors">
                    <ArrowDown size={16} />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button onClick={() => removeFile(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleMerge}
              disabled={isProcessing || files.length < 2}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? 'Merging...' : 'Merge PDFs'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} />
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Merge Complete!</h2>
          <p className="text-emerald-700 text-sm mb-8">Your PDFs have been successfully combined into one document.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-sm font-medium rounded-xl shadow-sm transition-all"
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
              setFiles([])
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
