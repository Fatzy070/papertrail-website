import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Check, Download, Crown } from 'lucide-react';
import { useCheckoutPro, useCheckoutExport } from '../../hooks/use-billing';
import { PaymentMethodModal } from './PaymentMethodModal';
import type { PendingExport } from '../../pages/BillingCallbackPage';

const PENDING_EXPORT_KEY = 'papertrail_pending_export';

type PlanId = 'single' | 'pro';

interface Feature {
  text: string;
  subtext?: string;
}

interface Plan {
  id: PlanId;
  title: string;
  icon: typeof Download;
  price: string;
  priceSuffix: string;
  priceSubtitle: string;
  features: Feature[];
  buttonText: string;
  badge: string | null;
  orderClass: string;
}

const plans: Plan[] = [
  {
    id: 'single',
    title: 'One-Time Export',
    icon: Download,
    price: '₦500',
    priceSuffix: '',
    priceSubtitle: 'One-time payment',
    features: [
      { text: 'Export this document' },
      { text: 'Re-export for 7 days' },
      { text: 'Keep editing during access period' },
      { text: 'No subscription required' },
    ],
    buttonText: 'Pay ₦500',
    badge: null,
    orderClass: 'order-2 md:order-1',
  },
  {
    id: 'pro',
    title: 'Papertrail Pro',
    icon: Crown,
    price: '₦5,000',
    priceSuffix: '/month',
    priceSubtitle: '',
    features: [
      { text: 'Unlimited PDF exports' },
      { text: 'Full version history' },
      { text: 'Restore older versions' },
      { text: 'Larger uploads & more storage' },
      { text: 'Premium PDF tools', subtext: 'Merge, Split, Compress & Convert' },
    ],
    buttonText: 'Upgrade to Pro',
    badge: 'Best for regular use',
    orderClass: 'order-1 md:order-2',
  }
];

export function ExportGateModal({
  onClose,
  documentId,
  documentName,
}: {
  onClose: () => void;
  documentId: string;
  documentName?: string;
}) {
  const [showPaymentMethod, setShowPaymentMethod] = useState<PlanId | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro');
  const checkoutPro = useCheckoutPro();
  const checkoutExport = useCheckoutExport();

  const handleCheckout = (channel: 'card' | 'bank_transfer') => {
    if (showPaymentMethod === 'pro') {
      checkoutPro.mutate(
        { recurring: channel === 'card', channel },
        {
          onSuccess: (data) => {
            window.location.href = data.authorization_url;
          },
        }
      );
    } else if (showPaymentMethod === 'single') {
      // Save pending export intent before leaving — callback page restores it
      const intent: PendingExport = {
        documentId,
        documentPath: `/documents/${documentId}/edit`,
      };
      localStorage.setItem(PENDING_EXPORT_KEY, JSON.stringify(intent));

      checkoutExport.mutate(
        { documentId, channel },
        {
          onSuccess: (data) => {
            window.location.href = data.authorization_url;
          },
        }
      );
    }
  };

  if (showPaymentMethod) {
    return (
      <PaymentMethodModal
        onClose={() => setShowPaymentMethod(null)}
        onSelect={handleCheckout}
      />
    );
  }

  const isLoading = checkoutPro.isPending || checkoutExport.isPending;

  return (
    <Dialog title="Your PDF is ready" onClose={onClose}>
      <div className="py-4">
        <p className="text-[var(--muted)] text-center text-sm md:text-base">
          Choose a one-time export for this document or upgrade to Pro for unlimited exports and higher limits.
        </p>
        
        {documentName && (
          <div className="text-center py-3">
            <span className="font-medium text-[var(--text)]">Export:</span> {documentName}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const Icon = plan.icon;
            
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`rounded-xl p-6 flex flex-col justify-between relative cursor-pointer transition-all ${plan.orderClass} ${
                  isSelected 
                    ? 'border-2 border-blue-500 bg-[var(--primary-soft)]/50 shadow-sm' 
                    : 'border border-[var(--border)] bg-[var(--surface)] hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}
                <div>
                  <div className={`flex items-center gap-2 mb-2 font-semibold mt-1 ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>
                    <Icon size={20} />
                    <h3>{plan.title}</h3>
                  </div>
                  <h4 className="text-2xl font-bold text-[var(--text)] mb-6">
                    {plan.price}
                    {plan.priceSuffix && <span className="text-sm font-normal text-[var(--muted)]">{plan.priceSuffix}</span>}
                    {plan.priceSubtitle && <span className="block text-sm font-normal text-[var(--muted)] mt-1">{plan.priceSubtitle}</span>}
                  </h4>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)] leading-snug">
                        <Check size={16} className={`${isSelected ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} shrink-0 mt-0.5 transition-colors`} /> 
                        <div>
                          <span>{feat.text}</span>
                          {feat.subtext && <span className="block text-xs text-[var(--muted)] mt-0.5">{feat.subtext}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPaymentMethod(plan.id);
                  }}
                  className={`w-full rounded-lg py-2.5 font-semibold mt-4 transition-colors disabled:opacity-50 ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                      : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
