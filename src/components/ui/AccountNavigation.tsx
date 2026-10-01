import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, LogOut } from 'lucide-react'
import { useLogout } from '../../hooks/use-auth'
import { useToastStore } from '../../store/toast-store'

export function AccountNavigation({ support = false }: { support?: boolean }) {
  const logout = useLogout()
  const navigate = useNavigate()
  const show = useToastStore(state => state.show)
  return <nav className="account-navigation" aria-label="Account navigation"><Link to="/settings" aria-current={!support ? 'page' : undefined}>Account & settings</Link><Link to="/settings?tab=billing">Billing</Link><Link to="/support" aria-current={support ? 'page' : undefined}>Help & feedback <ArrowUpRight size={13} /></Link><button className="toolbar-button" disabled={logout.isPending} onClick={() => void logout.mutateAsync().then(() => navigate('/login')).catch(() => show('Could not sign out. Try again.', 'error'))}><LogOut size={14} />{logout.isPending ? 'Signing out…' : 'Sign out'}</button></nav>
}
