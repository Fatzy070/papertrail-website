import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, Download, FileText, Minimize2, Save, UploadCloud } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { Link } from 'react-router-dom'
import { useToastStore } from '../../store/toast-store'
import { useUploadDocument } from '../../hooks/use-documents'

const maxBytes = 50 * 1024 * 1024

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<File | null>(null)
  const [savings, setSavings] = useState({ original: 0, compressed: 0 })
  
  const showToast = useToastStore((state) => state.show)
  const upload = useUploadDocument()

  const dropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxBytes,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0])
        setResult(null)
      }
    },
    onDropRejected: () => showToast('Choose a PDF no larger than 50 MB.', 'error'),
  })

  const handleCompress = async () => {
    if (!file) return

    setIsProcessing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const originalBytesLength = arrayBuffer.byteLength
      
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      
      // pdf-lib's save method inherently garbage collects unreferenced objects.
      // useObjectStreams: true compresses the internal structures significantly.
      const pdfBytes = await pdfDoc.save({ useObjectStreams: true })
      const compressedBytesLength = pdfBytes.byteLength

      if (compressedBytesLength < originalBytesLength) {
        const newFile = new File([pdfBytes as unknown as BlobPart], `compressed_${file.name}`, { type: 'application/pdf' })
        setResult(newFile)
        setSavings({ original: originalBytesLength, compressed: compressedBytesLength })
        showToast('PDF compressed successfully!', 'success')
      } else {
        showToast('This PDF is already highly optimized and cannot be compressed further.', 'error')
        setFile(null)
      }
    } catch (e) {
      console.error(e)
      showToast('An error occurred while compressing the PDF.', 'error')
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Compress PDF</h1>
        <p className="text-slate-500 text-sm">Reduce PDF size by removing redundant objects.</p>
      </header>

      {!file && (
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
            <strong>Drop a PDF here</strong> <span className="font-normal text-slate-500">or click to browse</span>
          </div>
          <span className="text-xs font-medium text-slate-400">PDF files up to 50 MB</span>
        </div>
      )}

      {file && !result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <FileText size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900 truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="text-xs text-slate-500">
                  {formatSize(file.size)}
                </div>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Change file
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
            >
              {isProcessing && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {isProcessing ? 'Compressing...' : 'Compress PDF'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <Minimize2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Compression Successful!</h2>
          <p className="text-emerald-700 text-sm mb-6">
            We reduced the size of your PDF by {((1 - savings.compressed / savings.original) * 100).toFixed(1)}%.
          </p>
          
          <div className="flex items-center justify-center gap-8 mb-8 text-sm bg-white/60 px-6 py-4 rounded-xl border border-emerald-200/50">
            <div>
              <div className="text-emerald-600 font-medium mb-1">Original Size</div>
              <div className="text-slate-600 line-through">{formatSize(savings.original)}</div>
            </div>
            <div className="w-px h-8 bg-emerald-200/50" />
            <div>
              <div className="text-emerald-600 font-medium mb-1">New Size</div>
              <div className="text-emerald-800 font-bold">{formatSize(savings.compressed)}</div>
            </div>
          </div>
          
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
              setFile(null)
            }}
            className="mt-6 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
          >
            Compress another file
          </button>
        </div>
      )}
    </div>
  )
}
