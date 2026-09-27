import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { FolderOpen, ChevronRight, Crown } from 'lucide-react'
import { useBillingStatus } from '../../hooks/use-billing'
import { UpgradeModal } from '../billing/UpgradeModal'

const Header = () => {
  const { data: billing } = useBillingStatus()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  return (
    <div className="workspace-breadcrumb flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <FolderOpen size={14} /> Workspace <ChevronRight size={12} />
        <span>Documents</span>
      </div>
      
      <div className="flex items-center gap-4">
        {billing?.hasActiveSubscription ? (
          <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            <Crown size={14} />
            <span>PRO</span>
          </div>
        ) : (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
          >
            <Crown size={14} />
            <span>Upgrade to Pro</span>
          </button>
        )}
        <ThemeToggle />
      </div>

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  )
}

export default Header
