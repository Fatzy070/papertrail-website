import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '../api/documents.api'

export const documentKeys = {
  all: ['documents'] as const,
  detail: (id: string) => ['documents', id] as const,
  versions: (id: string) => ['documents', id, 'versions'] as const,
}

export function useDocuments() { return useQuery({ queryKey: documentKeys.all, queryFn: documentsApi.list }) }
export function useDocument(id?: string) { return useQuery({ queryKey: documentKeys.detail(id ?? ''), queryFn: () => documentsApi.get(id!), enabled: Boolean(id) }) }
export function useDocumentVersions(id?: string) { return useQuery({ queryKey: documentKeys.versions(id ?? ''), queryFn: () => documentsApi.versions(id!), enabled: Boolean(id) }) }

export function useUploadDocument() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (file: File) => documentsApi.upload(file), onSuccess: () => client.invalidateQueries({ queryKey: documentKeys.all }) })
}
export function useRenameDocument() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => documentsApi.rename(id, name), onSuccess: (document) => { client.setQueryData(documentKeys.detail(document.id), document); void client.invalidateQueries({ queryKey: documentKeys.all }) } })
}
export function useDeleteDocument() {
  const client = useQueryClient()
  return useMutation({ mutationFn: documentsApi.remove, onSuccess: () => client.invalidateQueries({ queryKey: documentKeys.all }) })
}
export function useSaveDocument() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, blob }: { id: string; blob: Blob }) => documentsApi.save(id, blob), onSuccess: (document) => { client.setQueryData(documentKeys.detail(document.id), document); void client.invalidateQueries({ queryKey: documentKeys.all }); void client.invalidateQueries({ queryKey: documentKeys.versions(document.id) }) } })
}
export function useRestoreVersion() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ documentId, versionId }: { documentId: string; versionId: string }) => documentsApi.restoreVersion(documentId, versionId), onSuccess: (document) => { client.setQueryData(documentKeys.detail(document.id), document); void client.invalidateQueries({ queryKey: documentKeys.versions(document.id) }) } })
}
