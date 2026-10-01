import { FolderOpen, Grid2X2, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/use-auth'
import { UserAvatar } from './UserAvatar'

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const items = [
    { to: '/dashboard', label: 'Home', icon: Home, active: pathname === '/dashboard' },
    { to: '/documents', label: 'My Documents', icon: FolderOpen, active: ['/documents', '/recent', '/starred', '/trash'].includes(pathname) },
    { to: '/tools', label: 'PDF Tools', icon: Grid2X2, active: pathname.startsWith('/tools') },
  ]

  const profileActive = pathname === '/settings' || pathname === '/support'
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      {items.map(({ icon: Icon, ...item }) => (
        <Link key={item.to} to={item.to} className={item.active ? 'active' : undefined} aria-current={item.active ? 'page' : undefined}>
          <Icon size={20} />
          <span>{item.label}</span>
        </Link>
      ))}
      <Link to="/settings" className={profileActive ? 'active profile-nav-item' : 'profile-nav-item'} aria-current={profileActive ? 'page' : undefined}>
        <UserAvatar user={user.data} size="small" />
        <span>Profile</span>
      </Link>
    </nav>
  )
}
