import { FolderOpen, Home, Grid2X2, ChevronUp } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Brand } from '../ui/Brand'
import { UserAvatar } from '../ui/UserAvatar'
import { useCurrentUser } from '../../hooks/use-auth'

export function WorkspaceSidebar() {
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const links = [
    { to: '/dashboard', label: 'Home', icon: Home, active: pathname === '/dashboard' },
    { to: '/documents', label: 'My Documents', icon: FolderOpen, active: ['/documents','/recent','/starred','/trash'].includes(pathname) },
    { to: '/tools', label: 'PDF Tools', icon: Grid2X2, active: pathname.startsWith('/tools') },
  ]
  return <aside className="workspace-sidebar compact-sidebar">
    <div className="sidebar-brand-row"><Link to="/dashboard"><Brand /></Link></div>
    <nav aria-label="Workspace navigation">{links.map(({ icon: Icon, ...link }) => <Link key={link.to} to={link.to} title={link.label} aria-current={link.active ? 'page' : undefined} className={link.active ? 'workspace-nav active' : 'workspace-nav'}><Icon size={19} /><span>{link.label}</span></Link>)}</nav>
    <div className="sidebar-account"><Link to="/settings" className="account-entry" title="Your account" aria-label="Open your account"><UserAvatar user={user.data} size="small" /><div className="account-copy"><strong>{user.data?.name}</strong><span>{user.data?.email}</span></div><ChevronUp size={15} /></Link></div>
  </aside>
}
