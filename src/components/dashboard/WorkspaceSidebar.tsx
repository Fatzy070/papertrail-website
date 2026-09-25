import { Clock3, CircleHelp, Combine, FolderOpen, Home, LogOut, Minimize2, RefreshCw, Scissors, Settings, Star, Trash2, UploadCloud } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../ui/Brand'
import { UserAvatar } from '../ui/UserAvatar'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useCurrentUser, useLogout } from '../../hooks/use-auth'
import { useToastStore } from '../../store/toast-store'

export function WorkspaceSidebar({ documentCount = 0, onUpload }: { documentCount?: number; onUpload?: () => void }) {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const show = useToastStore((state) => state.show)
  const upload = () => onUpload ? onUpload() : navigate('/dashboard')


  return <aside className="workspace-sidebar">
    <div className="sidebar-brand-row"><Link to="/dashboard"><Brand /></Link><ThemeToggle /></div>
   
    <Link className="workspace-nav sidebar-home-link" to="/dashboard"><Home size={17} /><span>Home</span></Link>
    <p className="sidebar-section-label">Workspace</p>
    <Link className="workspace-nav" to="/dashboard"><FolderOpen size={17} /><span>My Documents</span><span>{documentCount}</span></Link>
    <Link className="workspace-nav" to="/recent"><Clock3 size={17} /><span>Recent</span></Link>
    <Link className="workspace-nav" to="/starred"><Star size={17} /><span>Starred</span></Link>
    <Link className="workspace-nav" to="/trash"><Trash2 size={17} /><span>Trash</span></Link>
    <p className="sidebar-section-label">Tools</p>
    <Link className="workspace-nav" to="/tools/merge"><Combine size={17} /><span>Merge PDF</span></Link>
    <Link className="workspace-nav" to="/tools/split"><Scissors size={17} /><span>Split / Extract Pages</span></Link>
    <Link className="workspace-nav" to="/tools/compress"><Minimize2 size={17} /><span>Compress PDF</span></Link>
    <Link className="workspace-nav" to="/tools/convert"><RefreshCw size={17} /><span>Convert PDF</span></Link>
    <div className="sidebar-divider" />
    <Link className="workspace-nav" to="/support"><CircleHelp size={17} /><span>Help &amp; Feedback</span></Link>
    <Link className="workspace-nav" to="/settings"><Settings size={17} /><span>Settings</span></Link>
    <div className="account-card"><UserAvatar user={user.data} size="small" /><div className="account-copy"><strong>{user.data?.name}</strong><span>{user.data?.email}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" disabled={logout.isPending} onClick={() => void logout.mutateAsync().then(() => navigate('/login')).catch(() => show('Could not sign out. Try again.', 'error'))}><LogOut size={15} /></button></div>
  </aside>
}
