import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, type DocumentMetadata } from '../api/documents.api'
import { invalidateCachedDocumentBytes } from '../engine/pdf-cache'

export const documentKeys = {
  all: (filter?: string) => ['documents', filter ?? 'all'] as const,
  detail: (id: string) => ['documents', id] as const,
  versions: (id: string) => ['documents', id, 'versions'] as const,
}

export function useDocuments(filter?: string) { return useQuery({ queryKey: documentKeys.all(filter), queryFn: () => documentsApi.list(filter) }) }
export function useDocument(id?: string) {
  const client = useQueryClient()
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: () => documentsApi.get(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
    initialData: () => {
      if (!id) return undefined
      const listQueries = client.getQueriesData<DocumentMetadata[]>({ queryKey: ['documents'] })
      for (const [, list] of listQueries) {
        if (Array.isArray(list)) {
          const match = list.find((doc) => doc.id === id)
          if (match) return match
        }
      }
      return undefined
    },
    initialDataUpdatedAt: () => {
      if (!id) return undefined
      const listQueries = client.getQueriesData<DocumentMetadata[]>({ queryKey: ['documents'] })
      for (const [key, list] of listQueries) {
        if (Array.isArray(list) && list.some((doc) => doc.id === id)) {
          return client.getQueryState(key)?.dataUpdatedAt
        }
      }
      return undefined
    },
  })
}
export function useDocumentVersions(id?: string) { return useQuery({ queryKey: documentKeys.versions(id ?? ''), queryFn: () => documentsApi.versions(id!), enabled: Boolean(id) }) }

function invalidateDocumentLists(client: ReturnType<typeof useQueryClient>, excludeDetailId?: string) {
  return client.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'documents' &&
      (!excludeDetailId || query.queryKey[1] !== excludeDetailId),
  })
}

export function useUploadDocument() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (file: File) => documentsApi.upload(file), onSuccess: () => client.invalidateQueries({ queryKey: ['documents'] }) })
}
export function useRenameDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => documentsApi.rename(id, name),
    onSuccess: (document) => {
      client.setQueryData(documentKeys.detail(document.id), document)
      void invalidateDocumentLists(client, document.id)
    },
  })
}
export function useUpdateDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof documentsApi.update>[1] }) => documentsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await client.cancelQueries({
        predicate: (query) => query.queryKey[0] === 'documents' && query.queryKey[1] !== id,
      })
      const queries = client.getQueriesData<DocumentMetadata[]>({ queryKey: ['documents'] })
      queries.forEach(([queryKey, oldData]) => {
        if (Array.isArray(oldData)) {
          client.setQueryData(
            queryKey,
            oldData.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc))
          )
        }
      })
    },
    onSuccess: (document) => {
      client.setQueryData(documentKeys.detail(document.id), document)
      void invalidateDocumentLists(client, document.id)
    },
    onError: (_err, variables) => {
      void invalidateDocumentLists(client, variables.id)
    }
  })
}
export function useDeleteDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: (_res, id) => {
      invalidateCachedDocumentBytes(id)
      return client.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
export function useSaveDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blob }: { id: string; blob: Blob }) => documentsApi.save(id, blob),
    onSuccess: (document) => {
      invalidateCachedDocumentBytes(document.id)
      client.setQueryData(documentKeys.detail(document.id), document)
      void invalidateDocumentLists(client, document.id)
    },
  })
}
export function useRestoreVersion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, versionId }: { documentId: string; versionId: string }) => documentsApi.restoreVersion(documentId, versionId),
    onSuccess: (document) => {
      invalidateCachedDocumentBytes(document.id)
      client.setQueryData(documentKeys.detail(document.id), document)
      void client.invalidateQueries({ queryKey: documentKeys.versions(document.id) })
      void invalidateDocumentLists(client, document.id)
    },
  })
}
