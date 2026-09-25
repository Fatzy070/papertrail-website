import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  useDocumentVersions,
  useRestoreVersion,
} from '../../hooks/use-documents'
import { useToastStore } from '../../store/toast-store'
import { Dialog } from '../ui/Dialog'
import { LoadingState } from '../ui/LoadingState'
export function VersionHistory({
  documentId,
  onClose,
  onRestored,
}: {
  documentId: string
  onClose: () => void
  onRestored: () => Promise<void>
}) {
  const versions = useDocumentVersions(documentId)
  const restore = useRestoreVersion()
  const show = useToastStore((s) => s.show)
  const [selected, setSelected] = useState<{
    id: string
    number: number
  } | null>(null)
  async function run() {
    if (!selected) return
    try {
      await restore.mutateAsync({ documentId, versionId: selected.id })
      await onRestored()
      show(`Version ${selected.number} restored.`, 'success')
      onClose()
    } catch (error) {
      show(error instanceof Error ? error.message : 'Restore failed.', 'error')
    }
  }
  return (
    <Dialog
      title={
        selected ? `Restore version ${selected.number}?` : 'Version history'
      }
      description={
        selected
          ? 'This will replace your current view, including any unsaved edits. Saved history is preserved, and a new version is created.'
          : 'Every save is a fresh checkpoint. Return to an earlier version anytime.'
      }
      onClose={onClose}
    >
      {selected ? (
        <div className="dialog-actions">
          <button
            className="toolbar-button bordered"
            disabled={restore.isPending}
            onClick={() => setSelected(null)}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={restore.isPending}
            onClick={() => void run()}
          >
            <RotateCcw size={14} />
            {restore.isPending ? 'Restoring…' : 'Restore version'}
          </button>
        </div>
      ) : versions.isPending ? (
        <LoadingState label="Loading version history" />
      ) : versions.isError ? (
        <p className="error-message" role="alert">
          Could not load version history.
        </p>
      ) : (
        <div className="version-history-list">
          {versions.data?.map((version) => (
            <div className="version-row" key={version.id}>
              <div>
                <strong>Version {version.versionNumber}</strong>
                {version.current && (
                  <span className="version-badge">Current</span>
                )}
                <p>
                  {new Date(version.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {Math.max(1, Math.round(version.size / 1024))} KB
                </p>
              </div>
              {!version.current && (
                <button
                  className="toolbar-button bordered"
                  onClick={() =>
                    setSelected({
                      id: version.id,
                      number: version.versionNumber,
                    })
                  }
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
