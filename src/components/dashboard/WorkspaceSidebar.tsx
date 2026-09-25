import { Clock3, CircleHelp, Combine, FolderOpen, Home, LogOut, Minimize2, RefreshCw, Scissors, Settings, Star, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../ui/Brand'
import { UserAvatar } from '../ui/UserAvatar'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useCurrentUser, useLogout } from '../../hooks/use-auth'
import { useToastStore } from '../../store/toast-store'

const WORKSPACE_LINKS = [
  { to: '/dashboard', icon: FolderOpen, label: 'My Documents', showCount: true },
  { to: '/recent', icon: Clock3, label: 'Recent' },
  { to: '/starred', icon: Star, label: 'Starred' },
  { to: '/trash', icon: Trash2, label: 'Trash' },
]

const TOOL_LINKS = [
  { to: '/tools/merge', icon: Combine, label: 'Merge PDF' },
  { to: '/tools/split', icon: Scissors, label: 'Split / Extract Pages' },
  { to: '/tools/compress', icon: Minimize2, label: 'Compress PDF' },
  { to: '/tools/convert', icon: RefreshCw, label: 'Convert PDF' },
]

const FOOTER_LINKS = [
  { to: '/support', icon: CircleHelp, label: 'Help & Feedback' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function WorkspaceSidebar({ documentCount = 0 }: { documentCount?: number }) {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const show = useToastStore((state) => state.show)

  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brand-row">
        <Link to="/dashboard"><Brand /></Link>
        <ThemeToggle />
      </div>
   
      <Link className="workspace-nav sidebar-home-link" to="/dashboard">
        <Home size={17} /><span>Home</span>
      </Link>
      
      <p className="sidebar-section-label">Workspace</p>
      {WORKSPACE_LINKS.map((link) => (
        <Link key={link.to} className="workspace-nav" to={link.to}>
          <link.icon size={17} />
          <span>{link.label}</span>
          {link.showCount && <span>{documentCount}</span>}
        </Link>
      ))}

      <p className="sidebar-section-label">Tools</p>
      {TOOL_LINKS.map((link) => (
        <Link key={link.to} className="workspace-nav" to={link.to}>
          <link.icon size={17} />
          <span>{link.label}</span>
        </Link>
      ))}
      
      <div className="mt-auto">
        <div className="sidebar-divider" />
        {FOOTER_LINKS.map((link) => (
          <Link key={link.to} className="workspace-nav" to={link.to}>
            <link.icon size={17} />
            <span>{link.label}</span>
          </Link>
        ))}
        <div className="account-card" style={{ marginTop: 0 }}>
          <UserAvatar user={user.data} size="small" />
          <div className="account-copy">
            <strong>{user.data?.name}</strong>
            <span>{user.data?.email}</span>
          </div>
          <button 
            className="icon-button" 
            aria-label="Sign out" 
            title="Sign out" 
            disabled={logout.isPending} 
            onClick={() => void logout.mutateAsync().then(() => navigate('/login')).catch(() => show('Could not sign out. Try again.', 'error'))}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
