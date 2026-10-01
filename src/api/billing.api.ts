import { apiRequest } from './client';

export interface BillingStatus {
  hasActiveSubscription: boolean;
  canExport: boolean;
  subscription?: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    recurring: boolean;
  };
}

export interface CheckoutResponse {
  authorization_url: string;
  accessCode: string;
  reference: string;
}

export const billingApi = {
  getStatus: (documentId?: string) => 
    apiRequest<BillingStatus>(`/billing/status${documentId ? `?documentId=${documentId}` : ''}`),
  
  checkoutExport: (documentId: string, channel?: string) => 
    apiRequest<CheckoutResponse>('/billing/checkout/export', {
      method: 'POST',
      body: JSON.stringify({ documentId, channel }),
    }),
    
  checkoutPro: (recurring: boolean, channel?: string) => 
    apiRequest<CheckoutResponse>('/billing/checkout/pro', {
      method: 'POST',
      body: JSON.stringify({ recurring, channel }),
    }),
    
  verifyTransaction: (reference: string) => 
    apiRequest<{ message: string }>('/billing/verify', {
      method: 'POST',
      body: JSON.stringify({ reference }),
    }),
    
  cancelSubscription: () => 
    apiRequest<{ message: string }>('/billing/cancel', {
      method: 'POST',
    }),
};
