import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { FolderOpen, ChevronRight, Crown } from 'lucide-react'
import { useBillingStatus } from '../../hooks/use-billing'
import { UpgradeModal } from '../billing/UpgradeModal'
import { useLocation } from 'react-router-dom'

const Header = () => {
  const { pathname } = useLocation()
  const titles: Record<string, string> = { '/dashboard': 'Home', '/documents': 'My documents', '/recent': 'Recent', '/starred': 'Starred', '/trash': 'Trash', '/settings': 'Settings', '/support': 'Help & feedback', '/tools/merge': 'Merge PDF', '/tools/split': 'Split & extract', '/tools/compress': 'Compress PDF', '/tools/convert': 'Convert PDF' }
  const { data: billing } = useBillingStatus()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  return (
    <div className="workspace-breadcrumb flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <FolderOpen size={14} /> Workspace <ChevronRight size={12} />
        <span>{pathname === '/tools' ? 'PDF Tools' : titles[pathname] ?? 'Workspace'}</span>
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
