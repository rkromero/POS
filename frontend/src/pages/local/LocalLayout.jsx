import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'

const localLinks = [
  { to: '/local', icon: '🛒', label: 'Caja / POS' },
  { to: '/local/ventas', icon: '📋', label: 'Historial de ventas' },
  { to: '/local/productos', icon: '📦', label: 'Productos' },
  { to: '/local/reportes', icon: '📊', label: 'Reportes' },
]

export default function LocalLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={localLinks} />
      <main className="flex-1 p-6 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
