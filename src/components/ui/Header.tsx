
import { ThemeToggle } from './ThemeToggle'
import { FolderOpen, ChevronRight, LogOut } from 'lucide-react'
import { useLogout } from '../../hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { useToastStore } from '../../store/toast-store'

const Header = () => {
  const logout = useLogout()
  const navigate = useNavigate()
  const show = useToastStore((state) => state.show)

  return (
    <div className="workspace-breadcrumb">
          <FolderOpen size={14} /> Workspace <ChevronRight size={12} />
          <span>Documents</span>
          <ThemeToggle />
          <button
            className="icon-button mobile-account"
            aria-label="Sign out"
            onClick={() =>
              void logout
                .mutateAsync()
                .then(() => navigate('/login'))
                .catch(() => show('Could not sign out.', 'error'))
            }
          >
            <LogOut size={16} />
          </button>
   </div>
  )
}

export default Header
