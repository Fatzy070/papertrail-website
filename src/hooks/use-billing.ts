import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billing.api';
export function useBillingStatus(documentId?: string) {
  return useQuery({
    queryKey: ['billing', 'status', documentId],
    queryFn: () => billingApi.getStatus(documentId),
  });
}

export function useCheckoutExport() {
  return useMutation({
    mutationFn: ({ documentId, channel }: { documentId: string; channel?: string }) => 
      billingApi.checkoutExport(documentId, channel),
  });
}

export function useCheckoutPro() {
  return useMutation({
    mutationFn: ({ recurring, channel }: { recurring: boolean; channel?: string }) => 
      billingApi.checkoutPro(recurring, channel),
  });
}

export function useVerifyTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reference }: { reference: string; documentId?: string }) =>
      billingApi.verifyTransaction(reference),
    onSuccess: (_data, variables) => {
      // Invalidate the generic key (covers Pro status, settings page, etc.)
      queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
      // Also invalidate the document-specific key used by EditorPage
      if (variables.documentId) {
        queryClient.invalidateQueries({
          queryKey: ['billing', 'status', variables.documentId],
        });
      }
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
  });
}
