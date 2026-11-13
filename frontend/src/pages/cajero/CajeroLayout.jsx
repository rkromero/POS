import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'

const cajeroLinks = [
  { to: '/cajero', icon: '💰', label: 'A cobrar' },
  { to: '/cajero/cierre-caja', icon: '🔒', label: 'Cierre de Caja' },
]

export default function CajeroLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={cajeroLinks} />
      <main className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 pb-6 pt-[4.5rem] md:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
