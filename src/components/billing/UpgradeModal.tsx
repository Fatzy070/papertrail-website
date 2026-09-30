import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Check } from 'lucide-react';
import { useCheckoutPro } from '../../hooks/use-billing';
import { PaymentMethodModal } from './PaymentMethodModal';

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const checkoutPro = useCheckoutPro();

  const features = [
    'Unlimited document edits',
    'Export without watermarks',
    'Priority email support',
    'Early access to new features',
  ];

  const handleCheckout = (channel: 'card' | 'bank_transfer') => {
    checkoutPro.mutate(
      { recurring: true, channel },
      {
        onSuccess: (data) => {
          window.location.href = data.authorization_url;
        },
      }
    );
  };

  if (showPaymentMethod) {
    return (
      <PaymentMethodModal
        onClose={() => setShowPaymentMethod(false)}
        onSelect={handleCheckout}
      />
    );
  }

  return (
    <Dialog title="Upgrade to Pro" onClose={onClose}>
      <div className="py-4">
        <div className="mb-6 rounded-xl bg-[var(--primary-soft)] p-6 text-center">
          <h3 className="text-2xl font-bold text-[var(--text)]">₦5,000<span className="text-sm font-normal text-[var(--muted)]">/month</span></h3>
          <p className="mt-2 text-sm text-[var(--primary)]">Unlock your full potential</p>
        </div>

        <ul className="mb-8 space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-[var(--text)]">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          className="w-full rounded-lg bg-[var(--primary)] py-3 font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
          onClick={() => setShowPaymentMethod(true)}
          disabled={checkoutPro.isPending}
        >
          {checkoutPro.isPending ? 'Loading...' : 'Upgrade Now'}
        </button>
      </div>
    </Dialog>
  );
}
