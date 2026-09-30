import { Outlet } from 'react-router-dom'
import { WorkspaceSidebar } from '../components/dashboard/WorkspaceSidebar'
import Header from '../components/ui/Header'
import { MobileBottomNav } from '../components/ui/MobileBottomNav'

export function MainLayout() {
  return (
    <main className="workspace-layout">
      <WorkspaceSidebar />
      <section className="workspace-main">
        <Header />
        <Outlet />
      </section>
      <MobileBottomNav />
    </main>
  )
}
