
import { ThemeToggle } from './ThemeToggle'
import { FolderOpen, ChevronRight } from 'lucide-react'


const Header = () => {


  return (
    <div className="workspace-breadcrumb">
          <FolderOpen size={14} /> Workspace <ChevronRight size={12} />
          <span>Documents</span>
          <ThemeToggle />
   </div>
  )
}

export default Header
