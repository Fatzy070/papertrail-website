import { Dialog } from '../ui/Dialog';
import { CreditCard, Landmark } from 'lucide-react';

export function PaymentMethodModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (channel: 'card' | 'bank_transfer') => void;
}) {
  return (
    <Dialog title="Select Payment Method" onClose={onClose}>
      <div className="flex flex-col gap-4 py-4">
        <button
          className="flex items-center gap-4 rounded-xl border p-4 text-left hover:border-blue-500 hover:bg-[var(--primary-soft)]/50"
          onClick={() => onSelect('card')}
        >
          <div className="rounded-full bg-[var(--primary-soft)] p-3 text-[var(--primary)]">
            <CreditCard size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Credit or Debit Card</h3>
            <p className="text-sm text-[var(--muted)]">Pay securely with your card</p>
          </div>
        </button>
        
        <button
          className="flex items-center gap-4 rounded-xl border p-4 text-left hover:border-blue-500 hover:bg-[var(--primary-soft)]/50"
          onClick={() => onSelect('bank_transfer')}
        >
          <div className="rounded-full bg-[var(--primary-soft)] p-3 text-[var(--primary)]">
            <Landmark size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Bank Transfer</h3>
            <p className="text-sm text-[var(--muted)]">Transfer directly from your bank</p>
          </div>
        </button>
      </div>
    </Dialog>
  );
}
