import { Outlet } from 'react-router-dom'
import { WorkspaceSidebar } from '../components/dashboard/WorkspaceSidebar'
import Header from '../components/ui/Header'

export function MainLayout() {
  return (
    <main className="workspace-layout">
      <WorkspaceSidebar />
      <section className="workspace-main">
        <Header />
        <Outlet />
      </section>
    </main>
  )
}
